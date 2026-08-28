import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChief, chiefName } from "@/lib/auth";
import { getScheduleContext, rotationFor } from "@/lib/engineData";

export const dynamic = "force-dynamic";

// Chief-only: approve or deny a request (approve carries the coverage decision).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const chief = await getChief();
  if (!chief) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const who = chiefName(chief);
  const b = await req.json();
  const sb = supabaseAdmin();

  const { data: reqRow } = await sb.from("requests").select("*").eq("id", params.id).maybeSingle();
  if (!reqRow) return NextResponse.json({ error: "not found" }, { status: 404 });

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

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
