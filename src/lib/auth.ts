import { supabaseServer } from "./supabaseServer";
import type { User } from "@supabase/supabase-js";

export function chiefEmails(): string[] {
  return (process.env.CHIEF_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isChiefEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return chiefEmails().includes(email.toLowerCase());
}

// Returns the signed-in chief user, or null if not signed in / not on the allowlist.
export async function getChief(): Promise<User | null> {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isChiefEmail(user.email)) return null;
  return user;
}

export function chiefName(user: User): string {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  return (
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email ||
    "Chief"
  );
}
