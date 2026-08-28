// Netlify Scheduled Function — the daily 7-day-reminder sweep (Netlify's
// equivalent of the Vercel cron). It calls the app's own cron endpoint with the
// shared secret. Netlify reads the `config.schedule` below to run it on a cron.
export default async () => {
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "";
  const secret = process.env.CRON_SECRET || "";
  if (!site) return new Response("NEXT_PUBLIC_SITE_URL not set", { status: 500 });
  const res = await fetch(`${site}/api/cron/reminders`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  return new Response(body, { status: res.status });
};

export const config = { schedule: "0 13 * * *" };
