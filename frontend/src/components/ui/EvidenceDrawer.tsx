import React from "react";
import { Finding, Evidence } from "@/types/api";
import { X, ExternalLink, ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";

interface EvidenceDrawerProps {
  finding: Finding | null;
  onClose: () => void;
  evidenceList?: Evidence[];
}

export function EvidenceDrawer({
  finding,
  onClose,
  evidenceList = [],
}: EvidenceDrawerProps) {
  if (!finding) return null;

  const baselineField = finding.baseline?.[0];
  const finalField = finding.final?.[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="bg-[#f7f6f2] w-full min-w-0 max-w-3xl min-h-full break-words p-6 lg:p-8 flex flex-col justify-between shadow-2xl border-l border-[#e4e2d8] ">
        <div className="space-y-6">
          {/* Drawer Header */}
          <div className="flex items-start justify-between border-b border-[#e4e2d8] pb-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0d5e4b] bg-[#ecfdf5] px-2 py-0.5 rounded-sm">
                {finding.category} DISCREPANCY
              </span>
              <h2 className="text-2xl font-bold text-[#18181b] mt-1">
                {finding.label || finding.field_key.replace(/_/g, " ")}:{" "}
                <span className="text-[#0d5e4b]">
                  {baselineField?.value || "Agreed"}
                </span>{" "}
                →{" "}
                <span className="text-[#dc2626]">
                  {finalField?.value || "Proposed"}
                </span>
              </h2>
              <p className="text-xs text-[#71717a] mt-0.5">
                {finding.explanation}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-[#e4e2d8]"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Side by side comparison cards matching Figma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Accepted Quote Document */}
            <div className="bg-white border border-[#e4e2d8] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Contractual Baseline · Accepted Quote
                </p>
                <h3 className="font-semibold text-sm text-[#18181b] mt-1">
                  KAVERI METALWORKS
                </h3>
                <p className="text-xs text-gray-500">
                  Quote QT-084 · Page {baselineField?.page_number || 2}
                </p>

                {/* Highlighted clause */}
                <div className="mt-4 bg-[#fef9ee] border-l-4 border-[#ca8a04] p-3 rounded-r-md">
                  <p className="text-[10px] uppercase font-bold text-[#854d0e]">
                    Page {baselineField?.page_number || 2} · Clause
                  </p>
                  <p className="text-sm font-semibold text-[#18181b] mt-0.5">
                    {finding.label || "Value"}: {baselineField?.value || "30%"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 italic">
                    &quot;{baselineField?.raw_text || "Terms as documented in accepted quote."}&quot;
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Ref: Doc-084-A</span>
                <span className="text-[#0d5e4b] font-medium">Agreed Term</span>
              </div>
            </div>

            {/* Final PI Document */}
            <div className="bg-white border border-[#e4e2d8] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Latest Payment Request · Final PI
                </p>
                <h3 className="font-semibold text-sm text-[#18181b] mt-1">
                  KAVERI METALWORKS
                </h3>
                <p className="text-xs text-gray-500">
                  Proforma PI-084 · Page {finalField?.page_number || 1}
                </p>

                {/* Highlighted clause */}
                <div className="mt-4 bg-[#fff1f2] border-l-4 border-[#e11d48] p-3 rounded-r-md">
                  <p className="text-[10px] uppercase font-bold text-[#9f1239]">
                    Page {finalField?.page_number || 1} · Clause
                  </p>
                  <p className="text-sm font-semibold text-[#dc2626] mt-0.5">
                    {finding.label || "Value"}: {finalField?.value || "80%"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 italic">
                    &quot;{finalField?.raw_text || "Payment terms requested on final proforma."}&quot;
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Ref: Doc-084-B</span>
                <span className="text-[#dc2626] font-medium">Discrepancy</span>
              </div>
            </div>
          </div>

          {/* Navigation and PDF trigger controls */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous page
            </button>
            <button
              type="button"
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              Next page <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.open("#", "_blank")}
              className="btn-secondary text-xs py-2 px-3 ml-auto flex items-center gap-1.5 text-[#0d5e4b]"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open source PDF
            </button>
          </div>

          {/* Public context observations (TinyFish) */}
          <div className="bg-white border border-[#e4e2d8] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#0d5e4b]" />
              <h4 className="text-sm font-semibold text-[#18181b]">
                Public supplier context · TinyFish
              </h4>
            </div>
            <p className="text-xs text-gray-500">
              Corroborative public evidence. Public supplier context is separate and cannot alter contractual agreements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {evidenceList.map((ev, idx) => (
                <div
                  key={idx}
                  className="bg-[#f7f6f2] p-3 rounded-lg border border-[#e4e2d8] text-xs space-y-1"
                >
                  <a
                    href={ev.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#0d5e4b] hover:underline flex items-center gap-1 truncate"
                  >
                    <span>{ev.source_url.replace("https://", "")}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <p className="text-gray-700 leading-snug">{ev.observation}</p>
                </div>
              ))}
              {evidenceList.length === 0 && (
                <p className="text-xs text-gray-400 italic col-span-2">
                  No public anomalies detected. Contractual discrepancies remain binding.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-6 border-t border-[#e4e2d8] mt-6 flex justify-end">
          <button onClick={onClose} className="btn-primary text-sm py-2 px-6">
            Close inspector
          </button>
        </div>
      </div>
    </div>
  );
}
