"use client";

export const dynamic = "force-dynamic";

import { LiveCaseWorkspace } from "@/components/ui/LiveCaseWorkspace";
import { DEMO_MODE } from "@/lib/api";
import React, { use, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import {
  Download,
  ChevronDown,
} from "lucide-react";

function IllustrativeReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [downloading, setDownloading] = useState(false);

  function handlePrintOrDownload() {
    setDownloading(true);
    setTimeout(() => {
      window.print();
      setDownloading(false);
    }, 300);
  }

  return (
    <AppShell breadcrumb="Workspace / Reports">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header matching Figma */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
              Workspace / Reports
            </span>
            <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
              A review you can take with you.
            </h1>
            <p className="text-sm text-[#71717a]">
              A source-linked summary for procurement, finance and the authorised reviewer.
            </p>

            <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-[#18181b] cursor-pointer">
              <span>{id} · Precision steel blanks</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handlePrintOrDownload}
              disabled={downloading}
              className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 text-xs text-[#92400e] space-y-1 shadow-2xs">
          <p className="font-bold">Review-pending report</p>
          <p>
            This summary contains findings and evidence, not an approval. The human decision is still awaiting review.
          </p>
        </div>

        {/* Report Paper Surface matching Figma layout */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-8 lg:p-12 shadow-sm space-y-8 print:border-none print:shadow-none">
          {/* Report Top Meta */}
          <div className="border-b border-[#e4e2d8] pb-6 space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#18181b]">
                Pre-advance verification
              </h2>
              <span className="text-xs text-gray-400 font-mono">
                {id}-R01 · V1
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {id}-R01 · Version 1 · 24 October 2026
            </p>
            <p className="text-xs text-gray-700">
              {id} · Kaveri Metalworks · PO-2026-084 · Illustrative case
            </p>
            <p className="text-xs font-semibold text-[#b45309] pt-1">
              Illustrative report · Awaiting decision
            </p>
          </div>

          {/* Section 01 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
              01 / Executive summary
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Three example discrepancies were identified. Order value remains ₹4,80,000, but thickness, delivery and upfront payment have changed.
            </p>
          </div>

          {/* Section 02 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
              02 / Contractual differences
            </h3>
            <div className="border border-[#e4e2d8] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fcfbf9] text-[10px] font-bold uppercase tracking-wider text-[#71717a] border-b border-[#e4e2d8]">
                  <tr>
                    <th className="px-5 py-3">Term</th>
                    <th className="px-5 py-3">Accepted Quote</th>
                    <th className="px-5 py-3">Final PI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ede4]">
                  <tr>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">Material thickness</p>
                      <p className="text-gray-400 text-[11px]">Quote p. 2 → PI p. 1</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">8 mm</td>
                    <td className="px-5 py-3.5 font-bold text-[#b45309]">6 mm</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">Delivery commitment</p>
                      <p className="text-gray-400 text-[11px]">Quote p. 3 → PI p. 2</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">7 days</td>
                    <td className="px-5 py-3.5 font-bold text-[#b45309]">20 days</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">Advance payment</p>
                      <p className="text-gray-400 text-[11px]">Quote p. 3 → PI p. 2</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">30%</td>
                    <td className="px-5 py-3.5 font-bold text-[#c2410c]">80%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 03 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
              03 / Advance exposure
            </h3>
            <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-5 space-y-2">
              <span className="text-[10px] font-bold uppercase text-[#b45309]">
                Additional advance exposure
              </span>
              <div className="text-3xl font-extrabold text-[#b45309]">
                ₹2,40,000
              </div>
              <div className="text-xs text-[#78350f] space-y-1">
                <p>30% · ₹1,44,000 agreed</p>
                <p>80% · ₹3,84,000 proposed</p>
              </div>
              <p className="text-[11px] text-gray-500 pt-2 border-t border-[#fef3c7]">
                Order value: ₹4,80,000, unchanged. Exposure is not a loss estimate.
              </p>
            </div>
          </div>

          {/* Section 04 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
              04 / Evidence register
            </h3>
            <div className="space-y-1.5 text-xs text-gray-700">
              <p>• RFQ · 2 pages · Requirements</p>
              <p>• Accepted quotation · pp. 2–3 · Agreed terms</p>
              <p>• Final PI · pp. 1–2 · Payment request</p>
              <p className="text-gray-500 italic pt-1">
                TinyFish public context is illustrative / unverified, not contractual evidence.
              </p>
            </div>
          </div>

          {/* Section 05 */}
          <div className="space-y-2 border-t border-[#e4e2d8] pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
              05 / Human review
            </h3>
            <div className="text-xs text-gray-700 space-y-1">
              <p>
                <span className="font-semibold">Reviewer:</span> Aditi Mehta
              </p>
              <p>
                <span className="font-semibold">Decision:</span> Awaiting review
              </p>
              <p className="text-gray-500">
                No approval, clarification request or hold recorded.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-[#e4e2d8] text-center text-[10px] text-gray-400">
            Illustrative dataset and page references. Not real verified documents, actual public research or payment authorisation. Exposure is not a loss estimate.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ConnectedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return DEMO_MODE ? <IllustrativeReportsPage params={params} /> : <LiveCaseWorkspace id={id} view="reports" />;
}
