import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChief } from "@/lib/auth";
import { getScheduleContext, rotationFor } from "@/lib/engineData";
import { surnameOf } from "@/lib/types";

export const dynamic = "force-dynamic";

// Chief-only: suggest coverage candidates for a request — residents on a non-core
// rotation who are not themselves away during the request's dates.
export async function GET(req: NextRequest) {
  const chief = await getChief();
  if (!chief) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("request_id");
  if (!id) return NextResponse.json({ error: "missing request_id" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: reqRow } = await sb
    .from("requests")
    .select("id,resident_id,start_date,end_date")
    .eq("id", id)
    .maybeSingle();
  if (!reqRow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ctx = await getScheduleContext();

  // who is already out during this window (approved or pending) → not pullable
  const { data: overlaps } = await sb
    .from("requests")
    .select("resident_id,start_date,end_date,status")
    .neq("status", "denied");
  const out = new Set<string>();
  (overlaps || []).forEach((o) => {
    if (
      o.resident_id &&
      o.start_date <= reqRow.end_date &&
      o.end_date >= reqRow.start_date
    )
      out.add(o.resident_id);
  });

  const cands = ctx.residents
    .filter((r) => r.active && r.id !== reqRow.resident_id)
    .map((r) => {
      const rot = rotationFor(r.id, reqRow.start_date, ctx);
      return {
        id: r.id,
        name: r.full_name,
        surname: surnameOf(r.full_name),
        pgy: r.pgy,
        rot: rot.label,
        core: rot.core,
        vacation: rot.vacation,
        out: out.has(r.id),
      };
    });

  const suggested = cands
    .filter((c) => !c.core && !c.vacation && !c.out && c.rot !== "—")
    .sort((a, b) => a.name.localeCompare(b.name));
  const rest = cands
    .filter((c) => !suggested.includes(c))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ suggested, rest });
}
