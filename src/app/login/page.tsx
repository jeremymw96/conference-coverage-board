"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const sb = supabaseBrowser();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${site}/auth/callback` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
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

        {sent ? (
          <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>
            Check your email — we sent a sign-in link to <b>{email}</b>. Open it on this device to
            enter the console.
          </p>
        ) : (
          <form onSubmit={send}>
            <div className="field">
              <label>Your UF Health email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ufhealth.org"
              />
            </div>
            {err && (
              <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>
            )}
            <button className="btn primary" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            <p style={{ color: "var(--ink-3)", fontSize: 12, marginTop: 12 }}>
              Only the chiefs&rsquo; addresses can enter. Residents don&rsquo;t sign in — they use the
              request form.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
