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
