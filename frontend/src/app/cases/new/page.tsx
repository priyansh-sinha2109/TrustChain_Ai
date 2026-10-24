"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { api } from "@/lib/api";
import { ChevronDown, ArrowRight, Save, Loader2 } from "lucide-react";

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("Precision steel blanks");
  const [supplierName, setSupplierName] = useState("Kaveri Metalworks");
  const [referenceNo, setReferenceNo] = useState("PO-2026-084");
  const [orderValue, setOrderValue] = useState("480000");
  const [category, setCategory] = useState("Sheet metal & fabrication");
  const [reviewer, setReviewer] = useState("Aditi Mehta · Procurement manager");
  const [notes, setNotes] = useState(
    "Check thickness, delivery and advance terms against the accepted quotation."
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const created = await api.createCase({
        title,
        supplier_name: supplierName,
        reference_no: referenceNo,
        order_value_inr: Number(orderValue) || 480000,
        category,
        reviewer_name: reviewer,
        notes,
      });

      router.push(`/cases/${created.id || "TC-024"}/documents`);
    } catch (err) {
      console.error("Failed to create case", err);
      router.push("/cases/TC-024/documents");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="max-w-4xl mx-auto space-y-6">
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
        <div className="bg-white border border-[#e4e2d8] rounded-xl px-6 py-4 flex items-center gap-3 text-xs font-semibold shadow-xs">
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#18181b]">
                  Purchase order / reference
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. PO-2026-084"
                  className="w-full px-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
                />
              </div>
            </div>

            {/* Two column: Order value & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#18181b]">
                  Order value (INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    required
                    value={orderValue}
                    onChange={(e) => setOrderValue(e.target.value)}
                    placeholder="480000"
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#18181b]">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b] pr-10"
                  >
                    <option>Sheet metal &amp; fabrication</option>
                    <option>Automotive stamping components</option>
                    <option>CNC machined tooling</option>
                    <option>General metalworking MSME</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Authorised reviewer */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#18181b]">
                Authorised reviewer *
              </label>
              <input
                type="text"
                required
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
              />
            </div>

            {/* Review notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#18181b]">
                Review notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
              />
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#71717a]">
            Illustrative TC-024 dataset · Not a real supplier transaction.
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-[#e4e2d8] flex items-center gap-3">
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
              <Save className="w-4 h-4" />
              <span>Save draft</span>
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
