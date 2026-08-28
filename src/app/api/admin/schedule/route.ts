import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChief } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Minimal CSV parser (quoted fields, commas inside quotes).
function parseCSV(txt: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') {
        if (txt[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        row.push(f);
        f = "";
      } else if (c === "\n" || c === "\r") {
        if (f !== "" || row.length) {
          if (c === "\r" && txt[i + 1] === "\n") i++;
          row.push(f);
          rows.push(row);
          row = [];
          f = "";
        }
      } else f += c;
    }
  }
  if (f !== "" || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

// Chief-only: replace the academic-year schedule (roster + block assignments).
// CSV columns: Class, Resident("Last, Initial"), ClinicCohort, B1..B13
// Optional `blocks`: [{block_no,start_date,end_date}] to set new block dates.
export async function POST(req: NextRequest) {
  const chief = await getChief();
  if (!chief) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const csv = String(body.csv || "");
  if (!csv.trim()) return NextResponse.json({ error: "CSV is empty." }, { status: 400 });

  const rows = parseCSV(csv).filter((r) => r.length > 3);
  if (rows.length < 2)
    return NextResponse.json({ error: "CSV has no data rows." }, { status: 400 });
  rows.shift(); // header

  const sb = supabaseAdmin();

  // Optional block dates
  if (Array.isArray(body.blocks) && body.blocks.length) {
    const blockRows = body.blocks
      .filter((b: { block_no: number; start_date: string; end_date: string }) => b.block_no && b.start_date && b.end_date)
      .map((b: { block_no: number; start_date: string; end_date: string }) => ({
        block_no: Number(b.block_no),
        start_date: b.start_date,
        end_date: b.end_date,
      }));
    if (blockRows.length) await sb.from("blocks").upsert(blockRows, { onConflict: "block_no" });
  }

  // Preserve existing full names when a sched_key already exists
  const { data: existing } = await sb.from("residents").select("sched_key,full_name");
  const nameByKey = new Map<string, string>();
  (existing || []).forEach((r) => nameByKey.set(r.sched_key, r.full_name));

  const csvKeys = new Set<string>();
  const residentUpserts = rows.map((r) => {
    const sched_key = (r[1] || "").trim();
    csvKeys.add(sched_key);
    const pgyMatch = (r[0] || "").match(/(\d+)/);
    return {
      sched_key,
      full_name: nameByKey.get(sched_key) || sched_key,
      pgy: pgyMatch ? Number(pgyMatch[1]) : 1,
      clinic_cohort: (r[2] || "").trim() || null,
      active: true,
    };
  });

  const up = await sb.from("residents").upsert(residentUpserts, { onConflict: "sched_key" });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  // Deactivate residents not present in the new CSV (graduated / removed)
  const { data: allRes } = await sb.from("residents").select("id,sched_key");
  const idByKey = new Map<string, string>();
  (allRes || []).forEach((r) => {
    idByKey.set(r.sched_key, r.id);
    if (!csvKeys.has(r.sched_key)) {
      // fire and forget deactivation
      sb.from("residents").update({ active: false }).eq("id", r.id).then(() => {});
    }
  });

  // Replace all assignments
  await sb.from("assignments").delete().neq("block_no", -1);
  const assignInserts: { resident_id: string; block_no: number; cell: string }[] = [];
  rows.forEach((r) => {
    const rid = idByKey.get((r[1] || "").trim());
    if (!rid) return;
    for (let b = 0; b < 13; b++) {
      assignInserts.push({ resident_id: rid, block_no: b + 1, cell: (r[3 + b] || "").trim() });
    }
  });
  // insert in chunks to stay within payload limits
  for (let i = 0; i < assignInserts.length; i += 300) {
    const chunk = assignInserts.slice(i, i + 300);
    const ins = await sb.from("assignments").insert(chunk);
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, residents: residentUpserts.length, assignments: assignInserts.length });
}
