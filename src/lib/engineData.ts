import { supabaseAdmin } from "./supabaseAdmin";
import {
  Block,
  Assignment,
  rotationOnDate,
  assignmentsByResident,
  RotationResult,
} from "./schedule";
import { ymd } from "./dates";
import type { Resident } from "./types";

export type ScheduleContext = {
  blocks: Block[];
  assignments: Assignment[];
  residents: Resident[];
  byRes: Map<string, Map<number, string>>;
};

export async function getScheduleContext(): Promise<ScheduleContext> {
  const sb = supabaseAdmin();
  const [blocksRes, assignRes, resRes] = await Promise.all([
    sb.from("blocks").select("block_no,start_date,end_date").order("block_no"),
    sb.from("assignments").select("resident_id,block_no,cell"),
    sb.from("residents").select("id,full_name,sched_key,pgy,clinic_cohort,active").order("full_name"),
  ]);
  const blocks = (blocksRes.data || []) as Block[];
  const assignments = (assignRes.data || []) as Assignment[];
  const residents = (resRes.data || []) as Resident[];
  return { blocks, assignments, residents, byRes: assignmentsByResident(assignments) };
}

export function rotationFor(
  residentId: string,
  dateISO: string,
  ctx: ScheduleContext
): RotationResult {
  const cells = ctx.byRes.get(residentId);
  if (!cells) return { label: "—", core: false, vacation: false, block_no: null };
  return rotationOnDate(cells, ctx.blocks, ymd(dateISO));
}
