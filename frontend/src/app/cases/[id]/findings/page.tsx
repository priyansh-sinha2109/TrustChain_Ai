"use client";

export const dynamic = "force-dynamic";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { ExposureCard } from "@/components/ui/ExposureCard";
import { EvidenceDrawer } from "@/components/ui/EvidenceDrawer";
import { api } from "@/lib/api";
import { FindingsResponse, Finding } from "@/types/api";
import {
  ArrowRight,
  Eye,
  FileSearch,
} from "lucide-react";

export default function FindingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [tab, setTab] = useState<"all" | "technical" | "commercial">("all");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  useEffect(() => {
    async function loadFindings() {
      try {
        const res = await api.getFindings(id);
        setData(res);
      } catch (err) {
        console.error("Failed to load findings", err);
      }
    }
    loadFindings();
  }, [id]);

  const findings = data?.findings || [];
  const filteredFindings = findings.filter((f) => {
    if (tab === "technical") return f.category === "TECHNICAL";
    if (tab === "commercial") return f.category === "COMMERCIAL";
    return true;
  });

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="space-y-6">
        {/* Title Header matching Figma */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Investigations / {id} / Results
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            Same total. Three material changes.
          </h1>
          <p className="text-sm text-[#71717a]">
            Review the differences against the terms you accepted, not just the invoice total.
          </p>
          <p className="text-xs text-gray-500 pt-0.5">
            {id} · Kaveri Metalworks · PO-2026-084 · Illustrative case
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 text-xs text-[#92400e] space-y-1 shadow-2xs">
          <p className="font-bold">
            Awaiting human review · 3 example discrepancies
          </p>
          <p>
            Review before releasing an advance. These illustrative findings are not an approval.
          </p>
        </div>

        {/* Main Grid: Comparison Table (Left) & Exposure + Actions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Comparison Table */}
          <div className="lg:col-span-8 bg-white border border-[#e4e2d8] rounded-2xl shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#e4e2d8] space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#18181b]">
                  Accepted quotation → Final PI
                </h2>
                <p className="text-xs text-[#71717a] mt-0.5">
                  Order value ₹4,80,000 · Unchanged
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    tab === "all"
                      ? "bg-[#ecfdf5] text-[#065f46]"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  All changes (3)
                </button>
                <button
                  type="button"
                  onClick={() => setTab("technical")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    tab === "technical"
                      ? "bg-[#ecfdf5] text-[#065f46]"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  Technical (1)
                </button>
                <button
                  type="button"
                  onClick={() => setTab("commercial")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    tab === "commercial"
                      ? "bg-[#ecfdf5] text-[#065f46]"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  Commercial (2)
                </button>
              </div>
            </div>

            {/* Comparison Rows Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fcfbf9] text-[11px] font-bold uppercase tracking-wider text-[#71717a] border-b border-[#e4e2d8]">
                  <tr>
                    <th className="px-6 py-3.5">Term</th>
                    <th className="px-6 py-3.5">Accepted Quote</th>
                    <th className="px-6 py-3.5">Final PI</th>
                    <th className="px-6 py-3.5 text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ede4]">
                  {filteredFindings.map((finding) => {
                    const baselineVal = finding.baseline?.[0]?.value || "Agreed";
                    const finalVal = finding.final?.[0]?.value || "Proposed";
                    const baselinePage = finding.baseline?.[0]?.page_number || 2;
                    const finalPage = finding.final?.[0]?.page_number || 1;

                    return (
                      <tr
                        key={finding.field_key}
                        className="hover:bg-[#faf9f6] transition-colors cursor-pointer"
                        onClick={() => setSelectedFinding(finding)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[#18181b]">
                            {finding.label || finding.field_key.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-[#71717a] mt-0.5">
                            Quote p. {baselinePage} → PI p. {finalPage}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-medium text-[#27272a]">
                          {baselineVal}
                        </td>
                        <td className="px-6 py-4 font-bold text-[#b45309]">
                          {finalVal}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFinding(finding);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d5e4b] hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Exposure Card & Direct Actions */}
          <div className="lg:col-span-4 space-y-4">
            <ExposureCard
              exposure={data?.advance_exposure}
              orderValue="₹4,80,000"
            />

            {/* Keep sources separate card */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-[#18181b]">
                Keep the sources separate
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Findings come from illustrative contractual PDFs. TinyFish public context is illustrative / unverified, not evidence of agreed terms.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedFinding(findings[0] || null)}
                  className="w-full btn-secondary py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <FileSearch className="w-4 h-4" />
                  <span>Explore evidence</span>
                </button>

                <Link
                  href={`/cases/${id}/review`}
                  className="w-full btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Open human review</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Detail Card: What changed — and why it matters */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-7 shadow-xs space-y-4">
          <h3 className="font-bold text-base text-[#18181b]">
            What changed — and why it matters
          </h3>

          <div className="space-y-4 text-xs text-gray-700 divide-y divide-gray-100">
            <div className="pt-2">
              <span className="font-bold text-gray-900">
                Technical / Material thickness
              </span>
              <p className="text-gray-600 mt-0.5">
                6 mm is 2 mm below the accepted specification. IS 2062 commercial quality grade cannot replace ordered precision plate blanks.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900">
                Commercial / Delivery
              </span>
              <p className="text-gray-600 mt-0.5">
                20 days adds 13 days to the agreed lead time, impacting assembly schedule.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900">
                Commercial / Advance
              </span>
              <p className="text-gray-600 mt-0.5">
                80% increases the upfront commitment by 50 percentage points — requiring ₹2,40,000 more upfront before goods are inspected.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-500">
          RFQ: requirements · Accepted quote: agreed terms · Final PI: payment request. Not a real completed verification.
        </p>

        {/* Slide-in Evidence Inspector Drawer */}
        <EvidenceDrawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          evidenceList={data?.evidence || []}
        />
      </div>
    </AppShell>
  );
}
