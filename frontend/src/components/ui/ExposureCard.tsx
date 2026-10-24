import React from "react";
import { Exposure } from "@/types/api";

interface ExposureCardProps {
  exposure?: Exposure | null;
  className?: string;
  orderValue?: string | number;
}

export function ExposureCard({
  exposure,
  className = "",
  orderValue = "₹4,80,000",
}: ExposureCardProps) {
  const difference = exposure?.difference
    ? `₹${Number(exposure.difference).toLocaleString("en-IN")}`
    : "₹2,40,000";

  const baselinePercent = exposure?.baseline_percentage ?? 30;
  const finalPercent = exposure?.final_percentage ?? 80;

  const baselineAmount = exposure?.baseline_amount
    ? `₹${Number(exposure.baseline_amount).toLocaleString("en-IN")}`
    : "₹1,44,000";

  const finalAmount = exposure?.final_amount
    ? `₹${Number(exposure.final_amount).toLocaleString("en-IN")}`
    : "₹3,84,000";

  return (
    <div
      className={`bg-[#0a2e26] text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between ${className}`}
    >
      <div>
        <p className="text-xs uppercase tracking-wider text-[#6ee7b7] font-medium mb-3">
          Additional advance exposure
        </p>
        <div className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
          {difference}
        </div>

        <div className="space-y-1.5 text-sm text-gray-200 border-t border-emerald-900/60 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">{baselinePercent}% agreed</span>
            <span className="font-medium text-white">{baselineAmount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">{finalPercent}% proposed</span>
            <span className="font-medium text-[#fca5a5]">{finalAmount}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-emerald-900/60 text-xs text-gray-400 space-y-1">
        <p>Order value: {typeof orderValue === "number" ? `₹${orderValue.toLocaleString("en-IN")}` : orderValue}, unchanged.</p>
        <p className="text-gray-400 italic">Exposure is not a loss estimate.</p>
      </div>
    </div>
  );
}
