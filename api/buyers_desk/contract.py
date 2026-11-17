"""The API contract around the resources: a versioned prefix, self-description, stable error codes,
idempotent creates and token authentication for external callers."""
import hashlib
import hmac
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

router = APIRouter(prefix="/api/v1", tags=["api"])

CODES = {400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed", 409: "conflict", 422: "validation_error"}
OPEN_PATHS = {"/api/v1", "/api/v1/health"}


@router.get("")
def describe(request: Request) -> dict[str, Any]:
    tokens = request.app.state.settings.api_tokens
    return {"name": "Buyers desk API", "version": "v1", "openapi_url": "/openapi.json", "docs_url": "/docs", "auth": "bearer" if tokens else "none"}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _error(status: int, detail: Any, code: str | None = None, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail, "code": code or CODES.get(status, "error")}, headers=headers)


class ContractMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if not path.startswith("/api/v1") or path in OPEN_PATHS:
            return await call_next(request)
        settings = request.app.state.settings
        if settings.api_tokens:
            header = request.headers.get("authorization", "")
            given = header[7:] if header.lower().startswith("bearer ") else ""
            if not any(hmac.compare_digest(given.encode(), t.encode()) for t in settings.api_tokens):
                return _error(401, "A valid bearer token is required", headers={"WWW-Authenticate": "Bearer"})
        key = request.headers.get("idempotency-key")
        if request.method != "POST" or not key or settings.agency_id is None:
            return await call_next(request)

        body = await request.body()
        digest = hashlib.sha256(f"{request.method} {path}?{request.url.query}\n".encode() + body).hexdigest()
        engine = request.app.state.engine
        with engine.begin() as conn:
            conn.execute(text("SELECT set_config('app.agency_id', :a, true)"), {"a": str(settings.agency_id)})
            saved = conn.execute(
                text("SELECT request_hash, status_code, response_body, content_type FROM idempotency_keys WHERE key = :k"), {"k": key}
            ).mappings().first()
        if saved:
            if saved["request_hash"] != digest:
                return _error(422, "That Idempotency-Key was already used for a different request", "idempotency_key_reuse")
            return Response(saved["response_body"], status_code=saved["status_code"], media_type=saved["content_type"], headers={"Idempotent-Replay": "true"})

        response = await call_next(request)
        content = b"".join([chunk async for chunk in response.body_iterator])  # type: ignore[attr-defined]
        if response.status_code < 500:
            with engine.begin() as conn:
                conn.execute(text("SELECT set_config('app.agency_id', :a, true)"), {"a": str(settings.agency_id)})
                conn.execute(
                    text(
                        "INSERT INTO idempotency_keys (agency_id, key, request_hash, status_code, response_body, content_type) "
                        "VALUES (:a, :k, :h, :s, :b, :c) ON CONFLICT DO NOTHING"
                    ),
                    {"a": settings.agency_id, "k": key, "h": digest, "s": response.status_code, "b": content.decode(), "c": response.media_type or "application/json"},
                )
        headers = {k: v for k, v in response.headers.items() if k.lower() not in ("content-length",)}
        return Response(content, status_code=response.status_code, headers=headers, media_type=response.media_type)


def install(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(exc.status_code, exc.detail, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error(422, jsonable_encoder(exc.errors()))

    app.add_middleware(ContractMiddleware)
    app.include_router(router)

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title, version="1.0.0", routes=app.routes,
            description=(
                "The buyers-agent product API, version 1. Resources are agency-scoped. Lists take `limit` (1 to 200) and "
                "`offset` and return `X-Total-Count`. Creates accept an `Idempotency-Key` header. Errors are "
                "`{detail, code}`. When tokens are configured, send `Authorization: Bearer <token>`."
            ),
        )
        schema.setdefault("components", {}).setdefault("securitySchemes", {})["bearerAuth"] = {"type": "http", "scheme": "bearer"}
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi  # type: ignore[method-assign]
