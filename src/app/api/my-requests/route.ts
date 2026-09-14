import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Public: a resident's own requests (scoped to their id) for the confirmation list.
export async function GET(req: NextRequest) {
  const rid = req.nextUrl.searchParams.get("resident_id");
  if (!rid) return NextResponse.json({ requests: [] });
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("requests")
    .select("id,conference,start_date,end_date,rotation,status,presentation_dates")
    .eq("resident_id", rid)
    .order("start_date");
  return NextResponse.json({ requests: data || [] });
}

// Public but resident-scoped: a resident adds/updates ONLY the presentation date(s) on
// their OWN request (e.g. once the program releases the exact slot after acceptance).
// Nothing else is editable by residents — the chiefs make any other change from the console.
// The request must belong to the resident_id supplied, or the update is refused.
export async function PATCH(req: NextRequest) {
  const b = await req.json();
  const rid = b.resident_id ? String(b.resident_id) : "";
  const id = b.id ? String(b.id) : "";
  if (!rid || !id) return NextResponse.json({ error: "Missing request or resident id." }, { status: 400 });
  if (!Array.isArray(b.presentation_dates)) {
    return NextResponse.json({ error: "No presentation dates provided." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: row } = await sb.from("requests").select("id,resident_id").eq("id", id).maybeSingle();
  if (!row || row.resident_id !== rid) {
    return NextResponse.json({ error: "That request isn't yours to edit." }, { status: 403 });
  }

  const { error } = await sb
    .from("requests")
    .update({ presentation_dates: b.presentation_dates.filter(Boolean) })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
