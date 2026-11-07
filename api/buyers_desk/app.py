"""The application: one deployable serving the documented JSON API (ADR 0001)."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine

from buyers_desk import engagements
from buyers_desk.settings import Settings

BUILT_WEB_APP = Path(__file__).resolve().parent.parent.parent / "web" / "dist"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings
        app.state.engine = create_engine(settings.app_url)
        yield
        app.state.engine.dispose()

    app = FastAPI(title="Buyers desk API", lifespan=lifespan)
    app.include_router(engagements.router)
    if (BUILT_WEB_APP / "index.html").is_file():
        _serve_web_app(app)
    return app


def _serve_web_app(app: FastAPI) -> None:
    """`make run` serves the built front end from the same address as the API."""
    app.mount("/assets", StaticFiles(directory=BUILT_WEB_APP / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def web_app(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        return FileResponse(BUILT_WEB_APP / "index.html")
