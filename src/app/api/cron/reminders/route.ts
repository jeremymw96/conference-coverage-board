import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emailChiefs, baseEmailShell } from "@/lib/email";
import { fmtRangeISO } from "@/lib/dates";
import type { RequestRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Daily sweep (Vercel Cron): email the chiefs a digest of requests that have been
// pending a decision for more than 7 days.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await sb
    .from("requests")
    .select("*")
    .eq("status", "pending")
    .lt("submitted_at", cutoff)
    .order("submitted_at");

  const overdue = (data || []) as RequestRow[];
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";

  if (overdue.length) {
    const items = overdue
      .map((r) => {
        const days = Math.round((Date.now() - new Date(r.submitted_at).getTime()) / 86400000);
        return `<li style="margin-bottom:6px"><b>${r.resident_name}</b> — ${r.conference} · ${fmtRangeISO(
          r.start_date,
          r.end_date
        )} <span style="color:#b0730f">(pending ${days} days)</span></li>`;
      })
      .join("");
    await emailChiefs(
      `${overdue.length} conference request${overdue.length > 1 ? "s" : ""} awaiting a decision (7+ days)`,
      baseEmailShell(
        "Requests still awaiting a decision",
        `<p style="font-size:14px;color:#48596a">These have been pending more than 7 days:</p>
         <ul style="font-size:14px;padding-left:18px">${items}</ul>
         <p style="margin-top:16px"><a href="${site}/console" style="background:#0e7a86;color:#fff;padding:9px 15px;border-radius:8px;text-decoration:none;font-weight:600">Open the review board</a></p>`
      )
    );
  }

  return NextResponse.json({ ok: true, overdue: overdue.length });
}
