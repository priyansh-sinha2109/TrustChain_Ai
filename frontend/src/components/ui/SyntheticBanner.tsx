import React from "react";
import { Info } from "lucide-react";
import { DEMO_MODE } from "@/lib/api";

export function SyntheticBanner({
  message = "Illustrative TC-024 benchmark dataset · Not a real supplier transaction. All evidence references demonstrate system verification behavior.",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  if (!DEMO_MODE) return null;
  return (
    <div
      className={`bg-[#fef9ee] border border-[#fef08a] rounded-xl px-4 py-2.5 text-xs text-[#854d0e] flex items-center gap-2.5 shadow-sm ${className}`}
    >
      <Info className="w-4 h-4 shrink-0 text-[#ca8a04]" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}
