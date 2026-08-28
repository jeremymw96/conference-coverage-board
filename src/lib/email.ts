import { Resend } from "resend";

type SendResult = { ok: boolean; skipped?: boolean; error?: string };

// Sends an email to the chiefs' shared inbox. If RESEND_API_KEY is not set, it
// no-ops gracefully so the app keeps working without email configured.
export async function emailChiefs(subject: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CHIEFS_INBOX;
  const from = process.env.EMAIL_FROM || "Coverage Board <onboarding@resend.dev>";
  if (!key || !to) return { ok: false, skipped: true };
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function baseEmailShell(title: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#16202b">
    <h2 style="margin:0 0 4px;font-size:18px">${title}</h2>
    ${bodyHtml}
    <p style="color:#7c8b99;font-size:12px;margin-top:22px">Sent by the Conference Coverage Board.</p>
  </div>`;
}
