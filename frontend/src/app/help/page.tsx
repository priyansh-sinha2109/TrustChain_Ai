"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { Search } from "lucide-react";

export default function HelpPage() {
  const [tab, setTab] = useState<"guide" | "faqs" | "principles">("guide");
  const [search, setSearch] = useState("");

  return (
    <AppShell breadcrumb="Workspace / Help & support">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header matching Figma */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Workspace / Help &amp; Support
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            A clearer way to verify.
          </h1>
          <p className="text-sm text-[#71717a]">
            Practical guidance for your first investigation and every review after it.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents, evidence or reviews"
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#dcd9ce] rounded-xl text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b] shadow-2xs"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#e4e2d8] pb-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("guide")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === "guide"
                ? "bg-[#ecfdf5] text-[#065f46]"
                : "text-gray-500 hover:text-black"
            }`}
          >
            Platform guide
          </button>
          <button
            type="button"
            onClick={() => setTab("faqs")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === "faqs"
                ? "bg-[#ecfdf5] text-[#065f46]"
                : "text-gray-500 hover:text-black"
            }`}
          >
            FAQs
          </button>
          <button
            type="button"
            onClick={() => setTab("principles")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === "principles"
                ? "bg-[#ecfdf5] text-[#065f46]"
                : "text-gray-500 hover:text-black"
            }`}
          >
            Review principles
          </button>
        </div>

        {/* Card 1: Your first investigation */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-8 shadow-xs space-y-5">
          <h2 className="text-xl font-bold text-[#18181b]">
            Your first investigation
          </h2>

          <div className="space-y-4 text-xs text-gray-700 divide-y divide-gray-100">
            <div className="pt-2">
              <span className="font-bold text-gray-900 block text-sm">
                01 / Create a case
              </span>
              <p className="text-gray-600 mt-1">
                Add supplier, value, reference and reviewer to scope the investigation.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900 block text-sm">
                02 / Assign three PDFs
              </span>
              <p className="text-gray-600 mt-1">
                Keep requirements (RFQ), agreement baseline (Accepted Quote) and payment request (Final PI) distinct.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900 block text-sm">
                03 / Follow processing
              </span>
              <p className="text-gray-600 mt-1">
                PDF extraction parses values; TinyFish gathers separate public context; AI comparison flags discrepancies.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900 block text-sm">
                04 / Inspect source pages
              </span>
              <p className="text-gray-600 mt-1">
                Confirm each changed term directly against the original contract clauses and page numbers.
              </p>
            </div>

            <div className="pt-3">
              <span className="font-bold text-gray-900 block text-sm">
                05 / Record a human review
              </span>
              <p className="text-gray-600 mt-1">
                Approve, request clarification or place on hold. Your notes become part of the immutable audit trail.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Frequently Asked Questions matching Figma */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-8 shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-[#18181b]">
            Frequently asked questions
          </h2>
          <p className="text-xs text-gray-500 -mt-4">
            The essentials, without the jargon.
          </p>

          <div className="space-y-5 text-xs text-gray-700 divide-y divide-gray-100">
            <div className="pt-3 space-y-1">
              <h4 className="font-bold text-sm text-gray-900">
                Which three documents do I need?
              </h4>
              <p className="text-gray-600 leading-relaxed">
                The RFQ captures requirements; the accepted quotation is your agreement baseline; the final PI is the payment request. Use the accepted version, not a negotiation draft.
              </p>
            </div>

            <div className="pt-4 space-y-1">
              <h4 className="font-bold text-sm text-gray-900">
                What is additional advance exposure?
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Proposed advance minus agreed advance. For TC-024, ₹3,84,000 − ₹1,44,000 = ₹2,40,000 more upfront. It is not an estimate of loss.
              </p>
            </div>

            <div className="pt-4 space-y-1">
              <h4 className="font-bold text-sm text-gray-900">
                Is TinyFish research contractual evidence?
              </h4>
              <p className="text-gray-600 leading-relaxed">
                No. Public supplier context cannot prove that changed terms were accepted. Public examples here are illustrative / unverified; no actual browsing performed.
              </p>
            </div>

            <div className="pt-4 space-y-1">
              <h4 className="font-bold text-sm text-gray-900">
                Does AI approve a payment?
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Never. AI identifies differences and presents evidence. An authorised human records a review; your organisation&apos;s controls still govern payment release.
              </p>
            </div>

            <div className="pt-4 space-y-1">
              <h4 className="font-bold text-sm text-gray-900">
                What if an extracted value looks wrong?
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Inspect its source page. Replace unclear PDFs and re-run the check. Request clarification rather than treating uncertain extraction as a verified fact.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Banner matching Figma */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-4 text-xs text-[#065f46]">
          <span className="font-bold">Evidence first. Human judgement always.</span>{" "}
          TrustChain AI does not certify suppliers, guarantee delivery or automatically authorise payment.
        </div>
      </div>
    </AppShell>
  );
}
