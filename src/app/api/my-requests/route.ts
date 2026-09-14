import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoreLabel } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// Public: a resident's own requests (scoped to their id) for the confirmation list.
export async function GET(req: NextRequest) {
  const rid = req.nextUrl.searchParams.get("resident_id");
  if (!rid) return NextResponse.json({ requests: [] });
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("requests")
    .select("id,conference,start_date,end_date,rotation,status,presentation_dates,note,chief_comments")
    .eq("resident_id", rid)
    .order("start_date");
  return NextResponse.json({ requests: data || [] });
}

// Public but resident-scoped: a resident updates their OWN request.
// - presentation_dates can always be updated (e.g. adding the exact date later).
// - the full details (conference, dates, rotation, note) can be changed only while the
//   request is still pending or has been sent back for revision; doing so returns a
//   needs_revision request to pending for the chiefs to re-review.
// The request must belong to the resident_id supplied, or the update is refused.
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  const rid = b.resident_id ? String(b.resident_id) : "";
  const id = b.id ? String(b.id) : "";
  if (!rid || !id) return NextResponse.json({ error: "Missing request or resident id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: row } = await sb.from("requests").select("*").eq("id", id).maybeSingle();
  if (!row || row.resident_id !== rid) {
    return NextResponse.json({ error: "That request isn't yours to edit." }, { status: 403 });
  }

  const upd: Record<string, unknown> = {};
  if (Array.isArray(b.presentation_dates)) {
    upd.presentation_dates = b.presentation_dates.filter(Boolean);
  }

  const canEditAll = row.status === "pending" || row.status === "needs_revision";
  if (canEditAll) {
    if (b.conference != null) {
      const conf = String(b.conference).trim();
      if (!conf) return NextResponse.json({ error: "Conference can't be blank." }, { status: 400 });
      upd.conference = conf;
    }
    if (b.start_date != null) upd.start_date = b.start_date;
    if (b.end_date != null) upd.end_date = b.end_date;
    const s = (b.start_date ?? row.start_date) as string;
    const e = (b.end_date ?? row.end_date) as string;
    if (s && e && e < s) return NextResponse.json({ error: "End date is before start date." }, { status: 400 });
    if (b.rotation !== undefined) {
      const rot = b.rotation ? String(b.rotation) : null;
      upd.rotation = rot;
      upd.is_core = rot ? isCoreLabel(rot) : false;
    }
    if (b.note != null) upd.note = String(b.note);
    // Any edit to a flagged request sends it back to the chiefs for another look.
    if (row.status === "needs_revision") upd.status = "pending";
  }

  if (Object.keys(upd).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await sb.from("requests").update(upd).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
