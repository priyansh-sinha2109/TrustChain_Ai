"""
TrustChain AI — Reusable Supabase Repository & Evidence Persistence Layer
Role: Member 3 (Supabase Architecture, Data Persistence, Security & Audit)

Provides reusable data operations for Member 1 (FastAPI backend) with:
1. Multi-tenant security context validation on every operation
2. Strict type safety and Decimal financial precision
3. Automatic append-only audit event logging
4. Support for remote Supabase persistence with in-memory fallback for testing
"""

from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
import uuid

from trustchain.database.models import (
    Organization,
    OrganizationMember,
    Supplier,
    PurchaseCase,
    CaseSupplier,
    Document,
    DealVersion,
    PublicResearchRun,
    EvidenceSource,
    Claim,
    Finding,
    DealChange,
    DealChangeReview,
    ReviewDecision,
    AuditEvent,
    CaseStatusEnum,
    DocTypeEnum,
    DocStatusEnum,
    DealStageEnum,
    ResearchStatusEnum,
    EvidenceKindEnum,
    VerificationStatusEnum,
    SeverityEnum,
    ChangeCategoryEnum,
    ChangeStatusEnum,
    ReviewActionEnum,
    DecisionEnum,
    to_decimal,
)
from trustchain.database.security import TenantSecurityContext, TenantAuthorizer
from trustchain.database.client import SupabaseRestClient, SupabaseClientConfig


class SupabaseRepository:
    """
    Data Persistence and Evidence Repository.
    Exposes stable public contracts for FastAPI orchestration and Next.js APIs.
    """

    def __init__(
        self,
        client: Optional[SupabaseRestClient] = None,
        in_memory_mode: bool = False,
    ):
        self.client = client or SupabaseRestClient()
        self.in_memory_mode = in_memory_mode or not self.client.config.is_configured

        # In-memory storage tables for deterministic offline testing
        self._orgs: Dict[uuid.UUID, Organization] = {}
        self._members: Dict[uuid.UUID, OrganizationMember] = {}
        self._suppliers: Dict[uuid.UUID, Supplier] = {}
        self._cases: Dict[uuid.UUID, PurchaseCase] = {}
        self._case_suppliers: Dict[uuid.UUID, CaseSupplier] = {}
        self._documents: Dict[uuid.UUID, Document] = {}
        self._deal_versions: Dict[uuid.UUID, DealVersion] = {}
        self._research_runs: Dict[uuid.UUID, PublicResearchRun] = {}
        self._evidence_sources: Dict[uuid.UUID, EvidenceSource] = {}
        self._claims: Dict[uuid.UUID, Claim] = {}
        self._findings: Dict[uuid.UUID, Finding] = {}
        self._deal_changes: Dict[uuid.UUID, DealChange] = {}
        self._deal_change_reviews: Dict[uuid.UUID, DealChangeReview] = {}
        self._review_decisions: Dict[uuid.UUID, ReviewDecision] = {}
        self._audit_events: List[AuditEvent] = []

    # --------------------------------------------------------------------------
    # 1. Purchase Cases
    # --------------------------------------------------------------------------
    def create_purchase_case(
        self,
        context: TenantSecurityContext,
        title: str,
        case_number: str,
        target_item: Optional[str] = None,
        target_quantity: Optional[Union[Decimal, int, float]] = None,
        currency: str = "INR",
        case_id: Optional[uuid.UUID] = None,
    ) -> PurchaseCase:
        """Creates a new purchasing investigation belonging to the caller's organization."""
        TenantAuthorizer.verify_role_permission(context, ["buyer", "admin"], "create purchase cases")

        cid = case_id or uuid.uuid4()
        qty = to_decimal(target_quantity) if target_quantity is not None else None

        case = PurchaseCase(
            id=cid,
            org_id=context.org_id,
            case_number=case_number,
            title=title,
            status=CaseStatusEnum.DRAFT,
            currency=currency.upper(),
            target_item=target_item,
            target_quantity=qty,
            created_by=context.user_id,
        )

        if self.in_memory_mode:
            self._cases[cid] = case
        else:
            self.client.post("purchase_cases", {
                "id": str(cid),
                "org_id": str(context.org_id),
                "case_number": case_number,
                "title": title,
                "status": CaseStatusEnum.DRAFT.value,
                "currency": currency.upper(),
                "target_item": target_item,
                "target_quantity": str(qty) if qty else None,
                "created_by": str(context.user_id),
            })

        self.append_audit_event(
            context=context,
            action="PURCHASE_CASE_CREATED",
            payload={"case_id": str(cid), "case_number": case_number, "title": title},
        )
        return case

    def get_purchase_case(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
    ) -> Optional[PurchaseCase]:
        """Retrieves a purchase case, enforcing strict tenant isolation."""
        if self.in_memory_mode:
            case = self._cases.get(case_id)
            if not case:
                return None
            TenantAuthorizer.verify_case_ownership(context, case.org_id)
            return case

        rows = self.client.get("purchase_cases", {"id": f"eq.{case_id}", "limit": "1"})
        if not rows:
            return None
        row = rows[0]
        case_org_id = uuid.UUID(row["org_id"])
        TenantAuthorizer.verify_case_ownership(context, case_org_id)

        return PurchaseCase(
            id=uuid.UUID(row["id"]),
            org_id=case_org_id,
            case_number=row["case_number"],
            title=row["title"],
            status=CaseStatusEnum(row["status"]),
            currency=row["currency"],
            target_item=row.get("target_item"),
            target_quantity=to_decimal(row.get("target_quantity")) if row.get("target_quantity") else None,
            created_by=uuid.UUID(row["created_by"]),
        )

    # --------------------------------------------------------------------------
    # 2. Suppliers
    # --------------------------------------------------------------------------
    def register_supplier(
        self,
        context: TenantSecurityContext,
        legal_name: str,
        trade_name: Optional[str] = None,
        website_url: Optional[str] = None,
        gstin: Optional[str] = None,
        pan: Optional[str] = None,
        contact_email: Optional[str] = None,
        supplier_id: Optional[uuid.UUID] = None,
    ) -> Supplier:
        """Registers a candidate or verified supplier under the caller's organization."""
        TenantAuthorizer.verify_role_permission(context, ["buyer", "admin"], "register suppliers")

        sid = supplier_id or uuid.uuid4()
        supplier = Supplier(
            id=sid,
            org_id=context.org_id,
            legal_name=legal_name,
            trade_name=trade_name,
            website_url=website_url,
            gstin=gstin,
            pan=pan,
            contact_email=contact_email,
        )

        if self.in_memory_mode:
            self._suppliers[sid] = supplier
        else:
            self.client.post("suppliers", {
                "id": str(sid),
                "org_id": str(context.org_id),
                "legal_name": legal_name,
                "trade_name": trade_name,
                "website_url": website_url,
                "gstin": gstin,
                "pan": pan,
                "contact_email": contact_email,
            })

        self.append_audit_event(
            context=context,
            action="SUPPLIER_REGISTERED",
            payload={"supplier_id": str(sid), "legal_name": legal_name},
        )
        return supplier

    def attach_supplier_to_case(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
        supplier_id: uuid.UUID,
        is_primary: bool = True,
    ) -> CaseSupplier:
        """Links a supplier to a purchase case with same-org verification."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            raise ValueError(f"Purchase case {case_id} not found.")

        cs_id = uuid.uuid4()
        mapping = CaseSupplier(id=cs_id, case_id=case_id, supplier_id=supplier_id, is_primary=is_primary)

        if self.in_memory_mode:
            self._case_suppliers[cs_id] = mapping
        else:
            self.client.post("case_suppliers", {
                "id": str(cs_id),
                "case_id": str(case_id),
                "supplier_id": str(supplier_id),
                "is_primary": is_primary,
            })

        return mapping

    # --------------------------------------------------------------------------
    # 3. Documents
    # --------------------------------------------------------------------------
    def register_document(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
        doc_type: DocTypeEnum,
        storage_key: str,
        file_name: str,
        file_size: int,
        supplier_id: Optional[uuid.UUID] = None,
        mime_type: str = "application/pdf",
        sha256: Optional[str] = None,
        document_id: Optional[uuid.UUID] = None,
    ) -> Document:
        """Registers uploaded document metadata in PostgreSQL."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            raise ValueError(f"Purchase case {case_id} not found.")

        TenantAuthorizer.verify_role_permission(context, ["buyer", "admin"], "register documents")

        did = document_id or uuid.uuid4()
        doc = Document(
            id=did,
            case_id=case_id,
            supplier_id=supplier_id,
            doc_type=doc_type,
            storage_key=storage_key,
            file_name=file_name,
            mime_type=mime_type,
            file_size=file_size,
            sha256=sha256,
            status=DocStatusEnum.UPLOADED,
        )

        if self.in_memory_mode:
            self._documents[did] = doc
        else:
            self.client.post("documents", {
                "id": str(did),
                "case_id": str(case_id),
                "supplier_id": str(supplier_id) if supplier_id else None,
                "doc_type": doc_type.value,
                "storage_key": storage_key,
                "file_name": file_name,
                "mime_type": mime_type,
                "file_size": file_size,
                "sha256": sha256,
                "status": DocStatusEnum.UPLOADED.value,
            })

        self.append_audit_event(
            context=context,
            action="DOCUMENT_REGISTERED",
            payload={"document_id": str(did), "case_id": str(case_id), "doc_type": doc_type.value, "file_name": file_name},
        )
        return doc

    def list_case_documents(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
    ) -> List[Document]:
        """Lists all registered documents for an authorized case."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            return []

        if self.in_memory_mode:
            return [d for d in self._documents.values() if d.case_id == case_id]

        rows = self.client.get("documents", {"case_id": f"eq.{case_id}"})
        return [
            Document(
                id=uuid.UUID(r["id"]),
                case_id=uuid.UUID(r["case_id"]),
                supplier_id=uuid.UUID(r["supplier_id"]) if r.get("supplier_id") else None,
                doc_type=DocTypeEnum(r["doc_type"]),
                storage_key=r["storage_key"],
                file_name=r["file_name"],
                mime_type=r.get("mime_type", "application/pdf"),
                file_size=int(r["file_size"]),
                sha256=r.get("sha256"),
                status=DocStatusEnum(r["status"]),
            )
            for r in rows
        ]

    # --------------------------------------------------------------------------
    # 4. Deal Versions (USP)
    # --------------------------------------------------------------------------
    def save_deal_version(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
        stage: DealStageEnum,
        total_amount: Union[Decimal, int, float, str],
        advance_percentage: Union[Decimal, int, float, str],
        supplier_id: Optional[uuid.UUID] = None,
        document_id: Optional[uuid.UUID] = None,
        version_no: int = 1,
        delivery_timeline_days: Optional[int] = None,
        notes: Optional[str] = None,
        deal_version_id: Optional[uuid.UUID] = None,
    ) -> DealVersion:
        """Saves an extracted commercial milestone (RFQ, Accepted Quote, Final PI)."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            raise ValueError(f"Purchase case {case_id} not found.")

        vid = deal_version_id or uuid.uuid4()
        ver = DealVersion(
            id=vid,
            case_id=case_id,
            supplier_id=supplier_id,
            document_id=document_id,
            stage=stage,
            version_no=version_no,
            total_amount=to_decimal(total_amount),
            advance_percentage=to_decimal(advance_percentage),
            delivery_timeline_days=delivery_timeline_days,
            notes=notes,
        )

        if self.in_memory_mode:
            self._deal_versions[vid] = ver
        else:
            self.client.post("deal_versions", {
                "id": str(vid),
                "case_id": str(case_id),
                "supplier_id": str(supplier_id) if supplier_id else None,
                "document_id": str(document_id) if document_id else None,
                "stage": stage.value,
                "version_no": version_no,
                "total_amount": str(ver.total_amount),
                "advance_percentage": str(ver.advance_percentage),
                "delivery_timeline_days": delivery_timeline_days,
                "notes": notes,
            })

        return ver

    # --------------------------------------------------------------------------
    # 5. TinyFish Public Research Runs
    # --------------------------------------------------------------------------
    def save_public_research_run(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
        tinyfish_run_id: str,
        target_url: str,
        status: ResearchStatusEnum,
        case_supplier_id: Optional[uuid.UUID] = None,
        raw_result: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None,
        run_id: Optional[uuid.UUID] = None,
    ) -> PublicResearchRun:
        """Persists TinyFish public web execution metadata safely (no secrets)."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            raise ValueError(f"Purchase case {case_id} not found.")

        rid = run_id or uuid.uuid4()
        run = PublicResearchRun(
            id=rid,
            case_id=case_id,
            case_supplier_id=case_supplier_id,
            tinyfish_run_id=tinyfish_run_id,
            target_url=target_url,
            status=status,
            raw_result=raw_result or {},
            error_code=error_code,
            completed_at=datetime.now(timezone.utc) if status == ResearchStatusEnum.COMPLETED else None,
        )

        if self.in_memory_mode:
            self._research_runs[rid] = run
        else:
            self.client.post("public_research_runs", {
                "id": str(rid),
                "case_id": str(case_id),
                "case_supplier_id": str(case_supplier_id) if case_supplier_id else None,
                "tinyfish_run_id": tinyfish_run_id,
                "target_url": target_url,
                "status": status.value,
                "raw_result": raw_result or {},
                "error_code": error_code,
            })

        self.append_audit_event(
            context=context,
            action="RESEARCH_RUN_RECORDED",
            payload={"tinyfish_run_id": tinyfish_run_id, "target_url": target_url, "status": status.value},
        )
        return run

    # --------------------------------------------------------------------------
    # 6. Evidence Sources
    # --------------------------------------------------------------------------
    def save_evidence_sources(
        self,
        context: TenantSecurityContext,
        sources: List[EvidenceSource],
    ) -> List[EvidenceSource]:
        """Saves immutable provenance links (PDF page references & Public URLs)."""
        for src in sources:
            case = self.get_purchase_case(context, src.case_id)
            if not case:
                raise ValueError(f"Purchase case {src.case_id} not found.")

            if self.in_memory_mode:
                self._evidence_sources[src.id] = src
            else:
                self.client.post("evidence_sources", {
                    "id": str(src.id),
                    "case_id": str(src.case_id),
                    "kind": src.kind.value,
                    "source_url": src.source_url,
                    "document_id": str(src.document_id) if src.document_id else None,
                    "page_number": src.page_number,
                    "extracted_text": src.extracted_text,
                    "verification_status": src.verification_status.value,
                    "metadata_json": src.metadata_json,
                })

        return sources

    # --------------------------------------------------------------------------
    # 7. Findings
    # --------------------------------------------------------------------------
    def save_findings(
        self,
        context: TenantSecurityContext,
        findings: List[Finding],
    ) -> List[Finding]:
        """Saves risk findings comparing quotations, final PI, and public claims."""
        for f in findings:
            case = self.get_purchase_case(context, f.case_id)
            if not case:
                raise ValueError(f"Purchase case {f.case_id} not found.")

            if self.in_memory_mode:
                self._findings[f.id] = f
            else:
                self.client.post("findings", {
                    "id": str(f.id),
                    "case_id": str(f.case_id),
                    "severity": f.severity.value,
                    "summary": f.summary,
                    "status": f.status,
                    "details": f.details,
                })

        return findings

    # --------------------------------------------------------------------------
    # 8. Deal Changes (USP Core Diffs)
    # --------------------------------------------------------------------------
    def save_deal_changes(
        self,
        context: TenantSecurityContext,
        deal_changes: List[DealChange],
    ) -> List[DealChange]:
        """Saves field-by-field differences with baseline vs final PI provenance."""
        for dc in deal_changes:
            case = self.get_purchase_case(context, dc.case_id)
            if not case:
                raise ValueError(f"Purchase case {dc.case_id} not found.")

            if dc.baseline_version_id == dc.final_version_id:
                raise ValueError("Baseline and final deal versions must differ.")

            if self.in_memory_mode:
                self._deal_changes[dc.id] = dc
            else:
                self.client.post("deal_changes", {
                    "id": str(dc.id),
                    "finding_id": str(dc.finding_id) if dc.finding_id else None,
                    "case_id": str(dc.case_id),
                    "baseline_version_id": str(dc.baseline_version_id),
                    "final_version_id": str(dc.final_version_id),
                    "field_key": dc.field_key,
                    "category": dc.category.value,
                    "before_value": dc.before_value,
                    "after_value": dc.after_value,
                    "baseline_page": dc.baseline_page,
                    "final_page": dc.final_page,
                    "financial_impact_inr": str(dc.financial_impact_inr),
                    "status": dc.status.value,
                })

        return deal_changes

    def list_deal_changes(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
    ) -> List[DealChange]:
        """Lists all detected deal changes for an authorized case."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            return []

        if self.in_memory_mode:
            return [dc for dc in self._deal_changes.values() if dc.case_id == case_id]

        rows = self.client.get("deal_changes", {"case_id": f"eq.{case_id}"})
        return [
            DealChange(
                id=uuid.UUID(r["id"]),
                finding_id=uuid.UUID(r["finding_id"]) if r.get("finding_id") else None,
                case_id=uuid.UUID(r["case_id"]),
                baseline_version_id=uuid.UUID(r["baseline_version_id"]),
                final_version_id=uuid.UUID(r["final_version_id"]),
                field_key=r["field_key"],
                category=ChangeCategoryEnum(r["category"]),
                before_value=r["before_value"],
                after_value=r["after_value"],
                baseline_page=r.get("baseline_page"),
                final_page=r.get("final_page"),
                financial_impact_inr=to_decimal(r.get("financial_impact_inr", "0.00")),
                status=ChangeStatusEnum(r["status"]),
            )
            for r in rows
        ]

    # --------------------------------------------------------------------------
    # 9. Human Review Decisions & Line-Item Actions
    # --------------------------------------------------------------------------
    def append_deal_change_review(
        self,
        context: TenantSecurityContext,
        deal_change_id: uuid.UUID,
        action: ReviewActionEnum,
        note: str,
        review_id: Optional[uuid.UUID] = None,
    ) -> DealChangeReview:
        """Appends human reviewer decision on a specific deal change (PRD v0.2 USP)."""
        TenantAuthorizer.verify_reviewer_authority(context)

        rid = review_id or uuid.uuid4()
        review = DealChangeReview(
            id=rid,
            deal_change_id=deal_change_id,
            reviewer_id=context.user_id,
            action=action,
            note=note,
        )

        if self.in_memory_mode:
            self._deal_change_reviews[rid] = review
        else:
            self.client.post("deal_change_reviews", {
                "id": str(rid),
                "deal_change_id": str(deal_change_id),
                "reviewer_id": str(context.user_id),
                "action": action.value,
                "note": note,
            })

        self.append_audit_event(
            context=context,
            action="DEAL_CHANGE_REVIEW_SUBMITTED",
            payload={"deal_change_id": str(deal_change_id), "action": action.value, "note": note},
        )
        return review

    def append_review_decision(
        self,
        context: TenantSecurityContext,
        case_id: uuid.UUID,
        decision: DecisionEnum,
        justification: str,
        decision_id: Optional[uuid.UUID] = None,
    ) -> ReviewDecision:
        """Records overall human purchasing authority decision before advance payment."""
        case = self.get_purchase_case(context, case_id)
        if not case:
            raise ValueError(f"Purchase case {case_id} not found.")

        TenantAuthorizer.verify_reviewer_authority(context)

        did = decision_id or uuid.uuid4()
        rev_dec = ReviewDecision(
            id=did,
            case_id=case_id,
            reviewer_id=context.user_id,
            decision=decision,
            justification=justification,
        )

        if self.in_memory_mode:
            self._review_decisions[did] = rev_dec
        else:
            self.client.post("review_decisions", {
                "id": str(did),
                "case_id": str(case_id),
                "reviewer_id": str(context.user_id),
                "decision": decision.value,
                "justification": justification,
            })

        self.append_audit_event(
            context=context,
            action="REVIEW_DECISION_RECORDED",
            payload={"case_id": str(case_id), "decision": decision.value, "justification": justification},
        )
        return rev_dec

    # --------------------------------------------------------------------------
    # 10. Audit Trail (Append-Only)
    # --------------------------------------------------------------------------
    def append_audit_event(
        self,
        context: TenantSecurityContext,
        action: str,
        payload: Optional[Dict[str, Any]] = None,
        event_id: Optional[uuid.UUID] = None,
    ) -> AuditEvent:
        """Appends a tamper-evident, immutable audit event."""
        eid = event_id or uuid.uuid4()
        event = AuditEvent(
            id=eid,
            org_id=context.org_id,
            actor_id=context.user_id,
            action=action,
            payload_json=payload or {},
        )

        if self.in_memory_mode:
            self._audit_events.append(event)
        else:
            self.client.post("audit_events", {
                "id": str(eid),
                "org_id": str(context.org_id),
                "actor_id": str(context.user_id),
                "action": action,
                "payload_json": payload or {},
            })

        return event

    def list_audit_events(
        self,
        context: TenantSecurityContext,
    ) -> List[AuditEvent]:
        """Lists audit events for the authenticated organization."""
        if self.in_memory_mode:
            return [e for e in self._audit_events if e.org_id == context.org_id]

        rows = self.client.get("audit_events", {"org_id": f"eq.{context.org_id}", "order": "created_at.desc"})
        return [
            AuditEvent(
                id=uuid.UUID(r["id"]),
                org_id=uuid.UUID(r["org_id"]),
                actor_id=uuid.UUID(r["actor_id"]),
                action=r["action"],
                payload_json=r.get("payload_json", {}),
            )
            for r in rows
        ]
