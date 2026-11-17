"""The application: one deployable serving the documented JSON API (ADR 0001)."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine

from buyers_desk import activity, contract, brief, engagements, intakes, people, pipeline, professionals, properties
from buyers_desk.intake.claude import ClaudeExtractor
from buyers_desk.intake.extraction import Extractor, ScriptedExtractor
from buyers_desk.intake.keys import load_keys
from buyers_desk.intake.ollama import OllamaExtractor
from buyers_desk.intake.scoring import key_replays
from buyers_desk.settings import Settings

BUILT_WEB_APP = Path(__file__).resolve().parent.parent.parent / "web" / "dist"


def create_app(settings: Settings | None = None, extractor: Extractor | None = None) -> FastAPI:
    settings = settings or Settings()
    chosen = extractor or build_extractor(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings
        app.state.extractor = chosen
        app.state.engine = create_engine(settings.app_url)
        yield
        app.state.engine.dispose()

    app = FastAPI(title="Buyers desk API", lifespan=lifespan)
    contract.install(app)
    app.include_router(engagements.router)
    app.include_router(intakes.router)
    app.include_router(people.router)
    app.include_router(pipeline.router)
    app.include_router(brief.router)
    app.include_router(properties.router)
    app.include_router(professionals.router)
    app.include_router(activity.router)
    if (BUILT_WEB_APP / "index.html").is_file():
        _serve_web_app(app)
    return app


def build_extractor(settings: Settings) -> Extractor:
    if settings.extractor == "scripted":
        try:  # the recorded hand-written set, plus the approved answer keys for the other transcripts
            return ScriptedExtractor(fallbacks=key_replays(load_keys()))
        except (StopIteration, FileNotFoundError):  # a checkout without the synthetic test set
            return ScriptedExtractor()
    if settings.extractor == "claude":  # paid: set BUYERS_DESK_CLAUDE_MODEL; the spend ledger holds the US$50 cap
        return ClaudeExtractor(settings.claude_model)
    if settings.extractor == "ollama":  # local and free: Ollama must be running with the model pulled
        return OllamaExtractor(settings.ollama_model)
    raise ValueError(f"Unknown extractor {settings.extractor!r}; the choices are: scripted, claude, ollama")


def _serve_web_app(app: FastAPI) -> None:
    """`make run` serves the built front end from the same address as the API."""
    app.mount("/assets", StaticFiles(directory=BUILT_WEB_APP / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def web_app(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        return FileResponse(BUILT_WEB_APP / "index.html")
