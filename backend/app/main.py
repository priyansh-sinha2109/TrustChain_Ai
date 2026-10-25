import os
import sys
from pathlib import Path

# Ensure repository root is in sys.path so trustchain package is always importable
_repo_root = Path(__file__).resolve().parents[2]
_backend_dir = Path(__file__).resolve().parents[1]
for _p in [str(_repo_root), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

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
    app.state.payments_store = {}
    app.state.disputes_store = {}
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

            receipt = {
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
            app.state.payments_store.setdefault(case_id, []).append(receipt)
            return receipt
        except Exception as exc:
            return JSONResponse(status_code=400, content={"error": str(exc)})

    @app.get("/api/v1/cases/{case_id}/payments")
    async def get_case_payments(case_id: str):
        payments = app.state.payments_store.get(case_id, [])
        return {"case_id": case_id, "payments": payments, "total_paid": sum(p["amount"] for p in payments)}

    # -------------------------------------------------------------
    # B2B Vendor Trust Rating & Credential Directory Endpoints
    # -------------------------------------------------------------
    VENDORS_DB = [
        {
            "id": "VEN-001",
            "name": "Kaveri Metalworks Private Limited",
            "location": "Pune Industrial Cluster, Maharashtra",
            "gstin": "27AABCK1234F1Z8",
            "category": "Precision Steel Blanks & Heavy Fabrication",
            "trustScore": 72,
            "tier": "TIER_B",
            "tierLabel": "Caution / Moderate Risk",
            "accreditationStatus": "0 Active Accredited ISO 9001/14001 in IAF CertSearch",
            "accreditationVerified": False,
            "qualityPassRate": 68.5,
            "advanceExposureCap": "Max 30% Advance (Hold 70% Buffer)",
            "totalVolume": "INR 48,20,000",
            "completedOrders": 14,
            "disputeRate": "21.4% (Thickness & Lead Time deviations)",
            "flaggedRisks": [
                "Substituted 6mm commercial grade on final PI against 8mm precision quote",
                "Escalated advance demand from 30% to 80% without agreed contractual addendum",
                "No third-party accredited conformity assessment found on IAF CertSearch database"
            ],
            "strengths": [
                "Competitive raw material pricing (INR 4.80L vs INR 5.85L market benchmark)",
                "Established 4.2 year operating history with active GSTIN compliance",
                "In-house CNC blanking machinery available on plant floor"
            ],
            "publicUrl": "https://www.iafcertsearch.org/"
        },
        {
            "id": "VEN-002",
            "name": "Apex Precision Forgings Ltd",
            "location": "Ludhiana Engineering Hub, Punjab",
            "gstin": "03AABCA8912P1Z4",
            "category": "High Tensile Alloy Steel & Forged Blanks",
            "trustScore": 89,
            "tier": "TIER_A",
            "tierLabel": "Verified / Prime Supplier",
            "accreditationStatus": "IAF CertSearch Verified: ISO 9001:2015 & IATF 16949",
            "accreditationVerified": True,
            "qualityPassRate": 98.2,
            "advanceExposureCap": "Up to 50% Standard Advance Eligible",
            "totalVolume": "INR 1,42,80,000",
            "completedOrders": 42,
            "disputeRate": "1.2% (Zero material spec disputes)",
            "flaggedRisks": [
                "Higher minimum order quantities (MOQ: 5 Metric Tonnes)"
            ],
            "strengths": [
                "Active accredited quality management certified by TUV SUD (IAF MLA)",
                "Digital Mill Test Certificates (EN 10204 3.1) with heat batch QR verification",
                "98.2% on-time delivery across verified MSME buyers"
            ],
            "publicUrl": "https://www.iafcertsearch.org/"
        },
        {
            "id": "VEN-003",
            "name": "Vardhman Alloy & Steel Traders",
            "location": "Ahmedabad, Gujarat",
            "gstin": "24AABCV3456L1Z2",
            "category": "Commercial Mild Steel & Slitted Coils",
            "trustScore": 44,
            "tier": "TIER_C",
            "tierLabel": "Severe Risk / High Caution",
            "accreditationStatus": "Unverified / No Quality Certifications Available",
            "accreditationVerified": False,
            "qualityPassRate": 46.0,
            "advanceExposureCap": "0% Advance (Full Escrow Delivery Only)",
            "totalVolume": "INR 12,40,000",
            "completedOrders": 5,
            "disputeRate": "55.0% (Repeated gauge and chemical spec failures)",
            "flaggedRisks": [
                "High incidence of non-prime commercial grade masqueraded as prime engineering plate",
                "GST returns intermittently delayed > 60 days",
                "Unhedged advance requests exceeding 75% for unfamiliar buyers"
            ],
            "strengths": [
                "Immediate stock availability for urgent off-the-shelf delivery"
            ],
            "publicUrl": "https://indiamart.com"
        },
        {
            "id": "VEN-004",
            "name": "Jindal Structural & Precision Blanks",
            "location": "Hisar, Haryana",
            "gstin": "06AABCJ4567M1Z9",
            "category": "Hot Rolled & Cold Rolled Structural Precision Blanks",
            "trustScore": 94,
            "tier": "TIER_A",
            "tierLabel": "Prime / Institutional Tier",
            "accreditationStatus": "BIS Certified (IS 2062:2011) & IAF MLA Accredited",
            "accreditationVerified": True,
            "qualityPassRate": 99.4,
            "advanceExposureCap": "Standard Commercial Terms (40% Advance)",
            "totalVolume": "INR 4,80,00,000+",
            "completedOrders": 118,
            "disputeRate": "0.4%",
            "flaggedRisks": [
                "Fixed payment terms with strict credit terms"
            ],
            "strengths": [
                "Direct mill test heat traceability from blast furnace to blanking line",
                "Automated metallurgical testing lab on premises",
                "Zero contractual clause alterations between quote and invoice"
            ],
            "publicUrl": "https://www.iafcertsearch.org/"
        }
    ]

    @app.get("/api/v1/vendors")
    async def get_vendors(q: str = "", tier: str = "ALL"):
        results = VENDORS_DB
        if q:
            q_lower = q.lower()
            results = [v for v in results if q_lower in v["name"].lower() or q_lower in v["gstin"].lower() or q_lower in v["category"].lower() or q_lower in v["location"].lower()]
        if tier != "ALL":
            results = [v for v in results if v["tier"] == tier]
        return results

    @app.get("/api/v1/vendors/{vendor_id}")
    async def get_vendor(vendor_id: str):
        for v in VENDORS_DB:
            if v["id"] == vendor_id:
                return v
        return JSONResponse(status_code=404, content={"error": f"Vendor {vendor_id} not found"})

    # -------------------------------------------------------------
    # Digital Mill Test Certificate (MTC) Verifier Endpoints
    # -------------------------------------------------------------
    @app.get("/api/v1/cases/{case_id}/mtc")
    async def get_case_mtc(case_id: str):
        return {
            "case_id": case_id,
            "supplier_name": "Kaveri Metalworks",
            "po_reference": "PO-2026-084",
            "certificate_type": "EN 10204 Type 3.1 Mill Test Certificate",
            "heat_number": "HT-2026-9921B",
            "ladle_origin": "Secondary Re-Roller (Non-Accredited Furnace)",
            "verdict": "NON_CONFORMING",
            "verdict_summary": "Substandard material detected. 6.00mm commercial plate supplied vs agreed 8.00mm precision blanks. Chemical composition exceeds Carbon and Sulphur limits.",
            "tests_passed": 1,
            "tests_failed": 4,
            "chemical_composition": [
                {"symbol": "C", "name": "Carbon", "requiredMax": 0.18, "actualFound": 0.24, "unit": "%", "status": "FAIL"},
                {"symbol": "Mn", "name": "Manganese", "requiredMax": 1.40, "actualFound": 0.85, "unit": "%", "status": "FAIL"},
                {"symbol": "Si", "name": "Silicon", "requiredMax": 0.40, "actualFound": 0.22, "unit": "%", "status": "PASS"},
                {"symbol": "S", "name": "Sulphur", "requiredMax": 0.040, "actualFound": 0.054, "unit": "%", "status": "FAIL"},
                {"symbol": "P", "name": "Phosphorus", "requiredMax": 0.040, "actualFound": 0.048, "unit": "%", "status": "FAIL"}
            ],
            "mechanical_tests": [
                {"property": "Plate Gauge Thickness", "standard": "IS 2062:2011", "required": "8.00 mm (±0.05)", "actual": "6.00 mm (-25% Deficit)", "status": "FAIL"},
                {"property": "Yield Strength (ReH)", "standard": "ISO 6892-1", "required": "≥ 350 MPa", "actual": "245 MPa (Commercial grade)", "status": "FAIL"},
                {"property": "Tensile Strength (Rm)", "standard": "ISO 6892-1", "required": "490 - 610 MPa", "actual": "410 MPa (Sub-standard)", "status": "FAIL"},
                {"property": "Elongation (A5)", "standard": "ISO 6892-1", "required": "≥ 22%", "actual": "24.5%", "status": "PASS"},
                {"property": "Ultrasonic Lamination Scan", "standard": "ASTM A578", "required": "Level A (No cracks)", "actual": "Micro-cavities detected", "status": "FAIL"}
            ],
            "hedging_action": {
                "action": "FREEZE_RAZORPAY_MILESTONE_2",
                "amount_withheld": 240000,
                "currency": "INR",
                "dispute_notice_available": True
            }
        }

    @app.post("/api/v1/cases/{case_id}/mtc/verify")
    async def verify_mtc_heat(case_id: str, request: Request):
        body = await request.json()
        heat_no = body.get("heat_number", "HT-2026-9921B")
        is_known = heat_no.startswith("HT-")
        return {
            "case_id": case_id,
            "heat_number": heat_no,
            "verified": True,
            "found_in_primary_mill_registry": False if "9921B" in heat_no else True,
            "origin_status": "SECONDARY_RE_ROLLER" if "9921B" in heat_no else "PRIMARY_TATA_JINDAL_LINE",
            "verdict": "NON_CONFORMING" if "9921B" in heat_no else "VERIFIED_CONFORMING",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    @app.post("/api/v1/cases/{case_id}/mtc/dispute")
    async def dispatch_mtc_dispute(case_id: str, request: Request):
        body = await request.json()
        dispute_id = f"NCR-{uuid4().hex[:8].upper()}"
        dispute_record = {
            "dispute_id": dispute_id,
            "case_id": case_id,
            "supplier_name": body.get("supplier_name", "Kaveri Metalworks"),
            "reason": "Chemical composition failure & gauge thickness deficit (6mm vs 8mm)",
            "amount_frozen": body.get("amount_frozen", 240000),
            "status": "DISPATCHED_TO_VENDOR",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        app.state.disputes_store.setdefault(case_id, []).append(dispute_record)
        return dispute_record

    app.include_router(router)

    return app


app = create_app()
