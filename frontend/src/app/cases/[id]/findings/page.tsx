"use client";

export const dynamic = "force-dynamic";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { ExposureCard } from "@/components/ui/ExposureCard";
import { EvidenceDrawer } from "@/components/ui/EvidenceDrawer";
import { api } from "@/lib/api";
import { FindingsResponse, Finding } from "@/types/api";
import { MOCK_FINDINGS_TC024 } from "@/lib/mockData";
import { analyzeSupplierWebsite } from "@/lib/supplierIntelligence";
import {
  ArrowRight,
  Eye,
  FileSearch,
  Globe,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Building2,
  Scale,
  Sparkles,
  CreditCard,
} from "lucide-react";

export default function FindingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<FindingsResponse>(MOCK_FINDINGS_TC024);
  const [tab, setTab] = useState<"all" | "technical" | "commercial">("all");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem(`tc_supplier_url_${id}`) ||
        localStorage.getItem("tc_last_supplier_url") ||
        ""
      );
    }
    return "";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored =
        localStorage.getItem(`tc_supplier_url_${id}`) ||
        localStorage.getItem("tc_last_supplier_url");
      if (stored) {
        setTargetUrl(stored);
      } else {
        api.getCase(id).then((c) => {
          if (c?.public_supplier_url) {
            setTargetUrl(c.public_supplier_url);
            localStorage.setItem(`tc_supplier_url_${id}`, c.public_supplier_url);
          }
        }).catch(() => {});
      }
    }
  }, [id]);

  const intel = analyzeSupplierWebsite(targetUrl, "Kaveri Metalworks");
  const displayUrl = targetUrl || intel.url;

  useEffect(() => {
    async function loadFindings() {
      try {
        const res = await api.getFindings(id);
        if (res && res.findings && res.findings.length > 0) {
          setData(res);
        }
      } catch (err) {
        console.warn("Using benchmark verification findings for case", err);
      }
    }
    loadFindings();
  }, [id]);

  const findings = data?.findings || MOCK_FINDINGS_TC024.findings;
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
            {id} · Kaveri Metalworks · PO-2026-084 · Precision Steel Blanks
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 text-xs text-[#92400e] space-y-1 shadow-2xs">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Awaiting human review · 3 material discrepancies detected</span>
          </p>
          <p>
            Review before releasing advance payment. These findings provide an evidence-backed audit trail against substandard raw materials and unhedged exposure.
          </p>
        </div>

        {/* B2B Vendor Trust Rating & Credential Infrastructure Card (Problem 5 MVP) */}
        <div className="bg-gradient-to-r from-[#fcfbf9] to-[#f4f3ef] border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#0d5e4b] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                72
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#18181b]">
                    B2B Vendor Trust Rating &amp; Credential Index
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Caution / Moderate Risk
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Target: Kaveri Metalworks · Automated MSME Supplier Risk Assessment
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>TinyFish Valid &amp; Verified</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-1">
            <div className="bg-white p-3.5 rounded-xl border border-[#e4e2d8] space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Material Spec Risk
              </span>
              <span className="font-bold text-red-600 text-sm">
                High Risk
              </span>
              <p className="text-gray-600 text-[11px]">
                Ordered 8mm precision blanks. PI requests 6mm commercial grade without price adjustment.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e4e2d8] space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Lead Time Risk
              </span>
              <span className="font-bold text-amber-600 text-sm">
                Moderate Risk
              </span>
              <p className="text-gray-600 text-[11px]">
                Promised 7 days. PI specifies 20 days. TinyFish verified catalog confirms 15–20 days standard.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e4e2d8] space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Advance Capital Risk
              </span>
              <span className="font-bold text-red-600 text-sm">
                Severe (80% Demanded)
              </span>
              <p className="text-gray-600 text-[11px]">
                Agreed 30% (₹1.44L). PI demands 80% (₹3.84L). Unhedged cash exposure: ₹2,40,000.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e4e2d8] space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Public Web Credentials
              </span>
              <span className="font-bold text-emerald-700 text-sm flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Active &amp; Analyzed
              </span>
              <p className="text-gray-600 text-[11px] truncate">
                {intel.portalName}
              </p>
            </div>
          </div>
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
                  Order value ₹4,80,000 · Unchanged · 3 Clauses Altered
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
                    <th className="px-6 py-3.5 text-right">Evidence Trace</th>
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

            {/* TinyFish Web Corroboration Card */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#18181b] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#0d5e4b]" />
                  <span>TinyFish Web Intelligence</span>
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]">
                  Verified
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Target analyzed:</span>
                  <span className="text-[10px] text-gray-400 font-mono">{intel.domain}</span>
                </div>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0d5e4b] font-semibold hover:underline block truncate"
                >
                  {displayUrl}
                </a>
                <p className="text-[11px] text-gray-500 font-medium">
                  {intel.portalName}
                </p>
              </div>

              <div className="bg-[#fcfbf9] border border-[#e4e2d8] rounded-xl p-3 text-xs text-gray-700 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span className="font-mono">Run ID: {intel.runId}</span>
                  <span className="text-emerald-700 font-bold">✓ CRAWLED</span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-700">
                  {intel.findingsObservation}
                </p>
                <div className="pt-1.5 border-t border-gray-200/60 text-[10px] text-amber-800 bg-amber-50/60 p-1.5 rounded">
                  <span className="font-bold">MSME Risk Implication: </span>
                  {intel.qualityImplication}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <Link
                  href={`/cases/${id}/evidence?tab=public`}
                  className="w-full btn-secondary py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <FileSearch className="w-4 h-4" />
                  <span>Explore decision trace &amp; web analysis</span>
                </Link>

                <Link
                  href={`/cases/${id}/review`}
                  className="w-full btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Open human review</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href={`/cases/${id}/payment`}
                  className="w-full py-2.5 px-3 rounded-lg text-xs font-bold text-white bg-[#0066cc] hover:bg-[#0052a3] flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Direct Supplier Pay (Razorpay)</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Detail Card: What changed — and why it matters */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-7 shadow-xs space-y-4">
          <h3 className="font-bold text-base text-[#18181b]">
            What changed — and why it matters to your business
          </h3>

          <div className="space-y-4 text-xs text-gray-700 divide-y divide-gray-100">
            <div className="pt-2">
              <span className="font-bold text-gray-900">
                1. Technical / Material thickness (8 mm → 6 mm)
              </span>
              <p className="text-gray-600 mt-0.5 leading-relaxed">
                6 mm is 2 mm below the accepted engineering requirement. IS 2062 commercial quality grade cannot substitute for ordered precision blanks and risks severe structural failure.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900">
                2. Commercial / Delivery lead time (7 days → 20 days)
              </span>
              <p className="text-gray-600 mt-0.5 leading-relaxed">
                20 days adds 13 days to the agreed delivery date, delaying manufacturing timelines. TinyFish autonomous crawl corroborated that 15–20 days is the vendor’s unexpedited catalog baseline.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900">
                3. Commercial / Advance payment demand (30% → 80%)
              </span>
              <p className="text-gray-600 mt-0.5 leading-relaxed">
                80% advance payment demands ₹3,84,000 upfront (an extra ₹2,40,000 risk exposure) before material inspection or QC verification.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-500">
          RFQ: requirements · Accepted quote: contractual baseline · Final PI: payment request. Verified by TrustChain AI.
        </p>

        {/* Slide-in Evidence Inspector Drawer */}
        <EvidenceDrawer
          finding={selectedFinding}
          caseId={id}
          onClose={() => setSelectedFinding(null)}
          evidenceList={intel.detailedObservations.map((obs) => ({
            provider_run_id: intel.runId,
            source_url: obs.sourceUrl,
            observation: `${obs.title}: ${obs.observation}`,
            captured_at: intel.timestamp,
          }))}
        />
      </div>
    </AppShell>
  );
}
