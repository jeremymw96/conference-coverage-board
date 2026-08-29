import { createBrowserClient } from "@supabase/ssr";

function clean(v: string | undefined): string {
    return (v ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

export function supabaseBrowser() {
    return createBrowserClient(
          clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        );
}
