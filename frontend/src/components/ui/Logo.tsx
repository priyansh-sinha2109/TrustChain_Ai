import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  showText?: boolean;
  textSize?: "sm" | "md" | "lg";
  href?: string;
}

export function Logo({
  className = "",
  showText = true,
  textSize = "md",
  href = "/",
}: LogoProps) {
  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Exact emerald shield icon matching Figma design */}
      <div className="w-8 h-8 shrink-0 rounded-lg bg-[#0e382f] flex items-center justify-center text-[#10b981] shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      {showText && (
        <span
          className={`whitespace-nowrap font-semibold tracking-tight text-[#18181b] ${
            textSize === "lg"
              ? "text-xl"
              : textSize === "sm"
              ? "text-sm"
              : "text-base"
          }`}
        >
          TrustChain <span className="text-[#0d5e4b] font-bold">AI</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
