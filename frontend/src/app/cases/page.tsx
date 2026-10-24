"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { StatusBadge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Case } from "@/types/api";
import {
  Plus,
  Search,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "awaiting" | "progress" | "drafts">("all");

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

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (tab === "awaiting") {
      return c.status?.toLowerCase().includes("await") || c.id === "TC-024";
    }
    if (tab === "progress") {
      return c.status?.toLowerCase().includes("progress") || c.id === "TC-023";
    }
    if (tab === "drafts") {
      return c.status?.toLowerCase().includes("draft") || c.id === "TC-021";
    }
    return true;
  });

  return (
    <AppShell breadcrumb="Workspace / Investigations">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
              Investigations
            </h1>
            <p className="text-sm text-[#71717a] mt-0.5">
              Track the agreement from first upload to human decision.
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

        {/* Search, Filter Bar and Tabs matching Figma */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-4 lg:p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search case, supplier or PO"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-xs font-medium text-[#18181b] cursor-pointer hover:bg-gray-50 flex-1 md:flex-initial">
                <span>All statuses</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-xs font-medium text-[#18181b] cursor-pointer hover:bg-gray-50 flex-1 md:flex-initial">
                <span>Date range</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2 border-b border-[#e4e2d8] pb-3 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                tab === "all"
                  ? "bg-[#ecfdf5] text-[#065f46]"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              All cases ({cases.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("awaiting")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                tab === "awaiting"
                  ? "bg-[#ecfdf5] text-[#065f46]"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              Awaiting review (1)
            </button>
            <button
              type="button"
              onClick={() => setTab("progress")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                tab === "progress"
                  ? "bg-[#ecfdf5] text-[#065f46]"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              In progress (1)
            </button>
            <button
              type="button"
              onClick={() => setTab("drafts")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                tab === "drafts"
                  ? "bg-[#ecfdf5] text-[#065f46]"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              Drafts (1)
            </button>
          </div>

          <p className="text-xs text-[#71717a]">
            {filteredCases.length} illustrative records · Updated: newest first ↓
          </p>

          {/* Table */}
          <div className="overflow-x-auto border border-[#f0ede4] rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fcfbf9] text-[11px] font-bold uppercase tracking-wider text-[#71717a] border-b border-[#e4e2d8]">
                <tr>
                  <th className="px-6 py-3.5">Investigation</th>
                  <th className="px-6 py-3.5">Supplier / Value</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede4]">
                {filteredCases.map((item) => (
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
                        className="font-semibold text-[#18181b] hover:text-[#0d5e4b]"
                      >
                        {item.title}
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

          {/* Pagination matching Figma */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <span className="text-xs text-[#71717a]">
              Showing 1–{filteredCases.length} of {filteredCases.length} investigations
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-bold bg-[#ecfdf5] text-[#065f46] rounded-md"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Global info banner */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-4 text-xs text-[#065f46]">
          <span className="font-bold">A case status is not a payment instruction.</span>{" "}
          Your organisation&apos;s procurement and finance controls still govern payment release.
        </div>
      </div>
    </AppShell>
  );
}
