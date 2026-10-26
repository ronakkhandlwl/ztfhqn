"""Cross-cutting HTTP concerns: per-client rate limiting and cache headers."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

CACHEABLE_PREFIXES = ("/api/meta", "/api/decision", "/api/accuracy", "/api/explorer")
# The served data is historical and immutable per deployment, so CDNs may cache it.
CACHE_CONTROL = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window limiter per client IP (best effort, per process)."""

    def __init__(self, app: ASGIApp, max_requests: int = 120, window_s: float = 60.0) -> None:
        super().__init__(app)
        self._max = max_requests
        self._window = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _client_key(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self._window:
                hits.popleft()
            if len(hits) >= self._max:
                return False
            hits.append(now)
            return True

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self._allow(self._client_key(request)):
            return JSONResponse(
                {"detail": "Too many requests, please slow down"},
                status_code=429,
                headers={"Retry-After": str(int(self._window))},
            )
        return await call_next(request)


class CacheHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if (
            request.method == "GET"
            and response.status_code == 200
            and request.url.path.startswith(CACHEABLE_PREFIXES)
        ):
            response.headers.setdefault("Cache-Control", CACHE_CONTROL)
        return response
