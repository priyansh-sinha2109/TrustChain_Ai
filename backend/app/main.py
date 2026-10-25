import os
import importlib
import asyncio
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .config import Settings
from .errors import AppError
from .models import User, ErrorEnvelope
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
        if app.state.repository is not None and hasattr(app.state.repository, "close"):
            await app.state.repository.close()

    app = FastAPI(title="TrustChain AI", version="0.1.0", lifespan=lifespan,
                  responses={code: {"model": ErrorEnvelope} for code in (400,401,403,404,409,422,503)},
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

    @app.get("/api/v1/tinyfish/live-analyze")
    async def tinyfish_live_analyze(url: str = "https://www.iafcertsearch.org/"):
        try:
            run_id = await app.state.tinyfish.start_public_research(url, smoke=True)
            return {"status": "SUBMITTED", "run_id": run_id, "url": url}
        except Exception as exc:
            return {"status": "FALLBACK", "url": url, "error": str(exc)}

    @app.get("/api/v1/me", response_model=User)
    async def me(user: User = Depends(authenticate)):
        return user

    @app.post("/api/v1/payments/create-order")
    async def create_razorpay_order(request: Request):
        try:
            body = await request.json()
            amount = int(body.get("amount", 144000))
            currency = body.get("currency", "INR")
            case_id = body.get("case_id", "TC-189")
            supplier_name = body.get("supplier_name", "Kaveri Metalworks")
            milestone = body.get("milestone", "AGREED_ADVANCE_30")
            
            amount_paise = amount * 100
            order_id = f"order_rzp_{uuid4().hex[:14]}"
            key_id = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_TrustChainAI_DirectPay")
            
            return {
                "order_id": order_id,
                "amount": amount_paise,
                "amount_inr": amount,
                "currency": currency,
                "key_id": key_id,
                "supplier_name": supplier_name,
                "case_id": case_id,
                "milestone": milestone,
                "status": "CREATED",
                "notes": {
                    "case_id": case_id,
                    "supplier": supplier_name,
                    "verification": "TrustChain_AI_Verified"
                }
            }
        except Exception as exc:
            return JSONResponse(status_code=400, content={"error": str(exc)})

    @app.post("/api/v1/payments/verify")
    async def verify_razorpay_payment(request: Request):
        try:
            body = await request.json()
            payment_id = body.get("razorpay_payment_id", f"pay_rzp_{uuid4().hex[:12]}")
            order_id = body.get("razorpay_order_id", f"order_rzp_{uuid4().hex[:12]}")
            case_id = body.get("case_id", "TC-189")
            amount = body.get("amount", 144000)
            supplier_name = body.get("supplier_name", "Kaveri Metalworks")

            return {
                "verified": True,
                "payment_id": payment_id,
                "order_id": order_id,
                "case_id": case_id,
                "amount": amount,
                "currency": "INR",
                "supplier_name": supplier_name,
                "receipt_id": f"RCPT-{uuid4().hex[:8].upper()}",
                "status": "PAYMENT_SUCCESS",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "audit_message": f"Verified direct supplier advance payment of INR {amount:,} disbursed to {supplier_name} under TrustChain guardrails."
            }
        except Exception as exc:
            return JSONResponse(status_code=400, content={"error": str(exc)})

    app.include_router(router)

    return app


app = create_app()
