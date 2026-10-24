import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  className?: string;
  highlight?: boolean;
}

export function StatCard({
  label,
  value,
  subtext,
  className = "",
  highlight = false,
}: StatCardProps) {
  return (
    <div
      className={`bg-white border border-[#e4e2d8] rounded-2xl p-6 transition-all hover:border-[#cfcbc0] ${className}`}
    >
      <p className="text-sm font-medium text-[#71717a] mb-2">{label}</p>
      <div
        className={`text-4xl lg:text-5xl font-bold tracking-tight mb-2 ${
          highlight ? "text-[#0d5e4b]" : "text-[#18181b]"
        }`}
      >
        {typeof value === "number" && value < 10 ? `0${value}` : value}
      </div>
      <p className="text-xs text-[#a1a1aa]">{subtext}</p>
    </div>
  );
}
