"""ASGI entrypoint (uvicorn main:app, Vercel Python runtime)."""

from winddesk.api.app import create_app

app = create_app()
