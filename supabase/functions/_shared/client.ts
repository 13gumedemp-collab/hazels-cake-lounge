// Shared helpers for all Hazel's Cake Lounge edge functions.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Service-role client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every edge function by the Supabase runtime.
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Create a notification row for the live admin feed.
export async function notify(
  supabase: SupabaseClient,
  type: string,
  message: string,
): Promise<void> {
  await supabase.from("notifications").insert({ type, message });
}

// Replace {{key}} tokens in a string from a flat variables object.
// Any token with no matching value is removed.
export function fillTemplate(
  text: string | null,
  vars: Record<string, unknown>,
): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

// first_name helper derived from a full name.
export function firstName(fullName: string | null): string {
  if (!fullName) return "there";
  return fullName.trim().split(/\s+/)[0];
}
