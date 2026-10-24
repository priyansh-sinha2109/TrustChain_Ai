import React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import {
  ArrowRight,
  FileText,
  TrendingUp,
  Search,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#18181b] flex flex-col justify-between">
      {/* Top Navbar matching Figma */}
      <nav className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-wrap gap-4 items-center justify-between">
        <Logo textSize="lg" />

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#52525b]">
          <a href="#why" className="hover:text-[#18181b] transition-colors">
            Why TrustChain
          </a>
          <a href="#how" className="hover:text-[#18181b] transition-colors">
            How it works
          </a>
          <Link href="/help" className="hover:text-[#18181b] transition-colors">
            Platform guide
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/auth"
            className="btn-primary py-2 px-5 text-sm rounded-full font-medium shadow-xs"
          >
            Log in / Sign up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto w-full px-6 pt-10 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#0d5e4b] bg-[#ecfdf5] px-3 py-1 rounded-full border border-[#a7f3d0]">
              Pre-advance procurement check
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#18181b] leading-[1.1]">
            The Last Check <br />
            <span className="text-[#0d5e4b]">Before You Pay.</span>
          </h1>

          <p className="text-xl font-medium text-[#27272a] max-w-xl">
            Don&apos;t just compare quotes. Verify what you&apos;re about to pay for.
          </p>

          <p className="text-sm text-[#52525b] max-w-xl leading-relaxed">
            Spot specification, delivery and advance-payment changes between your accepted quotation and final proforma invoice — before money leaves your business.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/dashboard"
              className="btn-primary py-3.5 px-6 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm"
            >
              <span>Start an investigation</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/help"
              className="btn-secondary py-3.5 px-6 rounded-lg text-sm font-semibold shadow-xs"
            >
              Explore the example
            </Link>
          </div>

          <p className="text-xs text-[#71717a] pt-1">
            AI flags the changes. Your team makes the decision.
          </p>
        </div>

        {/* Right Column: Illustrative Case Box */}
        <div className="lg:col-span-5">
          <div className="bg-[#eaf4f0] border border-[#d2e8de] rounded-3xl p-4 lg:p-6 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#065f46] mb-3">
              A Closer Look · Illustrative Case
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#e4e2d8] shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-lg text-[#18181b]">
                  Same price. Different risk.
                </h3>
                <p className="text-xs text-gray-500">
                  Precision steel blanks · Order ₹4,80,000
                </p>
              </div>

              {/* Discrepancy comparison lines */}
              <div className="space-y-2 text-sm pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Thickness</span>
                  <span className="font-semibold text-[#b45309]">8 mm → 6 mm</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Delivery</span>
                  <span className="font-semibold text-[#b45309]">7 days → 20 days</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Advance</span>
                  <span className="font-semibold text-[#c2410c]">30% → 80%</span>
                </div>
              </div>

              {/* Advance Exposure box */}
              <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4">
                <div className="text-[10px] font-bold text-[#b45309] uppercase tracking-wider">
                  Additional advance exposure
                </div>
                <div className="text-3xl font-extrabold text-[#b45309] mt-1">
                  ₹2,40,000
                </div>
                <p className="text-xs text-[#78350f] mt-1">
                  ₹1,44,000 agreed → ₹3,84,000 proposed. Awaiting authorised human review.
                </p>
              </div>
            </div>

            <div className="text-center text-[11px] text-[#065f46] mt-3">
              Illustrative scenario, not a completed verification.
            </div>
          </div>
        </div>
      </section>

      {/* Built for Indian Manufacturing bar */}
      <section className="bg-white border-y border-[#e4e2d8] py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span className="font-bold uppercase tracking-wider text-[#71717a]">
            Built for Indian Manufacturing
          </span>
          <span className="text-[#52525b] text-center sm:text-right font-medium">
            Automobile components · Sheet-metal fabrication · Metalworking MSMEs · Procurement &amp; finance
          </span>
        </div>
      </section>

      {/* Section 2: 3 Value Pillars */}
      <section id="why" className="max-w-7xl mx-auto w-full px-6 py-20 space-y-12">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
            Confidence comes from the details
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#18181b]">
            The total can match. The agreement might not.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white border border-[#e4e2d8] rounded-2xl p-8 space-y-4 hover:border-[#cfcbc0] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#0d5e4b] flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#18181b]">
              Catch specification changes
            </h3>
            <p className="text-sm text-[#52525b] leading-relaxed">
              A lower material grade or thickness should never hide behind an unchanged price. Compare the details you agreed to.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-[#e4e2d8] rounded-2xl p-8 space-y-4 hover:border-[#cfcbc0] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#0d5e4b] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#18181b]">
              See your cash exposure
            </h3>
            <p className="text-sm text-[#52525b] leading-relaxed">
              Separate order value from the advance being requested. In the example, 30% becomes 80% — ₹2,40,000 more upfront.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-[#e4e2d8] rounded-2xl p-8 space-y-4 hover:border-[#cfcbc0] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#0d5e4b] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#18181b]">
              Follow every flag to a source
            </h3>
            <p className="text-sm text-[#52525b] leading-relaxed">
              Inspect document pages. Keep public supplier context distinct from contractual evidence and your accepted terms.
            </p>
          </div>
        </div>

        <p className="text-xs text-[#71717a] text-center pt-4">
          Evidence-led decision support. Never automatic payment authorisation.
        </p>
      </section>

      {/* Section 3: Four Clear Steps */}
      <section id="how" className="bg-white border-t border-[#e4e2d8] py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0d5e4b]">
              A clear path to a considered decision
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#18181b]">
              Three documents. One clear review.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#0d5e4b]">01</div>
              <h4 className="font-bold text-base text-[#18181b]">
                Bring the agreement
              </h4>
              <p className="text-xs text-[#52525b] leading-relaxed">
                Upload the RFQ, accepted quotation and final PI. Each has a distinct role.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#0d5e4b]">02</div>
              <h4 className="font-bold text-base text-[#18181b]">
                Follow the differences
              </h4>
              <p className="text-xs text-[#52525b] leading-relaxed">
                PDF extraction and AI comparison flag changes. TinyFish adds separate public context.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#0d5e4b]">03</div>
              <h4 className="font-bold text-base text-[#18181b]">
                Check the evidence
              </h4>
              <p className="text-xs text-[#52525b] leading-relaxed">
                Inspect source pages, confirm extracted values and clarify uncertainty.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#0d5e4b]">04</div>
              <h4 className="font-bold text-base text-[#18181b]">
                Keep people in control
              </h4>
              <p className="text-xs text-[#52525b] leading-relaxed">
                An authorised reviewer approves, requests clarification or places the case on hold.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Forest Green Call to Action Banner */}
      <section className="bg-[#0e382f] text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#a7f3d0]">
            Protect the agreement. Not just the total.
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Make your next advance a more informed one.
          </h2>
          <p className="text-sm sm:text-base text-gray-300 max-w-xl mx-auto">
            Start with your documents. Leave with a traceable review, not an unexplained risk score.
          </p>
          <div className="pt-4">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] text-[#0e382f] font-bold py-3.5 px-8 rounded-lg text-sm transition-colors shadow-lg"
            >
              <span>Create your workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e4e2d8] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <Logo textSize="md" />
            <p className="text-xs text-gray-500">
              The Last Check Before You Pay.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#52525b] font-medium">
            <Link href="/help" className="hover:text-black">
              Platform guide
            </Link>
            <Link href="/help" className="hover:text-black">
              Help
            </Link>
            <Link href="/auth" className="hover:text-black">
              Log in
            </Link>
          </div>

          <div className="text-xs text-gray-400 text-center md:text-right">
            Built by Team Ashwamedha · 18-hour hackathon origin · 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
