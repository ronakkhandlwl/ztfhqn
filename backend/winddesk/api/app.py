"""FastAPI application factory."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from winddesk import __version__
from winddesk.api.middleware import CacheHeadersMiddleware, RateLimitMiddleware
from winddesk.api.routes import router
from winddesk.config import Settings, get_settings
from winddesk.services.errors import InvalidRequestError, NotFoundError

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="Wind Desk API",
        version=__version__,
        description=(
            "Day-ahead wind forecast decision support for GB power procurement. "
            "Data: Elexon BMRS FUELHH (outturn) and WINDFOR (forecast)."
        ),
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CacheHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFoundError)
    async def not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse({"detail": str(exc)}, status_code=404)

    @app.exception_handler(InvalidRequestError)
    async def invalid(_: Request, exc: InvalidRequestError) -> JSONResponse:
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse({"detail": "Internal server error"}, status_code=500)

    app.include_router(router)
    return app
