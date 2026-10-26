from datetime import date

import httpx
import pytest

from winddesk.data.elexon import ElexonClient, ElexonError, _date_chunks


def _client(handler) -> ElexonClient:  # type: ignore[no-untyped-def]
    http = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://t.test")
    return ElexonClient("https://t.test", http=http, backoff_s=0)


def test_date_chunks_are_inclusive_and_contiguous() -> None:
    chunks = list(_date_chunks(date(2026, 1, 1), date(2026, 1, 15), days=7))
    assert chunks == [
        (date(2026, 1, 1), date(2026, 1, 7)),
        (date(2026, 1, 8), date(2026, 1, 14)),
        (date(2026, 1, 15), date(2026, 1, 15)),
    ]


def test_fetch_actuals_filters_wind_and_chunks_requests() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            200,
            json=[
                {"startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": 100},
                {"startTime": "2026-01-01T00:00:00Z", "fuelType": "CCGT", "generation": 999},
            ],
        )

    df = _client(handler).fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 10))
    assert len(calls) == 2
    assert calls[0].url.params["fuelType"] == "WIND"
    assert calls[0].url.params["settlementDateTo"] == "2026-01-07"
    assert df["generation"].tolist() == [100]


def test_fetch_forecasts_parses_and_accepts_wrapped_payload() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["publishDateTimeFrom"] == "2026-01-01T00:00:00Z"
        assert request.url.params["publishDateTimeTo"] == "2026-01-02T23:59:59Z"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "publishTime": "2026-01-01T07:30:00Z",
                        "startTime": "2026-01-01T12:00:00Z",
                        "generation": 5000,
                    }
                ]
            },
        )

    df = _client(handler).fetch_wind_forecasts(date(2026, 1, 1), date(2026, 1, 2))
    assert len(df) == 1
    assert df.loc[0, "horizon_h"] == pytest.approx(4.5)


def test_retries_then_succeeds() -> None:
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 3:
            return httpx.Response(503)
        return httpx.Response(200, json=[])

    df = _client(handler).fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1))
    assert attempts["n"] == 3
    assert df.empty


def test_raises_after_max_attempts() -> None:
    client = _client(lambda request: httpx.Response(500))
    with pytest.raises(ElexonError):
        client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1))
    client.close()


def test_rejects_unexpected_payload() -> None:
    client = _client(lambda request: httpx.Response(200, json="nope"))
    with pytest.raises(ElexonError):
        client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1))
