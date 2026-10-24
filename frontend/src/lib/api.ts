import type { Case, CaseCreate, Document, Evidence, FindingsResponse, InvestigationStart, Job, JobAccepted, Review, UploadIntent, UploadTarget } from "@/types/api";
import { getAccessToken } from "./supabase";
import { MOCK_CASES, MOCK_DOCUMENTS, MOCK_FINDINGS_TC024, MOCK_JOB_TC024 } from "./mockData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";
// Demo is an explicit build-time choice. Network/auth failures never enable it.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

async function response(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to access this workspace.");
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");
  const result = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!result.ok) {
    const error = await result.json().catch(() => null);
    throw new Error(error?.error?.message || `Request failed (${result.status}).`);
  }
  return result;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const result = await response(path, options);
  return result.status === 204 ? undefined as T : await result.json();
}

function liveWrite() {
  if (DEMO_MODE) throw new Error("The illustrative workspace is read-only. Use a live workspace to save changes.");
}

export const api = {
  async checkHealth() { return fetch(`${API_BASE_URL}/health`).then(r => r.ok).catch(() => false); },
  async getCases(): Promise<Case[]> { return DEMO_MODE ? MOCK_CASES : request("/api/v1/cases"); },
  async getCase(id: string): Promise<Case> {
    if (DEMO_MODE) {
      const item = MOCK_CASES.find(c => c.id === id);
      if (!item) throw new Error("Illustrative case not found.");
      return item;
    }
    return request(`/api/v1/cases/${id}`);
  },
  async createCase(data: CaseCreate): Promise<Case> {
    liveWrite();
    return request("/api/v1/cases", { method: "POST", body: JSON.stringify({
      title: data.title, supplier_name: data.supplier_name, public_supplier_url: data.public_supplier_url || null,
    }) });
  },
  async getDocuments(id: string): Promise<Document[]> { return DEMO_MODE ? MOCK_DOCUMENTS.filter(d => d.case_id === id) : request(`/api/v1/cases/${id}/documents`); },
  async requestUploadIntent(id: string, data: UploadIntent): Promise<UploadTarget> {
    liveWrite(); return request(`/api/v1/cases/${id}/documents/upload-intents`, { method: "POST", body: JSON.stringify(data) });
  },
  async uploadPdfToStorage(url: string, file: File | Blob): Promise<boolean> {
    liveWrite();
    const result = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
    if (!result.ok) throw new Error(`Private PDF upload failed (${result.status}).`);
    return true;
  },
  async confirmUpload(id: string, documentId: string): Promise<Document> {
    liveWrite(); return request(`/api/v1/cases/${id}/documents/confirm`, { method: "POST", body: JSON.stringify({ document_id: documentId }) });
  },
  async approveDocument(id: string, documentId: string, note: string): Promise<Document> {
    liveWrite(); return request(`/api/v1/cases/${id}/documents/${documentId}/approval`, { method: "POST", body: JSON.stringify({ note }) });
  },
  async startInvestigation(id: string, payload: InvestigationStart, key = crypto.randomUUID()): Promise<JobAccepted> {
    liveWrite();
    const fingerprint = JSON.stringify(payload);
    const saved = sessionStorage.getItem(`tc_request:${id}`);
    const prior = saved ? JSON.parse(saved) : null;
    const idempotencyKey = prior?.fingerprint === fingerprint ? prior.key : key;
    sessionStorage.setItem(`tc_request:${id}`, JSON.stringify({ fingerprint, key: idempotencyKey }));
    const job = await request<JobAccepted>(`/api/v1/cases/${id}/investigations`, { method: "POST",
      headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(payload) });
    sessionStorage.setItem(`tc_job:${id}`, job.job_id);
    return job;
  },
  async getJob(id: string): Promise<Job> { return DEMO_MODE ? MOCK_JOB_TC024 : request(`/api/v1/jobs/${id}`); },
  async resumeJob(id: string): Promise<JobAccepted> { liveWrite(); return request(`/api/v1/jobs/${id}/resume`, { method: "POST" }); },
  async getFindings(id: string): Promise<FindingsResponse> { return DEMO_MODE ? MOCK_FINDINGS_TC024 : request(`/api/v1/cases/${id}/findings`); },
  async getEvidence(id: string): Promise<Evidence[]> { return DEMO_MODE ? MOCK_FINDINGS_TC024.evidence || [] : request(`/api/v1/cases/${id}/evidence`); },
  async submitReview(id: string, review: Review): Promise<Review> {
    liveWrite(); return request(`/api/v1/cases/${id}/reviews`, { method: "POST", body: JSON.stringify(review) });
  },
  async documentBlob(id: string, documentId: string): Promise<Blob> {
    return (await response(`/api/v1/cases/${id}/documents/${documentId}/content`)).blob();
  },
};
