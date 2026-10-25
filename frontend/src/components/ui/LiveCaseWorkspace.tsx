"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "./AppShell";
import { ExposureCard } from "./ExposureCard";
import { api } from "@/lib/api";
import type { Case, Finding, FindingsResponse, Job, ReviewDecision } from "@/types/api";

type View = "progress" | "findings" | "evidence" | "review" | "reports";

export function LiveCaseWorkspace({ id, view }: { id: string; view: View }) {
  const [purchase, setPurchase] = useState<Case | null>(null);
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision>("REQUEST_CLARIFICATION");
  const [comment, setComment] = useState("");
  const [recorded, setRecorded] = useState("");

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const purchaseRecord = await api.getCase(id);
        if (disposed) return;
        setPurchase(purchaseRecord);
        if (view === "progress") {
          let jobId = new URLSearchParams(window.location.search).get("job_id") || sessionStorage.getItem(`tc_job:${id}`);
          if (!jobId) jobId = (await api.getFindings(id)).job_id;
          const current = await api.getJob(jobId);
          if (current.case_id !== id) throw new Error("This investigation belongs to a different case.");
          if (disposed) return;
          setJob(current);
          if (["QUEUED", "PROCESSING"].includes(current.status)) {
            timer = setTimeout(load, 3000);
            return;
          }
          if (current.status !== "FAILED") {
            const saved = await api.getFindings(id);
            if (saved.job_id !== current.id) throw new Error("A newer investigation is available. Open findings to view its results.");
            if (!disposed) setData(saved);
          }
        } else {
          const findings = await api.getFindings(id);
          const current = await api.getJob(findings.job_id);
          if (disposed) return;
          setData(findings);
          setJob(current);
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : "Unable to load investigation.");
      }
    }
    void load();
    return () => { disposed = true; clearTimeout(timer); };
  }, [id, view]);

  async function openSource(documentId: string) {
    try {
      const blob = await api.documentBlob(id, documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "PDF unavailable."); }
  }

  async function recordReview(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !comment.trim()) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api.submitReview(id, { job_id: data.job_id, decision, comment });
      setRecorded(saved.decision);
      setJob(previous => previous ? { ...previous, status: "REVIEWED" } : previous);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Review was not saved."); }
    finally { setBusy(false); }
  }

  async function downloadReport() {
    if (!data || !purchase || !job) return;
    setBusy(true);
    try {
      // @ts-expect-error dynamic jspdf import
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      let y = 18;
      function paragraph(text: string) {
        // The built-in PDF font supports ASCII. INR labels avoid an unsupported currency glyph.
        const lines = pdf.splitTextToSize(text.replace(/[^\x20-\x7E\n]/g, " "), 175) as string[];
        for (const line of lines) {
          if (y > 278) { pdf.addPage(); y = 18; }
          pdf.text(line, 17, y); y += 6;
        }
        y += 3;
      }
      pdf.setFontSize(12);
      paragraph("TrustChain AI - Pre-advance verification report");
      paragraph(`Case: ${purchase.title} | Supplier: ${purchase.supplier_name}`);
      paragraph(`Case ID: ${id} | Investigation: ${data.job_id}`);
      paragraph(`Captured: ${data.created_at} | Processing/review status: ${job.status}`);
      paragraph("This report does not authorise a payment or verify supplier legitimacy.");
      paragraph(`Advance exposure status: ${data.advance_exposure.status}`);
      paragraph(`Currency: ${data.advance_exposure.currency || "Unknown"}; accepted advance: ${data.advance_exposure.baseline_amount ?? "Missing"}; final advance: ${data.advance_exposure.final_amount ?? "Missing"}; difference: ${data.advance_exposure.difference ?? "Not calculated"}`);
      for (const finding of data.findings) {
        paragraph(`${finding.field_key}: ${finding.status} (${finding.severity}). ${finding.explanation}`);
        for (const [label, sources] of [["Accepted", finding.baseline], ["Final", finding.final]] as const) {
          for (const field of sources || []) paragraph(`${label}: ${field.value} ${field.unit || ""} | document ${field.document_id}, page ${field.page_number} | ${field.raw_text}`);
        }
      }
      for (const evidence of data.evidence || []) paragraph(`Public observation: ${evidence.observation} | ${evidence.source_url} | run ${evidence.provider_run_id} | captured ${evidence.captured_at}`);
      if (!(data.evidence || []).length) paragraph("No source-backed public observations are available for this investigation.");
      pdf.save(`trustchain-${id}.pdf`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Report export failed."); }
    finally { setBusy(false); }
  }

  const findings = data?.findings || [];
  const conflicts = findings.filter(item => item.status === "CONFLICT").length;
  return <AppShell breadcrumb={`Workspace / ${view}`}>
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="space-y-2"><p className="text-xs text-gray-500 break-all">Investigation / {id}</p>
        <h1 className="text-3xl font-extrabold">{view === "progress" ? "Your check is taking shape." : view === "review" ? "The decision stays with you." : view === "reports" ? "A review you can take with you." : "See exactly where it changed."}</h1>
        <p className="text-gray-600">{purchase ? `${purchase.title} · ${purchase.supplier_name}` : "Loading case..."}</p>
      </header>
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p> : null}
      <nav aria-label="Case sections" className="case-tabs">
        {(["documents", "progress", "findings", "evidence", "review", "reports"] as const).map(section => <Link aria-current={view === section ? "page" : undefined} key={section} href={`/cases/${id}/${section}`}>{section}</Link>)}
      </nav>
      {job ? <section className="card-surface p-6 space-y-2" aria-live="polite">
        <h2 className="text-lg font-bold">{job.status}</h2><p>Stage: {job.stage}</p>
        {job.provider_status ? <p>Public research: {job.provider_status}</p> : null}
        {job.error_code ? <p className="text-amber-800">{job.error_code}</p> : null}
        {["QUEUED", "PROCESSING"].includes(job.status) ? <p>Polling saved investigation status...</p> : <p>{conflicts} conflicts recorded. Inspect unresolved evidence before deciding.</p>}
      </section> : !error ? <p role="status">Loading saved investigation...</p> : null}
      {view === "progress" && job && ["QUEUED", "PROCESSING"].includes(job.status) ?
        <button className="btn-secondary" onClick={async () => { try { await api.resumeJob(job.id); } catch (e) { setError(e instanceof Error ? e.message : "Resume failed."); } }}>Resume interrupted processing</button> : null}
      {data ? <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 card-surface p-6 space-y-4"><h2 className="text-xl font-bold">Accepted terms and final PI</h2>
          {findings.map((finding, index) => <FindingSources key={`${finding.field_key}-${index}`} finding={finding} openSource={openSource} />)}
          {view === "evidence" || view === "reports" ? <section className="space-y-3"><h3 className="font-bold">Public supplier context</h3>
            {(data.evidence || []).map((source, index) => <article className="rounded-xl bg-[#f7f6f2] p-4 text-sm" key={index}>
              <p>{source.observation}</p>{source.source_url.startsWith("https://") ? <a className="text-[#0d5e4b] underline" href={source.source_url} target="_blank" rel="noreferrer">{source.source_url}</a> : null}
              <p>Run: {source.provider_run_id} · {source.captured_at}</p></article>)}
            {!data.evidence?.length ? <p>No source-backed public observations available.</p> : null}
          </section> : null}
        </section><aside><ExposureCard exposure={data.advance_exposure} /></aside>
      </div> : null}
      {view === "review" && data ? <form onSubmit={recordReview} className="card-surface p-6 space-y-4">
        <h2 className="text-xl font-bold">Record human review</h2>
        <label className="block">Decision<select aria-label="Decision" value={decision} onChange={e => setDecision(e.target.value as ReviewDecision)} className="field-control">
          <option value="REQUEST_CLARIFICATION">Request clarification</option><option value="APPROVE">Approve</option><option value="REJECT">Reject</option></select></label>
        <label className="block">Review comment<textarea aria-label="Review comment" required maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} className="field-control min-h-32" /></label>
        <p className="text-sm text-gray-600">Reviewer permissions are checked by the server. This records a review and does not release funds.</p>
        <button className="btn-primary" disabled={busy || !comment.trim() || !job || !["REVIEW_READY", "PARTIAL_REVIEW"].includes(job.status)}>Record decision</button>
        {recorded ? <p role="status">Decision recorded: {recorded}</p> : job?.status === "REVIEWED" ? <p>This investigation has already been reviewed.</p> : null}
      </form> : null}
      {view === "reports" ? <button className="btn-primary" disabled={!data || !job || busy} onClick={downloadReport}>Download PDF</button> : null}
    </div>
  </AppShell>;
}

function FindingSources({ finding, openSource }: { finding: Finding; openSource: (id: string) => Promise<void> }) {
  return <article className="border border-[#e4e2d8] rounded-xl p-4 space-y-3">
    <h3 className="font-bold capitalize">{finding.field_key.replace(/_/g, " ")} · {finding.status}</h3><p className="text-sm">{finding.explanation}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {([['Accepted', finding.baseline], ['Final', finding.final]] as const).map(([label, fields]) => <div key={label} className="rounded-lg bg-[#f7f6f2] p-3 text-sm">
        <h4 className="font-semibold">{label}</h4>{fields?.length ? fields.map((field, index) => <div key={index} className="mt-2 space-y-1">
          <p>{field.value} {field.unit}</p><blockquote>{field.raw_text}</blockquote>
          <button className="text-[#0d5e4b] underline" onClick={() => openSource(field.document_id)}>Open PDF · page {field.page_number}</button>
        </div>) : <p>Not stated / not extracted</p>}
      </div>)}
    </div>
  </article>;
}
