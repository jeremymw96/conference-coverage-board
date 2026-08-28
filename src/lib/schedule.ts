// Year-agnostic schedule engine — resolves what rotation a resident is on for a
// given date, from the block grid stored in the database. Works for any academic
// year because it infers the year from each block's own start/end dates.

export type Block = { block_no: number; start_date: string; end_date: string };
export type ResidentRow = {
  id: string;
  full_name: string;
  sched_key: string;
  pgy: number;
  clinic_cohort: string | null;
  active: boolean;
};
export type Assignment = { resident_id: string; block_no: number; cell: string };

export function ymd(s: string): Date {
  return new Date(s + "T00:00:00");
}
export function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function isCoreLabel(label: string): boolean {
  return /^MED [A-E]$/.test(label) || /^MICU/.test(label) || label === "CCU" || label === "NF";
}

export function blockForDate(blocks: Block[], dt: Date): Block | null {
  const t = midnight(dt).getTime();
  return (
    blocks.find(
      (b) => midnight(ymd(b.start_date)).getTime() <= t && t <= midnight(ymd(b.end_date)).getTime()
    ) || null
  );
}

type Entry = { label: string; start: Date | null; end: Date | null };

function resolveYear(mo: number, day: number, block: Block): Date {
  const sy = ymd(block.start_date).getFullYear();
  const ey = ymd(block.end_date).getFullYear();
  let d = new Date(sy, mo - 1, day);
  if (sy !== ey && midnight(d) < midnight(ymd(block.start_date))) d = new Date(ey, mo - 1, day);
  return d;
}

function parseEntry(s: string, block: Block): Entry {
  s = (s || "").trim();
  const m = s.match(/^(.*?)\s*\((\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\)\s*$/);
  if (m) {
    return {
      label: m[1].trim(),
      start: resolveYear(+m[2], +m[3], block),
      end: resolveYear(+m[4], +m[5], block),
    };
  }
  return { label: s, start: null, end: null };
}

export type RotationResult = {
  label: string;
  core: boolean;
  vacation: boolean;
  block_no: number | null;
};

// cells: map of block_no -> raw cell text for ONE resident
export function rotationOnDate(
  cells: Map<number, string>,
  blocks: Block[],
  dt: Date
): RotationResult {
  const block = blockForDate(blocks, dt);
  if (!block) return { label: "—", core: false, vacation: false, block_no: null };
  const cell = cells.get(block.block_no);
  if (!cell) return { label: "—", core: false, vacation: false, block_no: block.block_no };
  const entries = cell.split(" || ").map((e) => parseEntry(e, block));
  const covers = (e: Entry) =>
    e.start ? midnight(dt) >= midnight(e.start) && midnight(dt) <= midnight(e.end!) : true;
  let vacation = false;
  for (const e of entries) if (/^VACATION/i.test(e.label) && covers(e)) vacation = true;
  const nonVac = entries.filter((e) => !/^VACATION/i.test(e.label));
  const chosen = nonVac.find((e) => e.start && covers(e)) || nonVac.find((e) => !e.start) || nonVac[0];
  const label = chosen ? chosen.label : "—";
  return { label, core: isCoreLabel(label), vacation, block_no: block.block_no };
}

// Build a per-resident map of block_no -> cell from a flat assignments list.
export function assignmentsByResident(rows: Assignment[]): Map<string, Map<number, string>> {
  const out = new Map<string, Map<number, string>>();
  for (const r of rows) {
    if (!out.has(r.resident_id)) out.set(r.resident_id, new Map());
    out.get(r.resident_id)!.set(r.block_no, r.cell);
  }
  return out;
}

// Rotation vocabulary (for the editable dropdown), gathered from all cells.
export function rotationVocab(assignments: Assignment[]): string[] {
  const set = new Set<string>();
  for (const a of assignments) {
    for (const piece of (a.cell || "").split(" || ")) {
      const label = piece.replace(/\s*\(\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\)\s*$/, "").trim();
      if (label && label !== "—" && !/^VACATION/i.test(label)) set.add(label);
    }
  }
  return [...set].sort();
}
