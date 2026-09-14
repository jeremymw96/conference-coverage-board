import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChief, chiefName } from "@/lib/auth";
import { getScheduleContext, rotationFor } from "@/lib/engineData";
import { isCoreLabel } from "@/lib/schedule";
import type { ChiefComment } from "@/lib/types";

export const dynamic = "force-dynamic";

// Chief-only: act on a single request.
//   action "approve"        — approve (carries the coverage decision)
//   action "deny"           — deny
//   action "needs_revision" — flag back to the resident, with a required comment
//   action "comment"        — add a chief-to-chief note without changing status
//   action "edit"           — edit the request's details in place (any status)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const chief = await getChief();
  if (!chief) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const who = chiefName(chief);
  const b = await req.json();
  const sb = supabaseAdmin();

  const { data: reqRow } = await sb.from("requests").select("*").eq("id", params.id).maybeSingle();
  if (!reqRow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existingComments: ChiefComment[] = Array.isArray(reqRow.chief_comments)
    ? reqRow.chief_comments
    : [];

  if (b.action === "deny") {
    const { error } = await sb
      .from("requests")
      .update({
        status: "denied",
        decided_by: who,
        decided_at: new Date().toISOString(),
        coverage_needed: null,
        cover_resident_id: null,
        cover_resident_name: null,
        cover_from: null,
        note: b.note != null ? String(b.note) : reqRow.note,
      })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "approve") {
    const coverageNeeded = !!b.coverage_needed;
    let cover_resident_id: string | null = null;
    let cover_resident_name: string | null = null;
    let cover_from: string | null = null;

    if (coverageNeeded && b.cover_resident_id) {
      const ctx = await getScheduleContext();
      const cover = ctx.residents.find((r) => r.id === b.cover_resident_id);
      if (cover) {
        cover_resident_id = cover.id;
        cover_resident_name = cover.full_name;
        cover_from = rotationFor(cover.id, reqRow.start_date, ctx).label;
      }
    }

    const { error } = await sb
      .from("requests")
      .update({
        status: "approved",
        coverage_needed: coverageNeeded,
        cover_resident_id,
        cover_resident_name,
        cover_from,
        decided_by: who,
        decided_at: new Date().toISOString(),
      })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "needs_revision") {
    const text = String(b.comment || "").trim();
    if (!text) return NextResponse.json({ error: "A comment is required to request a revision." }, { status: 400 });
    const comments = [...existingComments, { author: who, text, at: new Date().toISOString() }];
    const { error } = await sb
      .from("requests")
      .update({
        status: "needs_revision",
        chief_comments: comments,
        decided_by: null,
        decided_at: null,
      })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "comment") {
    const text = String(b.comment || "").trim();
    if (!text) return NextResponse.json({ error: "Comment is empty." }, { status: 400 });
    const comments = [...existingComments, { author: who, text, at: new Date().toISOString() }];
    const { error } = await sb.from("requests").update({ chief_comments: comments }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "edit") {
    const upd: Record<string, unknown> = {};
    if (b.conference != null) {
      const conf = String(b.conference).trim();
      if (!conf) return NextResponse.json({ error: "Conference can't be blank." }, { status: 400 });
      upd.conference = conf;
    }
    if (b.start_date != null) upd.start_date = b.start_date;
    if (b.end_date != null) upd.end_date = b.end_date;
    const s = (b.start_date ?? reqRow.start_date) as string;
    const e = (b.end_date ?? reqRow.end_date) as string;
    if (s && e && e < s) return NextResponse.json({ error: "End date is before start date." }, { status: 400 });
    if (b.rotation !== undefined) {
      const rot = b.rotation ? String(b.rotation) : null;
      upd.rotation = rot;
      upd.is_core = rot ? isCoreLabel(rot) : false;
    }
    if (Array.isArray(b.presentation_dates)) upd.presentation_dates = b.presentation_dates;
    if (b.note != null) upd.note = String(b.note);
    if (Object.keys(upd).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    const { error } = await sb.from("requests").update(upd).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
