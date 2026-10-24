"use client";

export const dynamic = "force-dynamic";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import {
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  RotateCw,
} from "lucide-react";

export default function InvestigationProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [stage, setStage] = useState<number>(2); // 1: Extract, 2: Research, 3: Compare, 4: Ready
  const [stageLabel, setStageLabel] = useState<string>("Processing");
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  useEffect(() => {
    // Poll investigation progress or simulate realistic stages
    const timer1 = setTimeout(() => {
      setStage(2);
      setStageLabel("TinyFish research in progress");
    }, 1500);

    const timer2 = setTimeout(() => {
      setStage(3);
      setStageLabel("AI comparison executing");
    }, 3500);

    const timer3 = setTimeout(() => {
      setStage(4);
      setStageLabel("Review ready");
      setIsCompleted(true);
    }, 5500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
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
            Your check is taking shape.
          </h1>
          <p className="text-sm text-[#71717a]">
            Follow each stage. Findings are not final until comparison completes.
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
                {id} · Kaveri Metalworks · PO-2026-084 · Illustrative case
              </p>
            </div>
            {isCompleted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#047857] border border-[#6ee7b7]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready for human review</span>
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#f0ede4] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#0d5e4b] h-full transition-all duration-700 ease-out"
              style={{
                width: stage === 1 ? "33%" : stage === 2 ? "66%" : stage === 3 ? "90%" : "100%",
              }}
            />
          </div>

          <p className="text-xs text-gray-500">
            {stage === 1 && "Parsing PDF clauses and extracting pricing fields..."}
            {stage === 2 && "Extraction complete · Research in progress · Comparison pending"}
            {stage === 3 && "Comparing accepted terms with proforma invoice clauses..."}
            {stage === 4 && "All 3 discrepancies identified. Advance exposure calculated at ₹2,40,000."}
          </p>
        </div>

        {/* 3 Step Stages & Side Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            {/* Step 1: PDF Extraction */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs flex items-start gap-4">
              <div className="mt-0.5">
                <div className="w-7 h-7 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#18181b]">
                    PDF extraction
                  </h3>
                  <span className="text-xs font-medium text-[#047857]">
                    Complete
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  3 sample PDFs parsed. Specifications, delivery and advance terms extracted with exact page coordinates.
                </p>
              </div>
            </div>

            {/* Step 2: TinyFish Public Research */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs flex items-start gap-4">
              <div className="mt-0.5">
                {stage >= 3 ? (
                  <div className="w-7 h-7 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#fffbeb] text-[#b45309] flex items-center justify-center animate-spin">
                    <RotateCw className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#18181b]">
                    TinyFish public research
                  </h3>
                  <span
                    className={`text-xs font-medium ${
                      stage >= 3 ? "text-[#047857]" : "text-[#b45309]"
                    }`}
                  >
                    {stage >= 3 ? "Complete" : "In progress"}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Gathering separate public supplier context. Corroborating public capabilities with no private document disclosure.
                </p>
              </div>
            </div>

            {/* Step 3: AI Comparison */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs flex items-start gap-4">
              <div className="mt-0.5">
                {stage === 4 ? (
                  <div className="w-7 h-7 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : stage === 3 ? (
                  <div className="w-7 h-7 rounded-full bg-[#ecfdf5] text-[#065f46] flex items-center justify-center animate-spin">
                    <Loader2 className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#18181b]">
                    AI comparison
                  </h3>
                  <span
                    className={`text-xs font-medium ${
                      stage === 4
                        ? "text-[#047857]"
                        : stage === 3
                        ? "text-[#0d5e4b]"
                        : "text-gray-400"
                    }`}
                  >
                    {stage === 4 ? "Complete" : stage === 3 ? "Comparing" : "Pending"}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {stage === 4
                    ? "Comparison finalized. The accepted quotation was used as contractual baseline."
                    : "Waiting for research. The accepted quotation will be the agreement baseline."}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Documents Extracted Summary */}
          <div className="lg:col-span-4 bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4 h-fit">
            <h4 className="text-sm font-bold text-[#18181b]">
              Documents extracted
            </h4>
            <div className="space-y-2 text-xs text-gray-600 divide-y divide-gray-100">
              <div className="pt-2 flex justify-between">
                <span>RFQ</span>
                <span className="font-medium text-gray-900">2 pages</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span>Accepted quotation</span>
                <span className="font-medium text-gray-900">3 pages</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span>Final PI</span>
                <span className="font-medium text-gray-900">2 pages</span>
              </div>
            </div>
            <div className="pt-3 border-t border-[#e4e2d8] text-xs font-semibold text-[#0d5e4b]">
              7 illustrative pages ready
            </div>
          </div>
        </div>

        {/* Global disclaimer */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-4 text-xs text-[#065f46]">
          <span className="font-bold">Processing is not approval.</span> Illustrative in-progress state for {id}. No payment decision has been made. Public context is not contractual evidence.
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
