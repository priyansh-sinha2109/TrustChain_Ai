"use client";

export const dynamic = "force-dynamic";

import { LiveCaseWorkspace } from "@/components/ui/LiveCaseWorkspace";
import { DEMO_MODE } from "@/lib/api";
import React, { use, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { MOCK_FINDINGS_TC024 } from "@/lib/mockData";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

function IllustrativeEvidenceExplorerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tab, setTab] = useState<"pdfs" | "public">("pdfs");
  const [selectedTerm, setSelectedTerm] = useState<number>(0);

  const findings = MOCK_FINDINGS_TC024.findings;
  const current = findings[selectedTerm] || findings[0];

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Title Header matching Figma */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Investigations / {id} / Evidence
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            See exactly where it changed.
          </h1>
          <p className="text-sm text-[#71717a]">
            Trace findings to PDF pages. Keep public context in its own lane.
          </p>
          <p className="text-xs text-gray-500 pt-0.5">
            {id} · Kaveri Metalworks · PO-2026-084 · Illustrative case
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 border-b border-[#e4e2d8] pb-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("pdfs")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === "pdfs"
                ? "bg-[#ecfdf5] text-[#065f46]"
                : "text-gray-500 hover:text-black"
            }`}
          >
            Contractual PDFs
          </button>
          <button
            type="button"
            onClick={() => setTab("public")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === "public"
                ? "bg-[#ecfdf5] text-[#065f46]"
                : "text-gray-500 hover:text-black"
            }`}
          >
            Public TinyFish sources
          </button>
        </div>

        {/* Document Library Card */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-[#18181b]">
            Document library
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-gray-500">RFQ · 2 pages</span>
            <span className="text-gray-300">•</span>
            <span className="text-[#0d5e4b] font-semibold bg-[#ecfdf5] px-2.5 py-1 rounded-md">
              Accepted quotation · 3 pages · Selected
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">Final PI · 2 pages</span>
          </div>
          <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 flex flex-wrap gap-4">
            <span>Thickness: Quote p. 2 ↔ PI p. 1</span>
            <span>Delivery and advance: Quote p. 3 ↔ PI p. 2</span>
          </div>
        </div>

        {/* Side-by-side Evidence Cards */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#18181b]">
                {current.label || current.field_key}:{" "}
                <span className="text-[#0d5e4b]">
                  {current.baseline?.[0]?.value}
                </span>{" "}
                →{" "}
                <span className="text-[#b45309]">
                  {current.final?.[0]?.value}
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {current.category} discrepancy · Compare the highlighted source clauses
              </p>
            </div>

            {/* Switch between terms */}
            <div className="flex items-center gap-1.5">
              {findings.map((f, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedTerm(idx)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedTerm === idx
                      ? "bg-[#0d5e4b] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Clause {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Document: Accepted Quote */}
            <div className="border border-[#e4e2d8] rounded-xl p-5 bg-[#faf9f6] space-y-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Illustrative Document · Not a real contract
              </div>
              <div>
                <h4 className="font-bold text-base text-[#18181b]">
                  KAVERI METALWORKS
                </h4>
                <p className="text-xs text-gray-500">
                  Accepted Quotation · QT-084 <br />
                  Buyer: Ashwamedha Works
                </p>
                <p className="text-xs font-semibold text-gray-700 mt-2">
                  Precision steel blanks
                </p>
              </div>

              {/* Clause Highlight */}
              <div className="bg-[#fef9ee] border-l-4 border-[#ca8a04] p-4 rounded-r-lg space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#854d0e]">
                  Page {current.baseline?.[0]?.page_number || 2} · Clause
                </span>
                <p className="text-sm font-bold text-[#18181b]">
                  {current.label}: {current.baseline?.[0]?.value}
                </p>
                <p className="text-xs text-gray-600 italic pt-1">
                  &quot;{current.baseline?.[0]?.raw_text}&quot;
                </p>
              </div>

              <div className="text-xs text-gray-400 pt-2 border-t border-gray-200/60 flex justify-between">
                <span>Order value: INR 4,80,000</span>
                <span>Page {current.baseline?.[0]?.page_number || 2}</span>
              </div>
            </div>

            {/* Right Document: Final Proforma Invoice */}
            <div className="border border-[#e4e2d8] rounded-xl p-5 bg-[#faf9f6] space-y-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Illustrative Document · Not a real contract
              </div>
              <div>
                <h4 className="font-bold text-base text-[#18181b]">
                  KAVERI METALWORKS
                </h4>
                <p className="text-xs text-gray-500">
                  Final Proforma Invoice · PI-084 <br />
                  Buyer: Ashwamedha Works
                </p>
                <p className="text-xs font-semibold text-gray-700 mt-2">
                  Precision steel blanks
                </p>
              </div>

              {/* Clause Highlight */}
              <div className="bg-[#fff1f2] border-l-4 border-[#e11d48] p-4 rounded-r-lg space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#9f1239]">
                  Page {current.final?.[0]?.page_number || 1} · Clause
                </span>
                <p className="text-sm font-bold text-[#dc2626]">
                  {current.label}: {current.final?.[0]?.value}
                </p>
                <p className="text-xs text-gray-600 italic pt-1">
                  &quot;{current.final?.[0]?.raw_text}&quot;
                </p>
              </div>

              <div className="text-xs text-gray-400 pt-2 border-t border-gray-200/60 flex justify-between">
                <span>Order value: INR 4,80,000</span>
                <span>Page {current.final?.[0]?.page_number || 1}</span>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectedTerm((prev) => Math.max(0, prev - 1))}
              disabled={selectedTerm === 0}
              className="btn-secondary py-2 px-4 text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous clause
            </button>
            <button
              type="button"
              onClick={() => setSelectedTerm((prev) => Math.min(findings.length - 1, prev + 1))}
              disabled={selectedTerm === findings.length - 1}
              className="btn-secondary py-2 px-4 text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              Next clause <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.open("#", "_blank")}
              className="btn-secondary py-2 px-4 text-xs ml-auto text-[#0d5e4b] flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open source PDF
            </button>
          </div>
        </div>

        {/* Public Context Section (TinyFish) */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-base text-[#18181b]">
              Public supplier context · TinyFish
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Illustrative / unverified · No actual browsing performed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#faf9f6] border border-[#e4e2d8] rounded-xl p-4 space-y-1">
              <span className="font-semibold text-xs text-gray-800">
                Supplier website example
              </span>
              <a
                href="#public"
                className="text-xs text-[#0d5e4b] hover:underline flex items-center gap-1 font-medium"
              >
                <span>supplier.example / capabilities</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-xs text-gray-500 pt-1">
                Illustrative / unverified. Placeholder domain; not contractual evidence.
              </p>
            </div>

            <div className="bg-[#faf9f6] border border-[#e4e2d8] rounded-xl p-4 space-y-1">
              <span className="font-semibold text-xs text-gray-800">
                Public directory example
              </span>
              <a
                href="#public"
                className="text-xs text-[#0d5e4b] hover:underline flex items-center gap-1 font-medium"
              >
                <span>directory.example / supplier-profile</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-xs text-gray-500 pt-1">
                Illustrative / unverified. Placeholder domain; not contractual evidence.
              </p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-4 text-xs text-[#065f46]">
          <span className="font-bold">The accepted quote is the agreement baseline.</span>{" "}
          Public supplier pages cannot prove that a changed specification, delivery date or payment term was accepted.
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <Link
            href={`/cases/${id}/review`}
            className="btn-primary py-3 px-6 text-sm flex items-center gap-2 w-fit shadow-sm"
          >
            <span>Continue to human review</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

export default function ConnectedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return DEMO_MODE ? <IllustrativeEvidenceExplorerPage params={params} /> : <LiveCaseWorkspace id={id} view="evidence" />;
}
