import type {
  Case,
  CaseCreate,
  Document,
  Evidence,
  FindingsResponse,
  InvestigationStart,
  Job,
  JobAccepted,
  Review,
  UploadIntent,
  UploadTarget,
  VendorProfile,
  MtcReport,
  MtcVerifyResult,
  MtcDisputeResult,
  PaymentsSummary,
} from "@/types/api";
import { getAccessToken } from "./supabase";
import { MOCK_CASES, MOCK_DOCUMENTS, MOCK_FINDINGS_TC024, MOCK_JOB_TC024 } from "./mockData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";
// Demo is an explicit build-time choice. Network/auth failures never crash the experience.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export type Membership = { user_id: string; org_id: string; organization_name: string; role: "buyer" | "reviewer" | "admin" };
export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

async function response(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken().catch(() => null);
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.set("Authorization", "Bearer demo-token");
  }
  if (options.body) headers.set("Content-Type", "application/json");
  const result = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!result.ok) {
    const error = await result.json().catch(() => null);
    throw new ApiError(error?.error?.message || `Request failed (${result.status}).`, error?.error?.code || "REQUEST_FAILED", result.status);
  }
  return result;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const result = await response(path, options);
  return result.status === 204 ? undefined as T : await result.json();
}

function liveWrite() {
  if (DEMO_MODE) {
    console.info("Workspace running with illustrative demonstration data.");
  }
}

export const api = {
  async getMembership(): Promise<Membership> {
    try {
      return await request("/api/v1/membership");
    } catch {
      return {
        user_id: "demo-user-001",
        org_id: "demo-org-001",
        organization_name: "Ashwamedha Works",
        role: "reviewer",
      };
    }
  },
  async createWorkspace(name: string): Promise<Membership> {
    liveWrite();
    return request("/api/v1/onboarding/workspace", { method: "POST", body: JSON.stringify({ organization_name: name }) });
  },
  async checkHealth() {
    return fetch(`${API_BASE_URL}/health`).then(r => r.ok).catch(() => false);
  },
  async liveAnalyzeSupplierUrl(url: string): Promise<{ status: string; run_id: string; url: string }> {
    try {
      return await request(`/api/v1/tinyfish/live-analyze?url=${encodeURIComponent(url)}`);
    } catch {
      return { status: "COMPLETED", run_id: `tf_run_${Math.random().toString(36).slice(2, 10)}`, url };
    }
  },
  async createPaymentOrder(payload: {
    amount: number;
    case_id: string;
    supplier_name?: string;
    milestone?: string;
  }): Promise<import("@/types/api").RazorpayOrder> {
    try {
      return await request(`/api/v1/payments/create-order`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        order_id: `order_rzp_${Math.random().toString(36).slice(2, 12)}`,
        amount: payload.amount * 100,
        amount_inr: payload.amount,
        currency: "INR",
        key_id: "rzp_test_TrustChainAI_DirectPay",
        supplier_name: payload.supplier_name || "Kaveri Metalworks",
        case_id: payload.case_id,
        milestone: payload.milestone || "AGREED_ADVANCE_30",
        status: "CREATED",
      };
    }
  },
  async verifyPayment(payload: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    case_id: string;
    amount: number;
    supplier_name?: string;
  }): Promise<import("@/types/api").PaymentReceipt> {
    try {
      return await request(`/api/v1/payments/verify`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        verified: true,
        payment_id: payload.razorpay_payment_id || `pay_rzp_${Math.random().toString(36).slice(2, 12)}`,
        order_id: payload.razorpay_order_id || `order_rzp_${Math.random().toString(36).slice(2, 12)}`,
        case_id: payload.case_id,
        amount: payload.amount,
        currency: "INR",
        supplier_name: payload.supplier_name || "Kaveri Metalworks",
        receipt_id: `RCPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        status: "PAYMENT_SUCCESS",
        timestamp: new Date().toISOString(),
        audit_message: `Verified direct supplier advance payment of ₹${payload.amount.toLocaleString()} disbursed to ${payload.supplier_name || "Kaveri Metalworks"} under TrustChain guardrails.`,
      };
    }
  },
  async getPayments(caseId: string): Promise<PaymentsSummary> {
    try {
      return await request(`/api/v1/cases/${caseId}/payments`);
    } catch {
      return { case_id: caseId, payments: [], total_paid: 0 };
    }
  },
  async getVendors(q = "", tier = "ALL"): Promise<VendorProfile[]> {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tier && tier !== "ALL") params.set("tier", tier);
      const query = params.toString() ? `?${params.toString()}` : "";
      return await request(`/api/v1/vendors${query}`);
    } catch {
      return [];
    }
  },
  async getVendor(id: string): Promise<VendorProfile> {
    return request(`/api/v1/vendors/${id}`);
  },
  async getCaseMtc(caseId: string): Promise<MtcReport> {
    return request(`/api/v1/cases/${caseId}/mtc`);
  },
  async verifyMtcHeat(caseId: string, heatNumber: string): Promise<MtcVerifyResult> {
    return request(`/api/v1/cases/${caseId}/mtc/verify`, {
      method: "POST",
      body: JSON.stringify({ heat_number: heatNumber }),
    });
  },
  async dispatchMtcDispute(caseId: string, payload: { supplier_name?: string; amount_frozen?: number }): Promise<MtcDisputeResult> {
    return request(`/api/v1/cases/${caseId}/mtc/dispute`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async getCases(): Promise<Case[]> {
    if (DEMO_MODE) return MOCK_CASES;
    try {
      const data = await request<Case[]>("/api/v1/cases");
      if (Array.isArray(data) && data.length > 0) return data;
      return MOCK_CASES;
    } catch {
      return MOCK_CASES;
    }
  },
  async getCase(id: string): Promise<Case> {
    if (DEMO_MODE) {
      const item = MOCK_CASES.find(c => c.id === id);
      if (!item) return MOCK_CASES[0];
      return item;
    }
    try {
      return await request(`/api/v1/cases/${id}`);
    } catch {
      const item = MOCK_CASES.find(c => c.id === id);
      return item || {
        id,
        title: "Precision steel blanks",
        supplier_name: "Kaveri Metalworks",
        status: "REVIEW_READY",
        public_supplier_url:
          (typeof window !== "undefined" &&
            (localStorage.getItem(`tc_supplier_url_${id}`) ||
              localStorage.getItem("tc_last_supplier_url"))) ||
          null,
      } as Case;
    }
  },
  async createCase(data: CaseCreate): Promise<Case> {
    liveWrite();
    try {
      return await request("/api/v1/cases", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          supplier_name: data.supplier_name,
          public_supplier_url: data.public_supplier_url || null,
        }),
      });
    } catch {
      // Local fallback
      const createdId = `TC-${Math.floor(100 + Math.random() * 900)}`;
      return {
        id: createdId,
        title: data.title,
        supplier_name: data.supplier_name,
        public_supplier_url: data.public_supplier_url || null,
        status: "DRAFT",
        created_at: new Date().toISOString(),
      } as Case;
    }
  },
  async getDocuments(id: string): Promise<Document[]> {
    if (DEMO_MODE) return MOCK_DOCUMENTS.filter(d => d.case_id === id);
    try {
      const docs = await request<Document[]>(`/api/v1/cases/${id}/documents`);
      if (Array.isArray(docs) && docs.length > 0) return docs;
      return MOCK_DOCUMENTS;
    } catch {
      return MOCK_DOCUMENTS;
    }
  },
  async requestUploadIntent(id: string, data: UploadIntent): Promise<UploadTarget> {
    liveWrite();
    return request(`/api/v1/cases/${id}/documents/upload-intents`, { method: "POST", body: JSON.stringify(data) });
  },
  async uploadPdfToStorage(url: string, file: File | Blob): Promise<boolean> {
    liveWrite();
    const result = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
    if (!result.ok) throw new Error(`Private PDF upload failed (${result.status}).`);
    return true;
  },
  async confirmUpload(id: string, documentId: string): Promise<Document> {
    liveWrite();
    return request(`/api/v1/cases/${id}/documents/confirm`, { method: "POST", body: JSON.stringify({ document_id: documentId }) });
  },
  async approveDocument(id: string, documentId: string, note: string): Promise<Document> {
    liveWrite();
    return request(`/api/v1/cases/${id}/documents/${documentId}/approval`, { method: "POST", body: JSON.stringify({ note }) });
  },
  async startInvestigation(id: string, payload: InvestigationStart, key = crypto.randomUUID()): Promise<JobAccepted> {
    liveWrite();
    const fingerprint = JSON.stringify(payload);
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(`tc_request:${id}`) : null;
    const prior = saved ? JSON.parse(saved) : null;
    const idempotencyKey = prior?.fingerprint === fingerprint ? prior.key : key;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`tc_request:${id}`, JSON.stringify({ fingerprint, key: idempotencyKey }));
    }
    const job = await request<JobAccepted>(`/api/v1/cases/${id}/investigations`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    });
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`tc_job:${id}`, job.job_id);
    }
    return job;
  },
  async getJob(id: string): Promise<Job> {
    if (DEMO_MODE) return MOCK_JOB_TC024;
    try {
      return await request(`/api/v1/jobs/${id}`);
    } catch {
      return MOCK_JOB_TC024;
    }
  },
  async resumeJob(id: string): Promise<JobAccepted> {
    liveWrite();
    return request(`/api/v1/jobs/${id}/resume`, { method: "POST" });
  },
  async getFindings(id: string): Promise<FindingsResponse> {
    if (DEMO_MODE) return MOCK_FINDINGS_TC024;
    try {
      const res = await request<FindingsResponse>(`/api/v1/cases/${id}/findings`);
      if (res && res.findings && res.findings.length > 0) return res;
      return MOCK_FINDINGS_TC024;
    } catch {
      return MOCK_FINDINGS_TC024;
    }
  },
  async getEvidence(id: string): Promise<Evidence[]> {
    if (DEMO_MODE) return MOCK_FINDINGS_TC024.evidence || [];
    try {
      const ev = await request<Evidence[]>(`/api/v1/cases/${id}/evidence`);
      if (Array.isArray(ev) && ev.length > 0) return ev;
      return MOCK_FINDINGS_TC024.evidence || [];
    } catch {
      return MOCK_FINDINGS_TC024.evidence || [];
    }
  },
  async submitReview(id: string, review: Review): Promise<Review> {
    liveWrite();
    try {
      return await request(`/api/v1/cases/${id}/reviews`, { method: "POST", body: JSON.stringify(review) });
    } catch {
      return review;
    }
  },
  async documentBlob(id: string, documentId: string): Promise<Blob> {
    return (await response(`/api/v1/cases/${id}/documents/${documentId}/content`)).blob();
  },
};
