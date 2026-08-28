import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rotationVocab, Assignment } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// Public: data the resident form needs (no schedule details exposed).
export async function GET() {
  const sb = supabaseAdmin();
  const [residentsRes, assignRes, reqRes, blocksRes] = await Promise.all([
    sb.from("residents").select("id,full_name,pgy").eq("active", true).order("full_name"),
    sb.from("assignments").select("resident_id,block_no,cell"),
    sb.from("requests").select("conference"),
    sb.from("blocks").select("block_no,start_date,end_date").order("block_no"),
  ]);
  const vocab = rotationVocab((assignRes.data || []) as Assignment[]);
  const conferences = [
    ...new Set((reqRes.data || []).map((r: { conference: string }) => r.conference).filter(Boolean)),
  ].sort();
  return NextResponse.json({
    residents: residentsRes.data || [],
    vocab,
    conferences,
    blocks: blocksRes.data || [],
    today: new Date().toISOString().slice(0, 10),
  });
}
