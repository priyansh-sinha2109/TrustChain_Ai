import importlib
import asyncio
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .config import Settings
from .errors import AppError
from .models import User
from .security import authenticate
from .routes import router
from .tinyfish import TinyFish


def create_app(settings: Settings | None = None, repository=None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        if app.state.repository is None and settings.repository_factory:
            module, name = settings.repository_factory.split(":", 1)
            app.state.repository = await getattr(importlib.import_module(module), name)(settings)
        yield

    app = FastAPI(title="TrustChain AI", version="0.1.0", lifespan=lifespan,
                  docs_url="/docs" if settings.environment == "development" else None,
                  openapi_url="/openapi.json" if settings.environment == "development" else None,
                  redoc_url=None)
    app.state.settings, app.state.repository = settings, repository
    app.state.tinyfish = TinyFish(settings)
    app.state.processing_slots = asyncio.Semaphore(2)
    app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin],
                       allow_methods=["GET", "POST"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key"])

    @app.middleware("http")
    async def request_id(request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    def error(request, code, message, status):
        return JSONResponse(status_code=status, content={"error": {
            "code": code, "message": message,
            "request_id": getattr(request.state, "request_id", "unavailable")}})

    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError):
        return error(request, exc.code, exc.message, exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return error(request, "INVALID_INPUT", "Request does not match the API contract.", 422)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(request, "HTTP_ERROR", "Request could not be completed.", exc.status_code)

    @app.exception_handler(Exception)
    async def unavailable(request, exc):
        logging.getLogger(__name__).error("Request %s failed (%s)",
            getattr(request.state, "request_id", "unavailable"), type(exc).__name__)
        return error(request, "SERVICE_UNAVAILABLE", "The operation could not be completed.", 503)

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "trustchain-backend"}

    @app.get("/api/v1/me", response_model=User)
    async def me(user: User = Depends(authenticate)):
        return user

    app.include_router(router)

    return app


app = create_app()
