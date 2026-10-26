from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from winddesk.api.app import create_app
from winddesk.api.deps import get_analytics
from winddesk.api.middleware import RateLimitMiddleware
from winddesk.config import Settings
from winddesk.data.repository import WindDataset
from winddesk.services.analytics import WindAnalytics


@pytest.fixture
def app(dataset: WindDataset, settings: Settings) -> FastAPI:
    application = create_app(settings)
    service = WindAnalytics(dataset, settings)
    application.dependency_overrides[get_analytics] = lambda: service
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_health(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["dataSource"] == "synthetic"


def test_meta_is_camel_case_and_cacheable(client: TestClient) -> None:
    res = client.get("/api/meta")
    assert res.status_code == 200
    body = res.json()
    assert body["defaultMarket"] == "epex-hourly"
    assert body["deliveryDates"][0] == "2026-01-02"
    assert "s-maxage" in res.headers["cache-control"]


def test_decision(client: TestClient) -> None:
    res = client.get("/api/decision", params={"deliveryDate": "2026-01-04"})
    assert res.status_code == 200
    body = res.json()
    assert body["forecastPublishTime"] == "2026-01-03T07:30:00Z"
    assert body["cutoff"] == "2026-01-03T08:50:00Z"
    assert len(body["hours"]) == 24
    assert {"forecast", "p10", "p90", "adjusted", "actual", "error"} <= set(body["hours"][0])
    assert body["summary"]["stats"]["n"] == 24


def test_decision_with_market_and_lead(client: TestClient) -> None:
    res = client.get(
        "/api/decision",
        params={"deliveryDate": "2026-01-04", "market": "n2ex-hourly", "bidLeadMinutes": 0},
    )
    assert res.json()["gateClosure"] == "2026-01-03T09:50:00Z"
    assert res.json()["forecastPublishTime"] == "2026-01-03T09:30:00Z"


@pytest.mark.parametrize(
    ("params", "status"),
    [
        ({"deliveryDate": "2026-05-01"}, 404),
        ({"deliveryDate": "2026-01-04", "market": "bogus"}, 400),
        ({"deliveryDate": "not-a-date"}, 422),
        ({"deliveryDate": "2026-01-04", "bidLeadMinutes": 9999}, 422),
        ({}, 422),
    ],
)
def test_decision_errors(client: TestClient, params: dict[str, str], status: int) -> None:
    res = client.get("/api/decision", params=params)
    assert res.status_code == status
    assert "detail" in res.json()


def test_accuracy(client: TestClient) -> None:
    body = client.get("/api/accuracy").json()
    assert body["overall"]["n"] == 120
    assert len(body["marketComparison"]) == 3
    assert body["byHorizon"] and body["byHourOfDay"] and body["histogram"]


def test_explorer(client: TestClient) -> None:
    res = client.get(
        "/api/explorer",
        params={"start": "2026-01-03T00:00:00Z", "end": "2026-01-04T00:00:00Z", "minHorizonH": 6},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["minHorizonH"] == 6
    assert all(p["horizonH"] >= 6 for p in body["forecasts"])


def test_explorer_rejects_bad_range(client: TestClient) -> None:
    res = client.get(
        "/api/explorer",
        params={"start": "2026-01-04T00:00:00Z", "end": "2026-01-03T00:00:00Z"},
    )
    assert res.status_code == 400


def test_unexpected_errors_are_not_leaked(app: FastAPI) -> None:
    class Broken:
        def meta(self) -> None:
            raise RuntimeError("secret internals")

    app.dependency_overrides[get_analytics] = lambda: Broken()
    with TestClient(app, raise_server_exceptions=False) as c:
        res = c.get("/api/meta")
    assert res.status_code == 500
    assert res.json() == {"detail": "Internal server error"}


def test_rate_limit_returns_429(dataset: WindDataset, settings: Settings) -> None:
    application = FastAPI()
    application.add_middleware(RateLimitMiddleware, max_requests=2, window_s=60)

    @application.get("/ping")
    def ping() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(application) as c:
        codes = [
            c.get("/ping", headers={"x-forwarded-for": "1.2.3.4"}).status_code for _ in range(3)
        ]
        other = c.get("/ping", headers={"x-forwarded-for": "5.6.7.8"}).status_code
    assert codes == [200, 200, 429]
    assert other == 200
