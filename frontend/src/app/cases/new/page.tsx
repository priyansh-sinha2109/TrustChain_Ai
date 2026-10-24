"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { api } from "@/lib/api";
import { ArrowRight, Loader2 } from "lucide-react";

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const created = await api.createCase({
        title,
        supplier_name: supplierName,
        public_supplier_url: publicUrl || null,
      });

      router.push(`/cases/${created.id}/documents`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Case creation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="max-w-4xl mx-auto space-y-6">
        {error ? <p role="alert" className="text-red-700">{error}</p> : null}
        <p className="text-xs text-gray-600">Save the case title, supplier and optional public URL. Commercial terms come from uploaded PDFs. Reviewer permissions come from verified organisation membership.</p>
        {/* Title Header */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Investigations / New Case
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            Start with the agreement.
          </h1>
          <p className="text-sm text-[#71717a]">
            Create a case, add three documents, then review the findings.
          </p>
        </div>

        {/* Stepper Header */}
        <div className="bg-white border border-[#e4e2d8] rounded-xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 text-xs font-semibold shadow-xs">
          <span className="text-[#0d5e4b] font-bold">1 Case details</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-400">2 Documents</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-400">3 Verify &amp; review</span>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-8 shadow-xs space-y-6"
        >
          <div>
            <h2 className="text-xl font-bold text-[#18181b]">Case details</h2>
            <p className="text-xs text-[#71717a] mt-0.5">
              Step 1 of 3 · * Required
            </p>
          </div>

          <div className="space-y-4">
            {/* Investigation name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#18181b]">
                Investigation name *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Precision steel blanks"
                className="w-full px-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
              />
            </div>

            <label className="block text-xs font-semibold">Public supplier URL (optional)<input aria-label="Public supplier URL" type="url" value={publicUrl} onChange={e => setPublicUrl(e.target.value)} className="field-control" /></label>
            <p className="text-xs text-[#71717a]">Only public pages. Your documents are never sent to the web agent.</p>
            {/* Two column: Supplier & PO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#18181b]">
                  Supplier name *
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Kaveri Metalworks"
                  className="w-full px-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
                />
              </div>

            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#71717a]">
            Commercial terms and financial exposure are extracted from your uploaded documents.
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-[#e4e2d8] flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Continue to documents</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => router.push("/cases")}
              className="btn-secondary py-2.5 px-5 text-sm flex items-center gap-2"
            >
              <span>Cancel</span>
            </button>
          </div>
        </form>

        <p className="text-xs text-center text-[#71717a]">
          Creating a case does not contact your supplier or authorise a payment.
        </p>
      </div>
    </AppShell>
  );
}
