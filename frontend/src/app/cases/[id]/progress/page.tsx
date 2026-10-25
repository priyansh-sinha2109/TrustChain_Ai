"use client";

export const dynamic = "force-dynamic";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { analyzeSupplierWebsite } from "@/lib/supplierIntelligence";
import {
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  RotateCw,
  Globe,
  Radio,
  FileCheck,
  ShieldCheck,
  Terminal,
  ExternalLink,
} from "lucide-react";

export default function InvestigationProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [stage, setStage] = useState<number>(2); // 1: Extract, 2: Research (TinyFish), 3: Compare, 4: Ready
  const [stageLabel, setStageLabel] = useState<string>("TinyFish web crawl in progress");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [activeLogIndex, setActiveLogIndex] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored =
        localStorage.getItem(`tc_supplier_url_${id}`) ||
        localStorage.getItem("tc_last_supplier_url");
      if (stored) {
        setTargetUrl(stored);
      }
    }
  }, [id]);

  const intel = analyzeSupplierWebsite(targetUrl);
  const displayUrl = targetUrl || intel.url;
  const crawlerLogs = intel.crawlerSteps;

  useEffect(() => {
    // Stage progression
    const logTimer1 = setTimeout(() => setActiveLogIndex(2), 1000);
    const logTimer2 = setTimeout(() => setActiveLogIndex(3), 2000);
    const stageTimer1 = setTimeout(() => {
      setStage(2);
      setStageLabel("TinyFish web crawl in progress");
      setActiveLogIndex(4);
    }, 2500);

    const logTimer3 = setTimeout(() => setActiveLogIndex(5), 3500);

    const stageTimer2 = setTimeout(() => {
      setStage(3);
      setStageLabel("AI clause discrepancy & exposure calculation");
    }, 4500);

    const stageTimer3 = setTimeout(() => {
      setStage(4);
      setStageLabel("Verification complete · Ready for review");
      setIsCompleted(true);
    }, 6000);

    return () => {
      clearTimeout(logTimer1);
      clearTimeout(logTimer2);
      clearTimeout(stageTimer1);
      clearTimeout(logTimer3);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
    };
  }, []);

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Investigations / {id} / Processing
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            Autonomous verification in progress.
          </h1>
          <p className="text-sm text-[#71717a]">
            TinyFish is actively crawling supplier web presence and extracting contractual clauses.
          </p>
        </div>

        {/* Stage Overview Banner */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#18181b]">
                {stage === 4 ? "Investigation complete" : `Stage ${stage} of 3 · ${stageLabel}`}
              </h2>
              <p className="text-xs text-gray-500">
                {id} · Kaveri Metalworks · PO-2026-084 · Precision Steel Blanks
              </p>
            </div>
            {isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#047857] border border-[#6ee7b7]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready for human review</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Autonomous agents active</span>
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#f0ede4] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#0d5e4b] h-full transition-all duration-700 ease-out"
              style={{
                width: stage === 1 ? "25%" : stage === 2 ? "65%" : stage === 3 ? "88%" : "100%",
              }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              {stage === 1 && "Parsing PDF clauses and extracting raw material specification fields..."}
              {stage === 2 && `TinyFish agent fetching web pages from ${targetUrl}...`}
              {stage === 3 && "Comparing accepted quotation against final PI; calculating ₹2,40,000 exposure..."}
              {stage === 4 && "All 3 discrepancies identified. TinyFish observation verified."}
            </span>
            <span className="font-semibold text-[#0d5e4b]">
              {stage === 1 ? "25%" : stage === 2 ? "65%" : stage === 3 ? "88%" : "100%"}
            </span>
          </div>
        </div>

        {/* 3 Step Stages & Side Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            {/* Step 1: PDF Extraction */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs flex items-start gap-4">
              <div className="mt-0.5">
                <div className="w-8 h-8 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#18181b] flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#065f46]" />
                    <span>PDF clause extraction</span>
                  </h3>
                  <span className="text-xs font-semibold text-[#047857] bg-[#ecfdf5] px-2 py-0.5 rounded">
                    Complete
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  3 contractual documents parsed (RFQ, Accepted Quotation, Final PI). Baseline terms extracted with bounding coordinates on pages 1–3.
                </p>
              </div>
            </div>

            {/* Step 2: TinyFish Public Research with Visual Web Fetching State */}
            <div className={`bg-white border ${stage === 2 ? "border-[#0d5e4b] ring-1 ring-[#0d5e4b]/20" : "border-[#e4e2d8]"} rounded-2xl p-6 shadow-xs space-y-4 transition-all`}>
              <div className="flex items-start gap-4">
                <div className="mt-0.5">
                  {stage >= 3 ? (
                    <div className="w-8 h-8 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="relative w-8 h-8 flex items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <div className="relative w-8 h-8 rounded-full bg-[#0d5e4b] text-white flex items-center justify-center shadow-xs">
                        <Radio className="w-4 h-4 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-[#18181b] flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#0d5e4b]" />
                      <span>TinyFish autonomous web research</span>
                    </h3>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        stage >= 3
                          ? "bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]"
                          : "bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] animate-pulse"
                      }`}
                    >
                      {stage >= 3 ? "✓ Valid & Verified" : "Fetching Web Pages..."}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Crawling public supplier capabilities at <span className="font-mono font-medium text-gray-800">{displayUrl}</span>. Corroborating lead times and catalog specs.
                  </p>
                </div>
              </div>

              {/* Visual Web Crawl Radar & Terminal Log Card */}
              <div className="bg-[#0f172a] rounded-xl p-4 text-emerald-400 font-mono text-xs shadow-inner space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 text-[11px] text-gray-400">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>TinyFish Web-Fetch Stream · Session ID: {intel.runId}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px]">CRAWLER ACTIVE</span>
                  </div>
                </div>

                {/* Target URL Badge */}
                <div className="bg-[#1e293b] rounded p-2 text-xs flex items-center justify-between text-gray-200">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-gray-400">GET</span>
                    <span className="text-emerald-300 font-semibold">{displayUrl}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-800">
                    200 OK
                  </span>
                </div>

                {/* Live Step-by-Step Crawler Output */}
                <div className="space-y-1 pt-1 text-[11px] leading-relaxed">
                  {crawlerLogs.slice(0, activeLogIndex + 1).map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 select-none">&gt;</span>
                      <span className={idx === activeLogIndex ? "text-white font-medium" : "text-emerald-400/80"}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>

                {stage >= 3 && (
                  <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Public Evidence Verified · Run ID: {intel.runId}
                    </span>
                    <span className="text-gray-400">
                      Finished in 4.8s
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: AI Comparison */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs flex items-start gap-4">
              <div className="mt-0.5">
                {stage === 4 ? (
                  <div className="w-8 h-8 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : stage === 3 ? (
                  <div className="w-8 h-8 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center animate-spin">
                    <Loader2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#18181b]">
                    AI discrepancy &amp; financial exposure trace
                  </h3>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      stage === 4
                        ? "text-[#047857] bg-[#ecfdf5]"
                        : stage === 3
                        ? "text-[#0d5e4b] bg-emerald-50"
                        : "text-gray-400 bg-gray-50"
                    }`}
                  >
                    {stage === 4 ? "Complete" : stage === 3 ? "Analyzing" : "Pending"}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {stage === 4
                    ? "Comparison finalized. 3 material discrepancies detected. Advance payment exposure calculated at ₹2,40,000."
                    : "Correlating extracted PDF clauses with TinyFish web findings to detect hidden risk."}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Case Summary & Trust Infrastructure */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-[#18181b]">
                Documents extracted
              </h4>
              <div className="space-y-2 text-xs text-gray-600 divide-y divide-gray-100">
                <div className="pt-2 flex justify-between">
                  <span>RFQ (Requirements)</span>
                  <span className="font-medium text-gray-900">2 pages</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span>Accepted quotation (Baseline)</span>
                  <span className="font-medium text-gray-900">3 pages</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span>Final PI (Payment Request)</span>
                  <span className="font-medium text-gray-900">2 pages</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[#e4e2d8] text-xs font-semibold text-[#0d5e4b] flex items-center justify-between">
                <span>7 contractual pages ready</span>
                <span className="text-[#047857]">✓ Verified</span>
              </div>
            </div>

            <div className="bg-[#fcfbf9] border border-[#e4e2d8] rounded-2xl p-5 shadow-xs space-y-3 text-xs">
              <span className="font-bold text-gray-900 block">
                B2B Vendor Trust Infrastructure
              </span>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Protecting MSMEs against substandard raw materials, inconsistent quality, and unhedged advance payment demands before releasing funds.
              </p>
              <div className="p-3 bg-white border border-[#e4e2d8] rounded-xl space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span>Advance Exposure</span>
                  <span className="text-[#b45309]">₹2,40,000 (80% vs 30%)</span>
                </div>
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>Material Spec Discrepancy</span>
                  <span className="text-red-600 font-medium">8mm → 6mm commercial</span>
                </div>
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>TinyFish Web Status</span>
                  <span className="text-emerald-700 font-medium">Active &amp; Crawled</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global disclaimer */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-4 text-xs text-[#065f46]">
          <span className="font-bold">Investigation in progress.</span> Contractual terms are derived strictly from agreed baseline documents. TinyFish provides separate corroborative web intelligence.
        </div>

        {/* Action button */}
        <div className="pt-2 flex items-center gap-4">
          <Link
            href={`/cases/${id}/findings`}
            className="btn-primary py-3 px-6 text-sm flex items-center gap-2 shadow-sm"
          >
            <span>{isCompleted ? "View verification findings" : "View findings"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/cases/${id}/documents`}
            className="btn-secondary py-3 px-5 text-sm"
          >
            Back to documents
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
