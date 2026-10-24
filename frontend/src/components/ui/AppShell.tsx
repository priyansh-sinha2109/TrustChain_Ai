"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import {
  LayoutDashboard,
  FolderOpen,
  UserCheck,
  FileBarChart,
  HelpCircle,
  Plus,
  Bell,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { api, ApiError, DEMO_MODE } from "@/lib/api";
import { SyntheticBanner } from "./SyntheticBanner";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumb?: string;
}

export function AppShell({ children, breadcrumb = "Workspace / Overview" }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [authenticated, setAuthenticated] = useState(DEMO_MODE);
  const [membershipError, setMembershipError] = useState("");
  const [workspace, setWorkspace] = useState("");
  const matchedCase = pathname.match(/^\/cases\/([^/]+)/)?.[1];
  const caseId = matchedCase === "new" ? undefined : matchedCase;
  useEffect(() => {
    if (DEMO_MODE) return;
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) { router.replace("/auth"); return; }
      try {
        const membership = await api.getMembership();
        if (!mounted) return;
        setWorkspace(membership.organization_name);
        setAuthenticated(true);
      } catch (failure) {
        if (!mounted) return;
        if (failure instanceof ApiError && failure.code === "MEMBERSHIP_REQUIRED") router.replace("/onboarding");
        else setMembershipError(failure instanceof Error ? failure.message : "Unable to verify membership.");
      }
      setIdentity(data.session.user.email || "Signed-in member");
    }).catch(() => { if (mounted) router.replace("/auth"); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/auth");
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [router]);

  const navItems = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      label: "Investigations",
      href: "/cases",
      icon: FolderOpen,
      active: pathname.startsWith("/cases") && !pathname.includes("/review") && !pathname.includes("/reports"),
    },
    {
      label: "Human review",
      href: caseId && caseId !== "new" ? `/cases/${caseId}/review` : "/cases",
      icon: UserCheck,
      badge: undefined,
      active: pathname.includes("/review"),
    },
    {
      label: "Reports",
      href: caseId && caseId !== "new" ? `/cases/${caseId}/reports` : "/cases",
      icon: FileBarChart,
      active: pathname.includes("/reports"),
    },
    {
      label: "Help & support",
      href: "/help",
      icon: HelpCircle,
      active: pathname === "/help",
    },
  ];

  if (membershipError) return <main className="p-8"><p role="alert">{membershipError}</p><a href="/auth" className="underline">Return to sign in</a></main>;
  if (!authenticated) return <p role="status" className="p-8">Checking your session...</p>;

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col lg:flex-row text-[#18181b]">
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#e4e2d8] sticky top-0 z-40">
        <Logo textSize="sm" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#e4e2d8] flex flex-col justify-between p-6 transition-transform duration-200 lg:translate-x-0 lg:static lg:h-screen lg:sticky lg:top-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <Logo textSize="md" />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workspace Switcher */}
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
              Workspace
            </span>
            <div className="mt-1 flex items-center justify-between px-3 py-2 bg-[#f4f4f2] rounded-lg text-sm font-medium text-[#18181b] cursor-pointer hover:bg-[#eae8e0] transition-colors">
              <span className="truncate">{DEMO_MODE ? "Illustrative workspace" : workspace}</span>
              <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-[#ecfdf5] text-[#065f46]"
                    : "text-[#52525b] hover:text-[#18181b] hover:bg-[#f8f8f6]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  )}
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] font-semibold bg-[#e4e2d8] text-[#52525b] px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* New Investigation Button */}
          <div className="pt-2">
            <Link
              href="/cases/new"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New investigation</span>
            </Link>
          </div>
        </div>

        {/* Sidebar Footer matching Figma design */}
        <div className="border-t border-[#e4e2d8] pt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-[#18181b]">
              The Last Check Before You Pay.
            </p>
            <p className="text-[11px] text-[#71717a]">
              Evidence first. Human decision.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-7 h-7 rounded-full bg-[#0d5e4b] text-white flex items-center justify-center text-xs font-semibold">
              {identity ? identity.slice(0, 2).toUpperCase() : "TC"}
            </div>
            <div className="text-xs leading-tight">
              <p className="font-medium text-[#18181b]">{identity || "Illustrative workspace"}</p>
              <p className="text-[11px] text-[#71717a]">Signed-in account</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-[#e4e2d8] sticky top-0 z-30">
          <div className="text-xs font-medium text-[#71717a]">
            {breadcrumb}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <Link
              href="/auth"
              className="text-xs font-medium text-[#0d5e4b] hover:underline"
            >
              Switch account
            </Link>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <SyntheticBanner />
          {children}
        </main>

        {/* Global Compliance Caption from Figma */}
        <footer className="px-8 py-4 border-t border-[#e4e2d8] text-center text-xs text-[#71717a]">
          AI flags the changes. Your team makes the decision. No payment is automatically authorised.
        </footer>
      </div>
    </div>
  );
}
