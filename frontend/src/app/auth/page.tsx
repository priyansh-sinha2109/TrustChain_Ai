"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authFailure } from "@/lib/authErrors";
import { ArrowLeft, Check, AlertCircle, Loader2 } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function showFailure(failure: unknown) {
    const result = authFailure(failure);
    setError(result.message);
    setDiagnostic(result.diagnostic);
    if (result.limited) setCooldown(60);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current || cooldown) return;
    pending.current = true;
    setError(null);
    setSuccessMsg(null);
    setDiagnostic("");
    setLoading(true);

    try {
      // Attempt Supabase live signin
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sbError) throw sbError;
      if (!data.session) throw new Error("No authenticated session was returned.");
      setSuccessMsg("Signed in. Opening workspace...");
      router.push("/dashboard");
    } catch (err: unknown) {
      showFailure(err);
    } finally {
      setLoading(false);
      pending.current = false;
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current || cooldown) return;
    pending.current = true;
    setError(null);
    setSuccessMsg(null);
    setDiagnostic("");
    setLoading(true);

    try {
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            organization_name: orgName,
          },
        },
      });

      if (sbError) throw sbError;
      if (!data.user) throw new Error("No account response returned.");
      setSuccessMsg(data.session ? "Account authenticated. Complete workspace setup next." : "Signup request accepted. If eligible, check your email to confirm your account, then sign in to set up your workspace.");
      if (data.session) router.push("/onboarding");
    } catch (err: unknown) {
      showFailure(err);
    } finally {
      setLoading(false);
      pending.current = false;
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white">
      {/* Left Column: Forest Green Brand Hero Panel */}
      <div className="lg:col-span-5 bg-[#0e382f] text-white p-8 lg:p-14 flex flex-col justify-between">
        <div className="space-y-12">
          {/* Logo with white text */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#10b981]">
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
            <span className="font-semibold text-lg text-white">
              TrustChain <span className="text-[#10b981]">AI</span>
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              The Last Check <br />
              Before You Pay.
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed max-w-sm">
              A clearer view of what changed, before you commit your advance.
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <div className="text-3xl font-bold text-[#6ee7b7]">
              30% → 80%
            </div>
            <div className="text-lg font-medium text-gray-200">
              ₹2,40,000 more upfront. <br />
              The same ₹4,80,000 order.
            </div>
          </div>
        </div>

        <div className="pt-8 text-xs text-gray-400 border-t border-emerald-900/40">
          Illustrative example · Human review required. <br />
          Built by Team Ashwamedha.
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="lg:col-span-7 bg-[#f7f6f2] p-8 lg:p-14 flex flex-col justify-between">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-black"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to TrustChain AI</span>
          </Link>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#18181b]">
              {tab === "login" ? "Welcome back." : "Create your workspace"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {tab === "login"
                ? "Sign in to your procurement workspace."
                : "Set up a workspace for your procurement team."}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-[#e8e6dc] p-1 rounded-lg">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setTab("login");
                setError(null); setSuccessMsg(null); setDiagnostic("");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "login"
                  ? "bg-white text-[#18181b] shadow-xs"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setTab("signup");
                setError(null); setSuccessMsg(null); setDiagnostic("");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "signup"
                  ? "bg-white text-[#18181b] shadow-xs"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}{diagnostic ? <small className="block mt-1">{diagnostic}</small> : null}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={tab === "login" ? handleLogin : handleSignup}
            className="space-y-4"
          >
            {tab === "signup" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Organisation name
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your company or workshop"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aditi@example.in"
                className="w-full px-3.5 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#dcd9ce] rounded-lg text-sm text-[#18181b] focus:ring-2 focus:ring-[#0d5e4b]"
              />
            </div>

            {tab === "login" && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-gray-600">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-[#dcd9ce] text-[#0d5e4b] focus:ring-[#0d5e4b]"
                  />
                  <span>Remember me</span>
                </label>
                <a href="#forgot" className="text-[#0d5e4b] hover:underline">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full btn-primary py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {cooldown ? `Try again in ${cooldown}s` : tab === "login"
                  ? "Log in to workspace"
                  : "Create a free account"}
              </span>
            </button>
          </form>

          {/* Lower invitation card */}
          {tab === "login" && (
            <div className="bg-white border border-[#e4e2d8] rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-[#18181b]">
                New to TrustChain AI?
              </h4>
              <p className="text-xs text-gray-600">
                Set up a workspace for your procurement team.
              </p>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className="w-full btn-secondary py-2 text-xs font-medium"
              >
                Create a free account
              </button>
              <p className="text-[11px] text-gray-400">
                Continue with your work email. Already invited? Use the email on your invitation.
              </p>
            </div>
          )}
        </div>

        {/* Auth Footer */}
        <div className="max-w-md w-full mx-auto pt-8 border-t border-[#e4e2d8] text-[11px] text-gray-500 space-y-1">
          <p>
            By continuing, you agree to the Terms of Use and Privacy Policy. Illustrative account-access screen.
          </p>
          <div className="pt-1">
            <Link
              href="/help"
              className="text-[#0d5e4b] hover:underline font-medium"
            >
              Need help signing in? · Platform guide ↗
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
