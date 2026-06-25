import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service-role client. SERVER ONLY. Never import this into a client component.
// All dashboard data flows through this so the anon key never exposes PII.
//
// IMPORTANT: supabase-js calls fetch() internally, and Next.js caches server
// fetches in its Data Cache by default. We force cache: "no-store" on every
// request so the dashboard always reflects the live database.
export function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}
