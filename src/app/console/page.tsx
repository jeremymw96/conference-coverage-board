import { redirect } from "next/navigation";
import { getChief, chiefName } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ConsoleApp from "./ConsoleApp";
import type { RequestRow, Resident } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const chief = await getChief();
  if (!chief) redirect("/login");

  const sb = supabaseAdmin();
  const [reqRes, resRes] = await Promise.all([
    sb.from("requests").select("*").order("start_date"),
    sb
      .from("residents")
      .select("id,full_name,sched_key,pgy,clinic_cohort,active")
      .order("pgy")
      .order("full_name"),
  ]);

  return (
    <ConsoleApp
      initialRequests={(reqRes.data || []) as RequestRow[]}
      initialResidents={(resRes.data || []) as Resident[]}
      chief={chiefName(chief)}
    />
  );
}
