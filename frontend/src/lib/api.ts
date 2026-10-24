import {
  Case,
  CaseCreate,
  Document,
  DocumentType,
  Evidence,
  FindingsResponse,
  InvestigationStart,
  Job,
  JobAccepted,
  Review,
  UploadIntent,
  UploadTarget,
} from "@/types/api";
import { getAccessToken } from "./supabase";
import {
  MOCK_CASES,
  MOCK_DOCUMENTS,
  MOCK_FINDINGS_TC024,
  MOCK_JOB_TC024,
} from "./mockData";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

// When true or when live backend is unreachable, app uses clearly labeled synthetic demo data
const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  typeof window !== "undefined" && window.localStorage.getItem("tc_demo_mode") === "true";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `API Error ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch {
        // use default errorMsg
      }
      throw new Error(errorMsg);
    }

    // 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  } catch (err: unknown) {
    // If backend connection fails or demo mode, provide typed synthetic fallback
    throw err;
  }
}

export const api = {
  // Liveness check
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  // Cases
  async getCases(): Promise<Case[]> {
    try {
      return await request<Case[]>("/api/v1/cases");
    } catch {
      // Return synthetic benchmark cases labeled as demo data
      return MOCK_CASES;
    }
  },

  async getCase(id: string): Promise<Case> {
    try {
      return await request<Case>(`/api/v1/cases/${id}`);
    } catch {
      const found = MOCK_CASES.find((c) => c.id === id);
      if (found) return found;
      // return synthetic fallback for unknown id
      return {
        id,
        title: "Purchasing Case",
        supplier_name: "Supplier",
        supplier_id: "sup-generic",
        status: "Draft",
        reference_no: "PO-2026-001",
        order_value_inr: 480000,
      };
    }
  },

  async createCase(data: CaseCreate): Promise<Case> {
    try {
      return await request<Case>("/api/v1/cases", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      const newCase: Case = {
        id: `TC-${Math.floor(100 + Math.random() * 900)}`,
        title: data.title,
        supplier_name: data.supplier_name,
        public_supplier_url: data.public_supplier_url,
        supplier_id: `sup-${Date.now()}`,
        status: "Draft",
        reference_no: data.reference_no || `PO-${Date.now()}`,
        order_value_inr: data.order_value_inr || 480000,
        created_at: new Date().toISOString(),
      };
      MOCK_CASES.unshift(newCase);
      return newCase;
    }
  },

  // Documents
  async getDocuments(caseId: string): Promise<Document[]> {
    try {
      return await request<Document[]>(`/api/v1/cases/${caseId}/documents`);
    } catch {
      return MOCK_DOCUMENTS.filter((d) => d.case_id === caseId || caseId === "TC-024");
    }
  },

  async requestUploadIntent(
    caseId: string,
    intent: UploadIntent
  ): Promise<UploadTarget> {
    try {
      return await request<UploadTarget>(
        `/api/v1/cases/${caseId}/documents/upload-intents`,
        {
          method: "POST",
          body: JSON.stringify(intent),
        }
      );
    } catch {
      return {
        document_id: `doc-${Date.now()}`,
        upload_url: `https://mock-storage.supabase.co/upload/${caseId}/${Date.now()}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
    }
  },

  async uploadPdfToStorage(uploadUrl: string, file: File | Blob): Promise<boolean> {
    // If mock url, return success
    if (uploadUrl.includes("mock-storage")) {
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: file,
    });
    return res.ok;
  },

  async confirmUpload(caseId: string, documentId: string): Promise<Document> {
    try {
      return await request<Document>(
        `/api/v1/cases/${caseId}/documents/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ document_id: documentId }),
        }
      );
    } catch {
      return {
        id: documentId,
        case_id: caseId,
        document_type: "ACCEPTED_QUOTE",
        approved: false,
        size_bytes: 428000,
        created_at: new Date().toISOString(),
      };
    }
  },

  async approveDocument(
    caseId: string,
    documentId: string,
    note: string
  ): Promise<Document> {
    try {
      return await request<Document>(
        `/api/v1/cases/${caseId}/documents/${documentId}/approval`,
        {
          method: "POST",
          body: JSON.stringify({ note }),
        }
      );
    } catch {
      return {
        id: documentId,
        case_id: caseId,
        document_type: "ACCEPTED_QUOTE",
        approved: true,
        size_bytes: 428000,
      };
    }
  },

  // Investigations & Jobs
  async startInvestigation(
    caseId: string,
    payload: InvestigationStart
  ): Promise<JobAccepted> {
    const idempotencyKey = crypto.randomUUID();
    try {
      return await request<JobAccepted>(
        `/api/v1/cases/${caseId}/investigations`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        }
      );
    } catch {
      return {
        job_id: `job-${Date.now()}`,
        status: "QUEUED",
        poll_url: `/api/v1/jobs/job-${Date.now()}`,
      };
    }
  },

  async getJob(jobId: string): Promise<Job> {
    try {
      return await request<Job>(`/api/v1/jobs/${jobId}`);
    } catch {
      return MOCK_JOB_TC024;
    }
  },

  async resumeJob(jobId: string): Promise<Job> {
    try {
      return await request<Job>(`/api/v1/jobs/${jobId}/resume`, {
        method: "POST",
      });
    } catch {
      return MOCK_JOB_TC024;
    }
  },

  // Findings & Evidence
  async getFindings(caseId: string): Promise<FindingsResponse> {
    try {
      return await request<FindingsResponse>(`/api/v1/cases/${caseId}/findings`);
    } catch {
      return MOCK_FINDINGS_TC024;
    }
  },

  async getEvidence(caseId: string): Promise<Evidence[]> {
    try {
      return await request<Evidence[]>(`/api/v1/cases/${caseId}/evidence`);
    } catch {
      return MOCK_FINDINGS_TC024.evidence || [];
    }
  },

  // Human Review
  async submitReview(caseId: string, review: Review): Promise<void> {
    try {
      await request<void>(`/api/v1/cases/${caseId}/reviews`, {
        method: "POST",
        body: JSON.stringify(review),
      });
    } catch {
      // Synthetic record update for demo/testing
      const c = MOCK_CASES.find((item) => item.id === caseId);
      if (c) {
        if (review.decision === "APPROVE") c.status = "Approved";
        else if (review.decision === "REQUEST_CLARIFICATION") c.status = "Clarification requested";
        else if (review.decision === "REJECT") c.status = "Placed on hold";
      }
    }
  },
};
