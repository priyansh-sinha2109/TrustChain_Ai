"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, DEMO_MODE } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/ui/Logo";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      if (DEMO_MODE) { setError("Workspace setup requires a live account."); return; }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) { router.replace("/auth"); return; }
      // Editable display hint only. No tenant ID or authority comes from metadata.
      setName(String(data.session.user.user_metadata.organization_name || "").slice(0, 200));
      try { await api.getMembership(); if (active) router.replace("/dashboard"); }
      catch (failure) {
        if (!active) return;
        if (failure instanceof ApiError && failure.code === "MEMBERSHIP_REQUIRED") setReady(true);
        else setError(failure instanceof Error ? failure.message : "Workspace lookup failed.");
      }
    }
    void load().catch(() => { if (active) setError("Unable to verify your session. Please sign in again."); });
    return () => { active = false; };
  }, [router]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !ready) return;
    pending.current = true; setBusy(true); setError("");
    try { await api.createWorkspace(name.trim()); router.replace("/dashboard"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Workspace was not created."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f7f6f2] p-8 flex justify-center items-center">
    <section className="card-surface p-8 max-w-lg w-full space-y-5">
      <Logo /><h1 className="text-2xl font-bold">Set up your workspace</h1>
      <p className="text-sm text-gray-600">Create a separate purchasing workspace after confirming your email. You will have buyer access. An authorised administrator must separately assign reviewers; matching an organisation name does not join an existing workspace.</p>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      {!ready && !error ? <p role="status">Checking membership...</p> : null}
      {ready ? <form onSubmit={create} className="space-y-4">
        <label className="block">Organisation name<input aria-label="Organisation name" required maxLength={200} value={name} onChange={e => setName(e.target.value)} className="block border rounded-lg p-3 w-full" /></label>
        <button className="btn-primary" disabled={busy || !name.trim()}>{busy ? "Creating workspace..." : "Create buyer workspace"}</button>
      </form> : null}
      <a href="/auth" className="block text-sm underline">Sign in with another account</a>
    </section>
  </main>;
}
