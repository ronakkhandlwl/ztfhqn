"""HTTP routes. Thin: parse/validate input, call the service, return a view."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from winddesk.api.deps import get_analytics
from winddesk.api.schemas import AccuracyOut, DecisionOut, ExplorerOut, HealthOut, MetaOut
from winddesk.domain.markets import (
    DEFAULT_BID_LEAD_MINUTES,
    DEFAULT_MARKET_ID,
    MAX_BID_LEAD_MINUTES,
)
from winddesk.services.analytics import MAX_EXPLORER_HORIZON_H, WindAnalytics
from winddesk.services.views import AccuracyView, DecisionView, ExplorerView, MetaView

router = APIRouter(prefix="/api")

Analytics = Annotated[WindAnalytics, Depends(get_analytics)]
MarketParam = Annotated[str, Query(description="Market id, see /api/meta", max_length=40)]
LeadParam = Annotated[
    int,
    Query(
        alias="bidLeadMinutes",
        ge=0,
        le=MAX_BID_LEAD_MINUTES,
        description="Minutes before gate closure the desk finalises bids",
    ),
]


@router.get("/health", response_model=HealthOut)
def health(analytics: Analytics) -> dict[str, object]:
    return analytics.health()


@router.get("/meta", response_model=MetaOut)
def meta(analytics: Analytics) -> MetaView:
    return analytics.meta()


@router.get("/decision", response_model=DecisionOut)
def decision(
    analytics: Analytics,
    delivery_date: Annotated[date, Query(alias="deliveryDate")],
    market: MarketParam = DEFAULT_MARKET_ID,
    bid_lead_minutes: LeadParam = DEFAULT_BID_LEAD_MINUTES,
) -> DecisionView:
    return analytics.decision(delivery_date, market, bid_lead_minutes)


@router.get("/accuracy", response_model=AccuracyOut)
def accuracy(
    analytics: Analytics,
    market: MarketParam = DEFAULT_MARKET_ID,
    bid_lead_minutes: LeadParam = DEFAULT_BID_LEAD_MINUTES,
) -> AccuracyView:
    return analytics.accuracy(market, bid_lead_minutes)


@router.get("/explorer", response_model=ExplorerOut)
def explorer(
    analytics: Analytics,
    start: datetime,
    end: datetime,
    min_horizon_h: Annotated[
        float, Query(alias="minHorizonH", ge=0, le=MAX_EXPLORER_HORIZON_H)
    ] = 4.0,
) -> ExplorerView:
    return analytics.explorer(start, end, min_horizon_h)
