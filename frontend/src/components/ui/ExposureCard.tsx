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
  orderValue,
}: ExposureCardProps) {
  const money = (value?: string | null) => value == null ? "Not calculated" :
    `${exposure?.currency || ""} ${Number(value).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const difference = exposure?.status === "CALCULATED" ? money(exposure.difference) : "Not calculated";

  const baselinePercent = exposure?.baseline_percentage;
  const finalPercent = exposure?.final_percentage;

  const baselineAmount = money(exposure?.baseline_amount);

  const finalAmount = money(exposure?.final_amount);

  return (
    <div
      className={`bg-[#0a2e26] text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between ${className}`}
    >
      <div>
        <p className="text-xs uppercase tracking-wider text-[#6ee7b7] font-medium mb-3">
          Additional advance exposure
        </p>
        <div className="text-3xl xl:text-4xl break-words tabular-nums font-bold tracking-tight text-white mb-4">
          {difference}
        </div>

        <div className="space-y-1.5 text-sm text-gray-200 border-t border-emerald-900/60 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-gray-300">{baselinePercent == null ? "Accepted advance" : `${baselinePercent}% agreed`}</span>
            <span className="font-medium text-white">{baselineAmount}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-gray-300">{finalPercent == null ? "Final advance" : `${finalPercent}% proposed`}</span>
            <span className="font-medium text-[#fca5a5]">{finalAmount}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-emerald-900/60 text-xs text-gray-400 space-y-1">
        {orderValue != null ? <p>Order value: {orderValue}</p> : <p>Each advance uses its own document total.</p>}
        <p className="text-gray-400 italic">Exposure is not a loss estimate.</p>
      </div>
    </div>
  );
}
