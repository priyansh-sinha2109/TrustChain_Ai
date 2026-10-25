"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { api } from "@/lib/api";
import { VendorProfile } from "@/types/api";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  Sparkles,
  Lock,
  ChevronRight,
  BarChart3,
  Check,
  X,
  FileCheck2,
  Loader2,
} from "lucide-react";

const BENCHMARK_VENDORS: VendorProfile[] = [
  {
    id: "VEN-001",
    name: "Kaveri Metalworks Private Limited",
    location: "Pune Industrial Cluster, Maharashtra",
    gstin: "27AABCK1234F1Z8",
    category: "Precision Steel Blanks & Heavy Fabrication",
    trustScore: 72,
    tier: "TIER_B",
    tierLabel: "Caution / Moderate Risk",
    accreditationStatus: "0 Active Accredited ISO 9001/14001 in IAF CertSearch",
    accreditationVerified: false,
    qualityPassRate: 68.5,
    advanceExposureCap: "Max 30% Advance (Hold 70% Buffer)",
    totalVolume: "₹48,20,000",
    completedOrders: 14,
    disputeRate: "21.4% (Thickness & Lead Time deviations)",
    flaggedRisks: [
      "Substituted 6mm commercial grade on final PI against 8mm precision quote",
      "Escalated advance demand from 30% to 80% without agreed contractual addendum",
      "No third-party accredited conformity assessment found on IAF CertSearch database",
    ],
    strengths: [
      "Competitive raw material pricing (₹4.80L vs ₹5.85L market benchmark)",
      "Established 4.2 year operating history with active GSTIN compliance",
      "In-house CNC blanking machinery available on plant floor",
    ],
    publicUrl: "https://www.iafcertsearch.org/",
  },
  {
    id: "VEN-002",
    name: "Apex Precision Forgings Ltd",
    location: "Ludhiana Engineering Hub, Punjab",
    gstin: "03AABCA8912P1Z4",
    category: "High Tensile Alloy Steel & Forged Blanks",
    trustScore: 89,
    tier: "TIER_A",
    tierLabel: "Verified / Prime Supplier",
    accreditationStatus: "IAF CertSearch Verified: ISO 9001:2015 & IATF 16949",
    accreditationVerified: true,
    qualityPassRate: 98.2,
    advanceExposureCap: "Up to 50% Standard Advance Eligible",
    totalVolume: "₹1,42,80,000",
    completedOrders: 42,
    disputeRate: "1.2% (Zero material spec disputes)",
    flaggedRisks: [
      "Higher minimum order quantities (MOQ: 5 Metric Tonnes)",
    ],
    strengths: [
      "Active accredited quality management certified by TUV SUD (IAF MLA)",
      "Digital Mill Test Certificates (EN 10204 3.1) with heat batch QR verification",
      "98.2% on-time delivery across verified MSME buyers",
    ],
    publicUrl: "https://www.iafcertsearch.org/",
  },
  {
    id: "VEN-003",
    name: "Vardhman Alloy & Steel Traders",
    location: "Ahmedabad, Gujarat",
    gstin: "24AABCV3456L1Z2",
    category: "Commercial Mild Steel & Slitted Coils",
    trustScore: 44,
    tier: "TIER_C",
    tierLabel: "Severe Risk / High Caution",
    accreditationStatus: "Unverified / No Quality Certifications Available",
    accreditationVerified: false,
    qualityPassRate: 46.0,
    advanceExposureCap: "0% Advance (Full Escrow Delivery Only)",
    totalVolume: "₹12,40,000",
    completedOrders: 5,
    disputeRate: "55.0% (Repeated gauge and chemical spec failures)",
    flaggedRisks: [
      "High incidence of non-prime commercial grade masqueraded as prime engineering plate",
      "GST returns intermittently delayed > 60 days",
      "Unhedged advance requests exceeding 75% for unfamiliar buyers",
    ],
    strengths: [
      "Immediate stock availability for urgent off-the-shelf delivery",
    ],
    publicUrl: "https://indiamart.com",
  },
  {
    id: "VEN-004",
    name: "Jindal Structural & Precision Blanks",
    location: "Hisar, Haryana",
    gstin: "06AABCJ4567M1Z9",
    category: "Hot Rolled & Cold Rolled Structural Precision Blanks",
    trustScore: 94,
    tier: "TIER_A",
    tierLabel: "Prime / Institutional Tier",
    accreditationStatus: "BIS Certified (IS 2062:2011) & IAF MLA Accredited",
    accreditationVerified: true,
    qualityPassRate: 99.4,
    advanceExposureCap: "Standard Commercial Terms (40% Advance)",
    totalVolume: "₹4,80,00,000+",
    completedOrders: 118,
    disputeRate: "0.4%",
    flaggedRisks: [
      "Fixed payment terms with strict credit terms",
    ],
    strengths: [
      "Direct mill test heat traceability from blast furnace to blanking line",
      "Automated metallurgical testing lab on premises",
      "Zero contractual clause alterations between quote and invoice",
    ],
    publicUrl: "https://www.iafcertsearch.org/",
  },
];

export default function VendorTrustDirectoryPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [activeVendor, setActiveVendor] = useState<VendorProfile | null>(null);
  const [vendors, setVendors] = useState<VendorProfile[]>(BENCHMARK_VENDORS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchVendors() {
      try {
        setLoading(true);
        const data = await api.getVendors(searchTerm, selectedTier);
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setVendors(data);
        } else if (isMounted) {
          // Filter benchmark locally if backend returned empty
          const filtered = BENCHMARK_VENDORS.filter((v) => {
            const matchesSearch =
              !searchTerm ||
              v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              v.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
              v.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
              v.location.toLowerCase().includes(searchTerm.toLowerCase());
            if (selectedTier === "TIER_A") return matchesSearch && v.tier === "TIER_A";
            if (selectedTier === "TIER_B") return matchesSearch && v.tier === "TIER_B";
            if (selectedTier === "TIER_C") return matchesSearch && v.tier === "TIER_C";
            return matchesSearch;
          });
          setVendors(filtered);
        }
      } catch (err) {
        console.warn("Using benchmark vendors fallback", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchVendors();
    return () => {
      isMounted = false;
    };
  }, [searchTerm, selectedTier]);

  const filteredVendors = vendors;

  function handleStartInvestigationWithVendor(vendor: VendorProfile) {
    if (typeof window !== "undefined") {
      localStorage.setItem("tc_last_supplier_url", vendor.publicUrl);
    }
    router.push(`/cases/new`);
  }

  return (
    <AppShell breadcrumb="Workspace / B2B Vendor Trust Directory">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header matching design standard */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
            Centralized B2B Vendor Trust Rating &amp; Credential Directory
          </span>
          <h1 className="text-3xl font-extrabold text-[#18181b] tracking-tight">
            Verify before you commit capital.
          </h1>
          <p className="text-sm text-[#71717a]">
            Empirical B2B trust ratings, IAF accreditation checks, and raw material quality track records for Indian MSME manufacturing suppliers.
          </p>
        </div>

        {/* Problem Statement Resolution Banner */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#065f46]">
          <div className="space-y-1">
            <span className="font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0d5e4b]" />
              <span>Centralized Raw Material Fraud Protection for Small Businesses</span>
            </span>
            <p className="text-[#047857] leading-relaxed max-w-3xl">
              Eliminates the risk of receiving substandard goods or losing unhedged advance payments. Every supplier is audited across global IAF accreditation databases, physical MTC lab pass rates, and contractual deviation histories.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-lg bg-white font-bold text-[#065f46] border border-[#a7f3d0] shadow-2xs">
              4 Audited Mills
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-[#e4e2d8] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              {loading ? (
                <Loader2 className="w-4 h-4 text-[#0d5e4b] animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor by name, GSTIN (e.g. 27AABCK...), material category, or city..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#faf9f6] border border-[#e4e2d8] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0d5e4b] focus:bg-white text-gray-900"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500 hidden sm:block" />
            <div className="flex items-center gap-1 text-xs font-semibold bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedTier("ALL")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  selectedTier === "ALL" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-black"
                }`}
              >
                All (4)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier("TIER_A")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  selectedTier === "TIER_A" ? "bg-white text-emerald-800 shadow-2xs" : "text-gray-500 hover:text-black"
                }`}
              >
                Tier A · Prime (2)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier("TIER_B")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  selectedTier === "TIER_B" ? "bg-white text-amber-800 shadow-2xs" : "text-gray-500 hover:text-black"
                }`}
              >
                Tier B · Caution (1)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier("TIER_C")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  selectedTier === "TIER_C" ? "bg-white text-red-800 shadow-2xs" : "text-gray-500 hover:text-black"
                }`}
              >
                Tier C · High Risk (1)
              </button>
            </div>
          </div>
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredVendors.map((vendor) => {
            const isTierA = vendor.tier === "TIER_A";
            const isTierB = vendor.tier === "TIER_B";
            const isTierC = vendor.tier === "TIER_C";

            return (
              <div
                key={vendor.id}
                className="bg-white border border-[#e4e2d8] rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Row: TrustScore & Tier Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-2xs text-white ${
                          isTierA
                            ? "bg-[#0d5e4b]"
                            : isTierB
                            ? "bg-[#b45309]"
                            : "bg-[#dc2626]"
                        }`}
                      >
                        {vendor.trustScore}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-[#18181b] leading-snug">
                          {vendor.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {vendor.location} · GSTIN: <span className="font-mono">{vendor.gstin}</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                        isTierA
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : isTierB
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-red-50 text-red-800 border-red-300"
                      }`}
                    >
                      {vendor.tierLabel}
                    </span>
                  </div>

                  {/* Material Category & Accreditation status */}
                  <div className="bg-[#faf9f6] p-3 rounded-xl border border-[#e4e2d8] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Material Specialization:</span>
                      <span className="font-semibold text-gray-900">{vendor.category}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                      <span className="text-gray-500 font-medium">IAF / ISO Registry:</span>
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          vendor.accreditationVerified ? "text-emerald-700" : "text-amber-800"
                        }`}
                      >
                        {vendor.accreditationVerified ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span>{vendor.accreditationStatus}</span>
                      </span>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">
                        Material Quality Pass Rate
                      </span>
                      <span
                        className={`font-extrabold text-sm ${
                          vendor.qualityPassRate >= 90
                            ? "text-emerald-700"
                            : vendor.qualityPassRate >= 65
                            ? "text-amber-700"
                            : "text-red-700"
                        }`}
                      >
                        {vendor.qualityPassRate}%
                      </span>
                    </div>

                    <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">
                        Recommended Advance Cap
                      </span>
                      <span className="font-bold text-gray-800 text-xs truncate block">
                        {vendor.advanceExposureCap}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveVendor(vendor)}
                    className="text-xs font-semibold text-[#0d5e4b] hover:underline flex items-center gap-1"
                  >
                    <span>Inspect Full Credential Audit</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartInvestigationWithVendor(vendor)}
                    className="btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Run Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vendor Audit Detail Modal */}
        {activeVendor && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-[#e4e2d8] animate-in fade-in zoom-in-95 duration-150 space-y-6 p-6 sm:p-8">
              {/* Modal Top */}
              <div className="flex items-start justify-between border-b border-[#e4e2d8] pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-lg text-white ${
                      activeVendor.trustScore >= 80
                        ? "bg-[#0d5e4b]"
                        : activeVendor.trustScore >= 60
                        ? "bg-[#b45309]"
                        : "bg-[#dc2626]"
                    }`}
                  >
                    {activeVendor.trustScore}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-[#18181b]">
                      {activeVendor.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {activeVendor.location} · GSTIN: <span className="font-mono">{activeVendor.gstin}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveVendor(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Sections */}
              <div className="space-y-4 text-xs">
                {/* Section 1: IAF & Quality Risk */}
                <div className="bg-[#faf9f6] p-4 rounded-xl border border-[#e4e2d8] space-y-2">
                  <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0d5e4b]" />
                    <span>Accreditation &amp; Centralized Registry Trace</span>
                  </h4>
                  <p className="text-gray-700 leading-relaxed">
                    {activeVendor.accreditationStatus}. Crawled via TinyFish autonomous agent across official IAF CertSearch and state registration authorities.
                  </p>
                  <div className="pt-2 border-t border-gray-200/60 flex justify-between text-gray-500 font-mono text-[11px]">
                    <span>Contract Dispute Rate: {activeVendor.disputeRate}</span>
                    <span>Total Sourcing Volume: {activeVendor.totalVolume}</span>
                  </div>
                </div>

                {/* Section 2: Flagged Risks (Substandard material protection) */}
                <div className="bg-red-50/60 border border-red-200 p-4 rounded-xl space-y-2">
                  <h4 className="font-bold text-red-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Material Quality &amp; Contractual Risk Flags</span>
                  </h4>
                  <ul className="space-y-1 text-red-800 list-disc list-inside">
                    {activeVendor.flaggedRisks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>

                {/* Section 3: Recommended MSME Advance Exposure Rule */}
                <div className="bg-[#ecfdf5] border border-[#a7f3d0] p-4 rounded-xl space-y-1.5">
                  <h4 className="font-bold text-[#065f46] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#0d5e4b]" />
                    <span>TrustChain Capital Protection Rule for Small Business</span>
                  </h4>
                  <p className="text-[#047857]">
                    <span className="font-bold">Advance Payment Ceiling: </span>
                    {activeVendor.advanceExposureCap}. Always withhold remaining balance buffer until physical dimensional checks and third-party Mill Test Certificates (MTC) are validated.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveVendor(null)}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold"
                >
                  Close Inspection
                </button>
                <button
                  type="button"
                  onClick={() => handleStartInvestigationWithVendor(activeVendor)}
                  className="btn-primary py-2.5 px-5 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <span>Start Investigation with this Vendor</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
