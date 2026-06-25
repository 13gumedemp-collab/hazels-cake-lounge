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
// priority: 'standard' | 'high'   action_url: optional deep link
export async function notify(
  supabase: SupabaseClient,
  type: string,
  message: string,
  priority: "standard" | "high" = "standard",
  action_url: string | null = null,
): Promise<void> {
  await supabase.from("notifications").insert({ type, message, priority, action_url });
}

// Render a template string against a flat variables object.
// Supports {{#if key}}...{{/if}} conditional blocks (kept when the value is
// truthy) and {{key}} substitution. Unknown tokens render as empty strings.
export function fillTemplate(
  text: string | null,
  vars: Record<string, unknown>,
): string {
  if (!text) return "";
  // Conditional blocks first (handles nesting-free {{#if}} ... {{/if}}).
  let out = text.replace(
    /\{\{#if\s+([\w]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_m, key, inner) => (vars[key] ? inner : ""),
  );
  // Simple substitution.
  out = out.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
  // Tidy excess blank lines left by removed blocks.
  return out.replace(/\n{3,}/g, "\n\n");
}

// Business constants available to every template (overridable by caller vars).
export function businessVars(): Record<string, string> {
  const site = Deno.env.get("SITE_URL") ?? "https://hazelscakelounge.co.za";
  return {
    business_name: Deno.env.get("RESEND_FROM_NAME") ?? "Hazel's Cake Lounge",
    business_email: Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za",
    business_phone: Deno.env.get("BUSINESS_PHONE") ?? "073 373 4234",
    admin_dashboard_url: Deno.env.get("ADMIN_DASHBOARD_URL") ??
      "https://admin.hazelscakelounge.co.za",
    enquiry_url: Deno.env.get("ENQUIRY_URL") ?? `${site}/contact.html`,
  };
}

// first_name helper derived from a full name.
export function firstName(fullName: string | null): string {
  if (!fullName) return "there";
  return fullName.trim().split(/\s+/)[0];
}
