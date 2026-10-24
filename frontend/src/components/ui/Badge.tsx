import React from "react";

type BadgeVariant =
  | "awaiting"
  | "progress"
  | "clarification"
  | "draft"
  | "approved"
  | "hold"
  | "high"
  | "warning"
  | "info"
  | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "neutral", className = "" }: BadgeProps) {
  const styles: Record<BadgeVariant, string> = {
    awaiting: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
    progress: "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]",
    clarification: "bg-[#fff7ed] text-[#c2410c] border-[#ffedd5]",
    draft: "bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]",
    approved: "bg-[#ecfdf5] text-[#047857] border-[#6ee7b7]",
    hold: "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]",
    high: "bg-[#fee2e2] text-[#991b1b] border-[#f87171]",
    warning: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
    info: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
    neutral: "bg-[#f4f4f5] text-[#3f3f46] border-[#e4e4e7]",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized.includes("await") || normalized.includes("review")) {
    return <Badge variant="awaiting">Awaiting review</Badge>;
  }
  if (normalized.includes("prog") || normalized.includes("process") || normalized.includes("queued")) {
    return <Badge variant="progress">In progress</Badge>;
  }
  if (normalized.includes("clarif")) {
    return <Badge variant="clarification">Clarification requested</Badge>;
  }
  if (normalized.includes("draft")) {
    return <Badge variant="draft">Draft</Badge>;
  }
  if (normalized.includes("appr")) {
    return <Badge variant="approved">Approved</Badge>;
  }
  if (normalized.includes("hold") || normalized.includes("fail") || normalized.includes("reject")) {
    return <Badge variant="hold">Placed on hold</Badge>;
  }
  return <Badge variant="neutral">{status}</Badge>;
}
