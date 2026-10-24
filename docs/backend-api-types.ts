// Generated from backend-openapi.json. Do not edit by hand.
// UUIDs, dates and monetary JSON strings retain their OpenAPI string type.

export type Case = { "title": string; "supplier_name": string; "public_supplier_url"?: string | null; "id": string; "supplier_id": string; };

export type CaseCreate = { "title": string; "supplier_name": string; "public_supplier_url"?: string | null; };

export type Document = { "id": string; "case_id": string; "document_type": DocumentType; "approved"?: boolean; "content_type"?: string; "size_bytes": number; };

export type DocumentApproval = { "note": string; };

export type DocumentType = "RFQ" | "ACCEPTED_QUOTE" | "PURCHASE_ORDER" | "FINAL_PI";

export type ErrorDetail = { "code": string; "message": string; "request_id": string; };

export type ErrorEnvelope = { "error": ErrorDetail; };

export type Evidence = { "provider_run_id": string; "source_url": string; "observation": string; "captured_at": string; "provider_finished_at"?: string | null; };

export type Exposure = { "status": "CALCULATED" | "INSUFFICIENT_EVIDENCE" | "CURRENCY_MISMATCH" | "AMBIGUOUS"; "currency"?: string | null; "baseline_amount"?: string | null; "final_amount"?: string | null; "difference"?: string | null; };

export type Finding = { "field_key": string; "category": "TECHNICAL" | "COMMERCIAL" | "PUBLIC"; "status": "MATCH" | "CONFLICT" | "MISSING" | "AMBIGUOUS" | "NOT_CHECKED" | "INSUFFICIENT_EVIDENCE"; "severity": "INFO" | "WARNING" | "HIGH"; "baseline"?: Array<SourceField>; "final"?: Array<SourceField>; "explanation": string; "suggested_action"?: string; };

export type FindingsResponse = { "case_id": string; "job_id": string; "supplier_id": string; "baseline_document_id": string; "final_document_id": string; "created_at": string; "investigation_status": string; "findings": Array<Finding>; "extracted_fields"?: Array<SourceField>; "advance_exposure": Exposure; "evidence"?: Array<Evidence>; };

export type InvestigationStart = { "baseline_document_id": string; "final_document_id": string; "public_research"?: boolean; };

export type Job = { "id": string; "case_id": string; "status": "QUEUED" | "PROCESSING" | "REVIEW_READY" | "PARTIAL_REVIEW" | "FAILED" | "REVIEWED"; "stage": string; "request": InvestigationStart; "provider_run_id"?: string | null; "error_code"?: string | null; "provider_status"?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | null; "provider_finished_at"?: string | null; };

export type JobAccepted = { "job_id": string; "status": string; "poll_url": string; };

export type Membership = { "user_id": string; "org_id": string; "organization_name": string; "role": "buyer" | "reviewer" | "admin"; };

export type Review = { "job_id": string; "decision": "APPROVE" | "REQUEST_CLARIFICATION" | "REJECT"; "comment": string; };

export type SourceField = { "document_id": string; "document_type": DocumentType; "field_key": string; "value": string; "unit"?: string | null; "line_item"?: string | null; "page_number": number; "raw_text": string; };

export type UploadConfirm = { "document_id": string; };

export type UploadIntent = { "filename": string; "document_type": DocumentType; "size_bytes": number; };

export type UploadTarget = { "document_id": string; "upload_url": string; "expires_at": string; };

export type User = { "id": string; };

export type WorkspaceCreate = { "organization_name": string; };
