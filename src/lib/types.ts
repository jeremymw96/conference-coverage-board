export type Status = "pending" | "approved" | "denied" | "needs_revision";

export type Resident = {
  id: string;
  full_name: string;
  sched_key: string;
  pgy: number;
  clinic_cohort: string | null;
  active: boolean;
};

// A chief-to-chief note attached to a request (e.g. why a revision is needed).
export type ChiefComment = {
  author: string;
  text: string;
  at: string; // ISO timestamp
};

export type RequestRow = {
  id: string;
  resident_id: string | null;
  resident_name: string;
  conference: string;
  start_date: string;
  end_date: string;
  rotation: string | null;
  is_core: boolean;
  presentation_dates: string[];
  status: Status;
  chief_comments: ChiefComment[];
  coverage_needed: boolean | null;
  cover_resident_id: string | null;
  cover_resident_name: string | null;
  cover_from: string | null;
  decided_by: string | null;
  decided_at: string | null;
  note: string;
  submitted_at: string;
};

export function surnameOf(name: string): string {
  // full display name "Iman Ashraf" -> "Ashraf"; sched key "Ashraf, I" -> "Ashraf"
  if (name.includes(",")) return name.split(",")[0].trim();
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}
