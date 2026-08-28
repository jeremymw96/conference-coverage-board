"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    window.location.href = "/console";
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ maxWidth: 400, width: "100%", padding: 28 }}>
        <div className="brand" style={{ marginBottom: 18 }}>
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Chief sign-in</div>
            <div className="brand-sub">Conference Coverage Board</div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ufhealth.org" autoComplete="username" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
          {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <button className="btn primary" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ color: "var(--ink-3)", fontSize: 12, marginTop: 12 }}>
            Chiefs only. Residents don&rsquo;t sign in — they use the request form. Locked out? Ask another chief to reset your password in Supabase.
          </p>
        </form>
      </div>
    </div>
  );
}
