import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChief } from "@/lib/auth";
import { isCoreLabel } from "@/lib/schedule";
import { emailChiefs, baseEmailShell } from "@/lib/email";
import { fmtRangeISO, dayCountISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Public: a resident submits a conference-leave request.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const sb = supabaseAdmin();

  const { data: resident } = await sb
    .from("residents")
    .select("id,full_name")
    .eq("id", b.resident_id)
    .maybeSingle();
  if (!resident) return NextResponse.json({ error: "Unknown resident." }, { status: 400 });

  const conference = String(b.conference || "").trim();
  if (!conference) return NextResponse.json({ error: "Conference is required." }, { status: 400 });
  if (!b.start_date || !b.end_date)
    return NextResponse.json({ error: "Dates are required." }, { status: 400 });
  if (b.end_date < b.start_date)
    return NextResponse.json({ error: "End date is before start date." }, { status: 400 });

  const rotation = b.rotation ? String(b.rotation) : null;
  const presentation_dates: string[] = Array.isArray(b.presentation_dates)
    ? b.presentation_dates
    : [];

  const { data, error } = await sb
    .from("requests")
    .insert({
      resident_id: resident.id,
      resident_name: resident.full_name,
      conference,
      start_date: b.start_date,
      end_date: b.end_date,
      rotation,
      is_core: rotation ? isCoreLabel(rotation) : false,
      presentation_dates,
      note: String(b.note || "").trim(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort email to the chiefs' inbox (never blocks the response).
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  emailChiefs(
    `New conference request — ${resident.full_name}`,
    baseEmailShell(
      "New conference-leave request",
      `<p style="font-size:15px"><b>${resident.full_name}</b> requested leave for <b>${conference}</b>.</p>
       <p style="font-size:14px;color:#48596a">${fmtRangeISO(b.start_date, b.end_date)} · ${dayCountISO(
        b.start_date,
        b.end_date
      )} days${rotation ? ` · ${rotation}${isCoreLabel(rotation) ? " (core)" : ""}` : ""}</p>
       <p style="margin-top:16px"><a href="${site}/console" style="background:#0e7a86;color:#fff;padding:9px 15px;border-radius:8px;text-decoration:none;font-weight:600">Open the review board</a></p>`
    )
  ).catch(() => {});

  return NextResponse.json({ ok: true, id: data.id });
}

// Chief-only: list all requests.
export async function GET() {
  const chief = await getChief();
  if (!chief) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("requests").select("*").order("start_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}
