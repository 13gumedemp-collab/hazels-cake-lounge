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

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let different = left.length ^ right.length;
  for (let index = 0; index < length; index++) {
    different |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return different === 0;
}

function hasServiceRoleClaims(token: string): boolean {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return false;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const claims = JSON.parse(atob(base64)) as { role?: string; ref?: string };
    const projectRef = new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname.split(".")[0];
    return claims.role === "service_role" && !!projectRef && claims.ref === projectRef;
  } catch {
    return false;
  }
}

// Supabase's gateway accepts the public anon or publishable key as a valid
// credential when verify_jwt is enabled. Internal functions therefore need to
// prove that the caller supplied the service-role credential itself.
export function requireServiceRole(req: Request): Response | null {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supplied = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apiKey = (req.headers.get("apikey") ?? "").trim();
  // The gateway has already verified JWT signatures for these internal
  // functions. Check the validated legacy token's scoped claims as well as the
  // injected key, because Supabase may rotate the legacy key independently.
  const legacyServiceRole = (expected && supplied && constantTimeEqual(supplied, expected)) ||
    hasServiceRoleClaims(supplied);
  // Supabase's gateway validates opaque secret keys before the request reaches
  // a verify_jwt function. Requiring the same secret in both headers keeps the
  // newer server key path distinct from public `sb_publishable_` credentials.
  const opaqueSecret = supplied.startsWith("sb_secret_") && constantTimeEqual(supplied, apiKey);
  if (legacyServiceRole || opaqueSecret) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const browserOrigins = new Set([
  "https://hazelscakelounge.co.za",
  "https://www.hazelscakelounge.co.za",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

// Public endpoints are called from the customer site only. CORS is not an
// authorisation boundary, but reflecting only these origins prevents another
// website from reading customer-facing responses in a browser.
export function isAllowedBrowserOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  return !origin || browserOrigins.has(origin);
}

export function browserCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowedOrigin = origin && browserOrigins.has(origin)
    ? origin
    : "https://hazelscakelounge.co.za";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function browserPreflight(req: Request): Response {
  if (!isAllowedBrowserOrigin(req)) return new Response(null, { status: 403 });
  return new Response("ok", { headers: browserCorsHeaders(req) });
}

export function browserJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...browserCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function requestFingerprintSource(req: Request): string {
  const cloudflare = req.headers.get("cf-connecting-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return cloudflare || forwarded || req.headers.get("user-agent") || "unknown";
}

// Persistent limits are enforced in Postgres so they hold across edge-function
// instances. Only a SHA-256 hash is stored, never a raw network address.
export async function consumeRequestRateLimit(
  supabase: SupabaseClient,
  req: Request,
  scope: "enquiry" | "occasion_book" | "callback",
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const bytes = new TextEncoder().encode(`${scope}:${requestFingerprintSource(req)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await supabase.rpc("consume_request_rate_limit", {
    p_scope: scope,
    p_fingerprint: fingerprint,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return { allowed: false, retryAfterSeconds: windowSeconds };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed === true,
    retryAfterSeconds: Number(row?.retry_after_seconds || 0),
  };
}

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
function htmlEscape(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character] as string));
}

export function fillTemplate(
  text: string | null,
  vars: Record<string, unknown>,
  escapeValues = false,
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
    if (v === undefined || v === null) return "";
    const value = String(v).replace(/[\r\n]+/g, " ");
    return escapeValues ? htmlEscape(value) : value;
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
    enquiry_url: Deno.env.get("ENQUIRY_URL") ?? `${site}/contact`,
  };
}

// first_name helper derived from a full name.
export function firstName(fullName: string | null): string {
  if (!fullName) return "there";
  return fullName.trim().split(/\s+/)[0];
}
