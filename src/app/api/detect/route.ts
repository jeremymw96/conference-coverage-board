import { NextRequest, NextResponse } from "next/server";
import { getScheduleContext, rotationFor } from "@/lib/engineData";

export const dynamic = "force-dynamic";

// Public: given a resident + date, return the rotation from the schedule (no grid exposed).
export async function POST(req: NextRequest) {
  const { resident_id, date } = await req.json();
  if (!resident_id || !date) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const ctx = await getScheduleContext();
  const r = rotationFor(resident_id, date, ctx);
  return NextResponse.json({
    rotation: r.label,
    is_core: r.core,
    vacation: r.vacation,
    block_no: r.block_no,
  });
}
