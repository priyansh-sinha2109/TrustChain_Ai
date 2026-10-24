"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { ExposureCard } from "@/components/ui/ExposureCard";
import { StatusBadge } from "@/components/ui/Badge";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
import { api } from "@/lib/api";
import { Case } from "@/types/api";
import { Plus, ArrowRight, ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getCases();
        setCases(data);
      } catch (err) {
        console.error("Failed to load cases", err);
      }
    }
    loadData();
  }, []);

  const totalCases = cases.length || 4;
  const awaitingReview = cases.filter((c) =>
    c.status?.toLowerCase().includes("await") || c.id === "TC-024"
  ).length;
  const inProgress = cases.filter((c) =>
    c.status?.toLowerCase().includes("progress") || c.id === "TC-023"
  ).length;

  return (
    <AppShell breadcrumb="Workspace / Overview">
      <div className="space-y-8">
        {/* Top Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
              Overview / Demo Workspace
            </span>
            <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight mt-0.5">
              Good morning, Aditi.
            </h1>
            <p className="text-sm text-[#71717a] mt-0.5">
              A clear view of your checks before the next payment.
            </p>
          </div>

          <div>
            <Link
              href="/cases/new"
              className="btn-primary py-2.5 px-5 shadow-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New investigation</span>
            </Link>
          </div>
        </div>

        {/* 3 Metric Cards matching Figma */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard
            label="Total investigations"
            value={totalCases}
            subtext="Across this demo workspace"
          />
          <StatCard
            label="Awaiting human review"
            value={awaitingReview}
            subtext="A decision is still required"
            highlight
          />
          <StatCard
            label="In progress"
            value={inProgress}
            subtext="Comparison underway"
          />
        </div>

        {/* Highlighted Next Decision: Split Hero Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Side: Decision Details Card */}
          <div className="lg:col-span-7 bg-white border border-[#e4e2d8] rounded-2xl p-6 lg:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#18181b]">
                    Your next decision
                  </h2>
                  <p className="text-xs text-[#71717a]">
                    TC-024 · Precision steel blanks · Illustrative case
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fffbeb] text-[#92400e] border border-[#fde68a]">
                  Awaiting review · 3 discrepancies
                </span>
              </div>

              <div className="pt-2">
                <p className="font-semibold text-sm text-[#18181b]">
                  Kaveri Metalworks
                </p>
                <p className="text-xs text-[#71717a]">
                  Order value: ₹4,80,000, unchanged.
                </p>
              </div>

              {/* Discrepancy highlights */}
              <div className="space-y-1.5 text-sm text-[#3f3f46] pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Thickness 8 mm → 6 mm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Delivery 7 days → 20 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Advance 30% → 80%</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/cases/TC-024/review"
                className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2 w-fit shadow-xs"
              >
                <span>Review TC-024</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right Side: Exposure Card */}
          <div className="lg:col-span-5 flex">
            <ExposureCard className="w-full" orderValue="₹4,80,000" />
          </div>
        </div>

        {/* Recent Investigations Table */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl shadow-xs overflow-hidden">
          <div className="p-6 border-b border-[#e4e2d8] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[#18181b]">
                Recent investigations
              </h3>
              <p className="text-xs text-[#71717a] mt-0.5">
                Illustrative records · Updated 24 October 2026
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fcfbf9] text-[11px] font-bold uppercase tracking-wider text-[#71717a] border-b border-[#e4e2d8]">
                <tr>
                  <th className="px-6 py-3.5">Investigation</th>
                  <th className="px-6 py-3.5">Supplier / Value</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede4]">
                {cases.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#faf9f6] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={
                          item.id === "TC-024"
                            ? "/cases/TC-024/findings"
                            : `/cases/${item.id}/progress`
                        }
                        className="font-semibold text-[#18181b] hover:text-[#0d5e4b] flex items-center gap-1.5"
                      >
                        <span>{item.title}</span>
                      </Link>
                      <p className="text-xs text-[#71717a] mt-0.5">
                        {item.id} · {item.reference_no || "PO Ref"} ·{" "}
                        {item.id === "TC-024"
                          ? "3 changes · ₹2,40,000 exposure"
                          : "Standard check"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-[#18181b]">
                        {item.supplier_name}
                      </p>
                      <p className="text-xs text-[#71717a]">
                        ₹{(item.order_value_inr || 480000).toLocaleString("en-IN")}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.status || "Draft"} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={
                          item.id === "TC-024"
                            ? "/cases/TC-024/findings"
                            : `/cases/${item.id}/progress`
                        }
                        className="inline-flex items-center text-xs font-semibold text-[#0d5e4b] hover:underline"
                      >
                        Inspect <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-[#fcfbf9] border-t border-[#e4e2d8] text-center">
            <Link
              href="/cases"
              className="text-xs font-semibold text-[#0d5e4b] hover:underline inline-flex items-center gap-1"
            >
              <span>View all investigations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <SyntheticBanner message="Illustrative benchmark records loaded. Live FastAPI/Supabase endpoints will populate dynamic database cases when connected." />
      </div>
    </AppShell>
  );
}
