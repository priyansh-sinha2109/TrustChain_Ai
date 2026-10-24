"use client";

export const dynamic = "force-dynamic";

import React, { use, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { api } from "@/lib/api";
import { DocumentType } from "@/types/api";
import {
  UploadCloud,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface DocumentSlot {
  type: DocumentType;
  title: string;
  roleDescription: string;
  filename: string;
  sizeFormatted: string;
  pages: number;
  annotation: string;
  isAttached: boolean;
  fileObj?: File | null;
}

export default function DocumentUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [docs, setDocs] = useState<Record<DocumentType, DocumentSlot>>({
    RFQ: {
      type: "RFQ",
      title: "RFQ",
      roleDescription: "Your original requirements",
      filename: "TC024_RFQ.pdf",
      sizeFormatted: "428 KB",
      pages: 2,
      annotation: "8 mm steel blanks; delivery required in 7 days.",
      isAttached: true,
    },
    ACCEPTED_QUOTE: {
      type: "ACCEPTED_QUOTE",
      title: "Accepted Quotation",
      roleDescription: "The terms you agreed to",
      filename: "TC024_Accepted_Quote.pdf",
      sizeFormatted: "612 KB",
      pages: 3,
      annotation: "8 mm · 7 days · 30% advance.",
      isAttached: true,
    },
    FINAL_PI: {
      type: "FINAL_PI",
      title: "Final PI",
      roleDescription: "The latest payment request",
      filename: "TC024_Final_PI.pdf",
      sizeFormatted: "384 KB",
      pages: 2,
      annotation: "Compare this version against the accepted quotation.",
      isAttached: true,
    },
    PURCHASE_ORDER: {
      type: "PURCHASE_ORDER",
      title: "Purchase Order",
      roleDescription: "Optional internal reference",
      filename: "",
      sizeFormatted: "",
      pages: 0,
      annotation: "",
      isAttached: false,
    },
  });

  const [activeUploadType, setActiveUploadType] = useState<DocumentType | null>(null);
  const [starting, setStarting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function triggerFilePick(type: DocumentType) {
    setActiveUploadType(type);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeUploadType) return;

    if (file.type !== "application/pdf") {
      setUploadError("Only standard PDF documents are supported.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Document exceeds backend maximum limit of 10 MB.");
      return;
    }

    try {
      // Execute upload intent & storage flow
      const target = await api.requestUploadIntent(id, {
        filename: file.name,
        document_type: activeUploadType,
        size_bytes: file.size,
      });

      await api.uploadPdfToStorage(target.upload_url, file);
      await api.confirmUpload(id, target.document_id);

      setDocs((prev) => ({
        ...prev,
        [activeUploadType]: {
          ...prev[activeUploadType],
          filename: file.name,
          sizeFormatted: `${Math.round(file.size / 1024)} KB`,
          pages: 2,
          isAttached: true,
          fileObj: file,
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
    }
  }

  async function handleStartInvestigation() {
    setStarting(true);
    try {
      await api.startInvestigation(id, {
        baseline_document_id: "doc-quote-002",
        final_document_id: "doc-pi-003",
        public_research: true,
      });

      router.push(`/cases/${id}/progress`);
    } catch (err) {
      console.error("Start investigation failed", err);
      router.push(`/cases/${id}/progress`);
    } finally {
      setStarting(false);
    }
  }

  const assignedCount = [docs.RFQ, docs.ACCEPTED_QUOTE, docs.FINAL_PI].filter(
    (d) => d.isAttached
  ).length;

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Hidden PDF file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Title Header */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Investigations / {id} / Documents
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            Give every document a role.
          </h1>
          <p className="text-sm text-[#71717a]">
            Separate requirements, agreed terms and the payment request.
          </p>
        </div>

        {/* Stepper Header */}
        <div className="bg-white border border-[#e4e2d8] rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
          <div className="flex items-center gap-3 font-semibold">
            <span className="text-[#065f46] flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Case details
            </span>
            <span className="text-gray-300">/</span>
            <span className="text-[#0d5e4b] font-bold">2 Documents</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-400">3 Verify &amp; review</span>
          </div>

          <div className="text-gray-500 font-medium">
            {id} · Kaveri Metalworks · PO-2026-084 · Illustrative case
          </div>
        </div>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* 3 Document Cards matching Figma layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {([docs.RFQ, docs.ACCEPTED_QUOTE, docs.FINAL_PI] as DocumentSlot[]).map((slot) => (
            <div
              key={slot.type}
              className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#cfcbc0] transition-colors"
            >
              <div>
                <h3 className="text-lg font-bold text-[#18181b]">{slot.title}</h3>
                <p className="text-xs text-gray-500">{slot.roleDescription}</p>

                {/* Dropzone */}
                <div className="mt-4 border-2 border-dashed border-[#dcd9ce] rounded-xl p-6 bg-[#fcfbf9] text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#ecfdf5] text-[#0d5e4b] flex items-center justify-center mx-auto">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Drop PDF here</p>
                    <p className="text-[11px] text-gray-400">Max 10 MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerFilePick(slot.type)}
                    className="btn-secondary py-1.5 px-4 text-xs font-semibold shadow-2xs"
                  >
                    Choose PDF
                  </button>
                </div>

                {/* Attached state details */}
                {slot.isAttached && (
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
                    <div className="text-[11px] font-bold text-[#065f46]">
                      Example PDF attached
                    </div>
                    <p className="text-xs font-semibold text-[#18181b] truncate">
                      {slot.filename}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {slot.pages} pages · {slot.sizeFormatted}
                    </p>
                    <p className="text-xs text-gray-600 italic pt-1">
                      {slot.annotation}
                    </p>
                  </div>
                )}
              </div>

              {slot.isAttached && (
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => window.open("#", "_blank")}
                    className="text-[#0d5e4b] hover:underline flex items-center gap-1"
                  >
                    <span>Preview</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFilePick(slot.type)}
                    className="text-gray-600 hover:text-black flex items-center gap-1"
                  >
                    <span>Replace</span>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Ready to compare alert banner */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#065f46]">
          <div>
            <span className="font-bold">
              Ready to compare · {assignedCount} of 3 roles assigned
            </span>
            <p className="text-[#047857] mt-0.5">
              Sample PDFs shown, not verified real documents. Check readability and accepted versions before starting.
            </p>
          </div>
        </div>

        {/* Evidence boundary explanation banner */}
        <div className="bg-white border border-[#e4e2d8] rounded-xl p-6 shadow-xs space-y-2">
          <h4 className="text-sm font-bold text-[#18181b]">
            Know the evidence boundary
          </h4>
          <p className="text-xs text-gray-600 leading-relaxed">
            Contractual findings use uploaded PDFs. TinyFish provides separate public supplier context; it cannot replace your agreement. Starting the check does not authorise payment.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleStartInvestigation}
            disabled={starting || assignedCount < 2}
            className="btn-primary py-3 px-6 text-sm flex items-center gap-2 shadow-sm"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Start investigation</span>
          </button>

          <Link
            href="/cases/new"
            className="btn-secondary py-3 px-5 text-sm flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to case details</span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
