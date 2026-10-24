"use client";

export const dynamic = "force-dynamic";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { ExposureCard } from "@/components/ui/ExposureCard";
import { EvidenceDrawer } from "@/components/ui/EvidenceDrawer";
import { api } from "@/lib/api";
import { ReviewDecision } from "@/types/api";
import { MOCK_FINDINGS_TC024 } from "@/lib/mockData";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";

export default function HumanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [decision, setDecision] = useState<ReviewDecision | null>("REQUEST_CLARIFICATION");
  const [comment, setComment] = useState(
    "Confirm changed terms: requested advance escalated to 80% and thickness reduced from 8mm to 6mm without agreed price adjustment."
  );
  const [isAuthorised, setIsAuthorised] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedDecision, setSubmittedDecision] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleRecordDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!decision || !comment.trim() || !isAuthorised) return;

    setSubmitting(true);
    try {
      await api.submitReview(id, {
        job_id: "job-024-proc",
        decision,
        comment,
      });

      setSubmittedDecision(decision);
      setTimeout(() => {
        router.push(`/cases/${id}/reports`);
      }, 1200);
    } catch (err) {
      console.error("Failed to submit review", err);
      setSubmittedDecision(decision);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell breadcrumb="Workspace / Human review">
      <div className="space-y-6">
        {/* Title Header matching Figma */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Human Review / {id}
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            The decision stays with you.
          </h1>
          <p className="text-sm text-[#71717a]">
            Check the evidence and record an accountable review.
          </p>
          <p className="text-xs text-gray-500 pt-0.5">
            {id} · Kaveri Metalworks · PO-2026-084 · Illustrative case
          </p>
        </div>

        {/* Status Banner */}
        <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 text-xs text-[#92400e] space-y-1 shadow-2xs">
          <p className="font-bold">
            {submittedDecision
              ? `Decision recorded: ${submittedDecision}`
              : "Awaiting decision · Nothing approved"}
          </p>
          <p>
            Aditi Mehta · Assigned procurement manager. No review outcome has been recorded.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form and Summary */}
          <div className="lg:col-span-8 space-y-6">
            {/* Before you decide card */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-3">
              <h3 className="font-bold text-base text-[#18181b]">
                Before you decide
              </h3>
              <div className="space-y-1.5 text-xs text-gray-700">
                <p>
                  <span className="font-semibold text-gray-900">
                    Thickness: 8 mm → 6 mm
                  </span>{" "}
                  · Quote p. 2 · PI p. 1
                </p>
                <p>
                  <span className="font-semibold text-gray-900">
                    Delivery: 7 days → 20 days
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-[#c2410c]">
                    Advance: 30% → 80%
                  </span>{" "}
                  · Quote p. 3 · PI p. 2
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="text-xs font-semibold text-[#0d5e4b] hover:underline inline-flex items-center gap-1"
                >
                  <span>Inspect source evidence</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Choose a review outcome form */}
            <form
              onSubmit={handleRecordDecision}
              className="bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-7 shadow-xs space-y-6"
            >
              <div>
                <h3 className="font-bold text-base text-[#18181b]">
                  Choose a review outcome
                </h3>
                <p className="text-xs text-[#71717a] mt-0.5">
                  {decision
                    ? `Selected: ${decision.replace(/_/g, " ")}`
                    : "No option selected · A review note is required"}
                </p>
              </div>

              {/* 3 Outcome Options matching Figma */}
              <div className="space-y-3">
                {/* Option 1: Approve */}
                <label
                  className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                    decision === "APPROVE"
                      ? "border-[#0d5e4b] bg-[#ecfdf5]/40"
                      : "border-[#e4e2d8] hover:bg-[#faf9f6]"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value="APPROVE"
                    checked={decision === "APPROVE"}
                    onChange={() => setDecision("APPROVE")}
                    className="mt-1 text-[#0d5e4b] focus:ring-[#0d5e4b]"
                  />
                  <div>
                    <span className="font-bold text-sm text-[#18181b]">
                      Approve
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Record acceptance of the documented terms. This does not release payment.
                    </p>
                  </div>
                </label>

                {/* Option 2: Request clarification */}
                <label
                  className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                    decision === "REQUEST_CLARIFICATION"
                      ? "border-[#ca8a04] bg-[#fffbeb]/50"
                      : "border-[#e4e2d8] hover:bg-[#faf9f6]"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value="REQUEST_CLARIFICATION"
                    checked={decision === "REQUEST_CLARIFICATION"}
                    onChange={() => setDecision("REQUEST_CLARIFICATION")}
                    className="mt-1 text-[#ca8a04] focus:ring-[#ca8a04]"
                  />
                  <div>
                    <span className="font-bold text-sm text-[#18181b]">
                      Request clarification
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ask for a corrected PI, written confirmation or missing evidence.
                    </p>
                  </div>
                </label>

                {/* Option 3: Place on hold */}
                <label
                  className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                    decision === "REJECT"
                      ? "border-[#dc2626] bg-[#fef2f2]/50"
                      : "border-[#e4e2d8] hover:bg-[#faf9f6]"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value="REJECT"
                    checked={decision === "REJECT"}
                    onChange={() => setDecision("REJECT")}
                    className="mt-1 text-[#dc2626] focus:ring-[#dc2626]"
                  />
                  <div>
                    <span className="font-bold text-sm text-[#18181b]">
                      Place on hold
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pause this case until the identified issues are resolved.
                    </p>
                  </div>
                </label>
              </div>

              {/* Reviewer Note textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#18181b]">
                  Review note *
                </label>
                <textarea
                  rows={4}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain the decision, clarification or conditions for proceeding..."
                  className="w-full px-4 py-3 bg-white border border-[#dcd9ce] rounded-xl text-xs text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
                />
              </div>

              {/* Authorisation checkbox */}
              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isAuthorised}
                  onChange={(e) => setIsAuthorised(e.target.checked)}
                  className="rounded border-[#dcd9ce] text-[#0d5e4b] focus:ring-[#0d5e4b]"
                />
                <span>
                  I have inspected the evidence and am authorised to record this review.
                </span>
              </label>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !decision || !isAuthorised || !comment.trim()}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {decision
                      ? `Record decision: ${
                          decision === "APPROVE"
                            ? "Approve"
                            : decision === "REQUEST_CLARIFICATION"
                            ? "Request Clarification"
                            : "Place on Hold"
                        }`
                      : "Select an outcome to record decision"}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Exposure Card & Review Trail */}
          <div className="lg:col-span-4 space-y-4">
            <ExposureCard
              exposure={MOCK_FINDINGS_TC024.advance_exposure}
              orderValue="₹4,80,000"
            />

            {/* Review trail card matching Figma */}
            <div className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs space-y-4">
              <h4 className="font-bold text-sm text-[#18181b]">Review trail</h4>
              <div className="space-y-3 text-xs text-gray-600 divide-y divide-gray-100">
                <div className="pt-1 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">24 Oct · 10:42</p>
                    <p className="text-gray-500">Example comparison completed</p>
                  </div>
                </div>

                <div className="pt-2.5 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">24 Oct · 10:45</p>
                    <p className="text-gray-500">Aditi Mehta assigned</p>
                  </div>
                </div>

                <div className="pt-2.5 flex items-start justify-between text-[#b45309]">
                  <div>
                    <p className="font-semibold">Now</p>
                    <p>
                      {submittedDecision
                        ? `Decision: ${submittedDecision}`
                        : "Awaiting human decision"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#e4e2d8]">
                <Link
                  href={`/cases/${id}/findings`}
                  className="w-full btn-secondary py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to evidence</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-500">
          An approval here is not a bank instruction. Independent procurement and finance controls still govern payment release.
        </p>

        {/* Evidence Drawer modal */}
        {drawerOpen && (
          <EvidenceDrawer
            finding={MOCK_FINDINGS_TC024.findings[0]}
            onClose={() => setDrawerOpen(false)}
            evidenceList={MOCK_FINDINGS_TC024.evidence}
          />
        )}
      </div>
    </AppShell>
  );
}
