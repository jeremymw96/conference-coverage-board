import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChief } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function guard() {
  const chief = await getChief();
  return !!chief;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("residents")
    .select("id,full_name,sched_key,pgy,clinic_cohort,active")
    .order("pgy")
    .order("full_name");
  return NextResponse.json({ residents: data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.full_name || !b.sched_key)
    return NextResponse.json({ error: "Name and schedule key are required." }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("residents").insert({
    full_name: String(b.full_name).trim(),
    sched_key: String(b.sched_key).trim(),
    pgy: Number(b.pgy) || 1,
    clinic_cohort: b.clinic_cohort ? String(b.clinic_cohort).trim() : null,
    active: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.full_name != null) patch.full_name = String(b.full_name).trim();
  if (b.sched_key != null) patch.sched_key = String(b.sched_key).trim();
  if (b.pgy != null) patch.pgy = Number(b.pgy) || 1;
  if (b.clinic_cohort !== undefined)
    patch.clinic_cohort = b.clinic_cohort ? String(b.clinic_cohort).trim() : null;
  if (b.active != null) patch.active = !!b.active;
  const sb = supabaseAdmin();
  const { error } = await sb.from("residents").update(patch).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Soft-remove (deactivate) so request history is preserved.
export async function DELETE(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("residents").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
