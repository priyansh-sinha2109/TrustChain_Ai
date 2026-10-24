// Authoritative API types matching docs/backend-api-types.ts and backend-openapi.json

export type DocumentType = "RFQ" | "ACCEPTED_QUOTE" | "PURCHASE_ORDER" | "FINAL_PI";

export type Case = {
  id: string;
  title: string;
  supplier_name: string;
  public_supplier_url?: string | null;
  supplier_id: string;
  status?: string;
  created_at?: string;
  reference_no?: string;
  order_value_inr?: number;
};

export type CaseCreate = {
  title: string;
  supplier_name: string;
  public_supplier_url?: string | null;
  reference_no?: string;
  order_value_inr?: number;
  category?: string;
  reviewer_name?: string;
  notes?: string;
};

export type Document = {
  id: string;
  case_id: string;
  document_type: DocumentType;
  approved?: boolean;
  content_type?: string;
  size_bytes: number;
  filename?: string;
  page_count?: number;
  created_at?: string;
};

export type DocumentApproval = {
  note: string;
};

export type UploadIntent = {
  filename: string;
  document_type: DocumentType;
  size_bytes: number;
};

export type UploadTarget = {
  document_id: string;
  upload_url: string;
  expires_at: string;
};

export type UploadConfirm = {
  document_id: string;
};

export type InvestigationStart = {
  baseline_document_id: string;
  final_document_id: string;
  public_research?: boolean;
};

export type JobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "REVIEW_READY"
  | "PARTIAL_REVIEW"
  | "FAILED"
  | "REVIEWED";

export type Job = {
  id: string;
  case_id: string;
  status: JobStatus;
  stage: string;
  request: InvestigationStart;
  provider_run_id?: string | null;
  error_code?: string | null;
  provider_status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | null;
  provider_finished_at?: string | null;
  created_at?: string;
};

export type JobAccepted = {
  job_id: string;
  status: string;
  poll_url: string;
};

export type SourceField = {
  document_id: string;
  document_type: DocumentType;
  field_key: string;
  value: string;
  unit?: string | null;
  line_item?: string | null;
  page_number: number;
  raw_text: string;
};

export type FindingStatus =
  | "MATCH"
  | "CONFLICT"
  | "MISSING"
  | "AMBIGUOUS"
  | "NOT_CHECKED"
  | "INSUFFICIENT_EVIDENCE";

export type FindingSeverity = "INFO" | "WARNING" | "HIGH";

export type Finding = {
  field_key: string;
  label?: string;
  category: "TECHNICAL" | "COMMERCIAL" | "PUBLIC";
  status: FindingStatus;
  severity: FindingSeverity;
  baseline?: Array<SourceField>;
  final?: Array<SourceField>;
  explanation: string;
  suggested_action?: string;
  financial_impact_inr?: string;
};

export type ExposureStatus =
  | "CALCULATED"
  | "INSUFFICIENT_EVIDENCE"
  | "CURRENCY_MISMATCH"
  | "AMBIGUOUS";

export type Exposure = {
  status: ExposureStatus;
  currency?: string | null;
  baseline_amount?: string | null;
  final_amount?: string | null;
  difference?: string | null;
  baseline_percentage?: number | null;
  final_percentage?: number | null;
  order_value?: string | null;
};

export type Evidence = {
  provider_run_id: string;
  source_url: string;
  observation: string;
  captured_at: string;
  provider_finished_at?: string | null;
  status?: "OBSERVED" | "NOT_CHECKED" | "INSUFFICIENT_EVIDENCE" | "FAILED";
};

export type FindingsResponse = {
  case_id: string;
  job_id: string;
  supplier_id: string;
  baseline_document_id: string;
  final_document_id: string;
  created_at: string;
  investigation_status: string;
  findings: Array<Finding>;
  extracted_fields?: Array<SourceField>;
  advance_exposure: Exposure;
  evidence?: Array<Evidence>;
};

export type ReviewDecision = "APPROVE" | "REQUEST_CLARIFICATION" | "REJECT";

export type Review = {
  job_id: string;
  decision: ReviewDecision;
  comment: string;
  reviewer_name?: string;
  created_at?: string;
};

export type ErrorDetail = {
  code: string;
  message: string;
  request_id: string;
};

export type ErrorEnvelope = {
  error: ErrorDetail;
};

export type User = {
  id: string;
  email?: string;
  role?: "buyer" | "reviewer" | "admin";
  org_id?: string;
  org_name?: string;
};
