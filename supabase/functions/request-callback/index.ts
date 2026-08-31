// Public exit-intent callback request. It handles no customer records and is
// deliberately small so it cannot become an open relay or notification flood.
import {
  adminClient,
  browserJson,
  browserPreflight,
  businessVars,
  consumeRequestRateLimit,
  isAllowedBrowserOrigin,
  notify,
} from "../_shared/client.ts";
import { sendToAddress } from "../_shared/email.ts";

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validPhone(phone: string): boolean {
  return /^[+()\d\s-]{7,24}$/.test(phone);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return browserPreflight(req);
  if (!isAllowedBrowserOrigin(req)) return browserJson(req, { error: "Forbidden" }, 403);
  if (req.method !== "POST") return browserJson(req, { error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return browserJson(req, { error: "Please check the form and try again." }, 400); }
  if (clean(body.website, 200)) return browserJson(req, { status: "ok" });

  const phone = clean(body.phone, 24);
  const consent = body.contact_consent === true;
  if (!validPhone(phone) || !consent) {
    return browserJson(req, { error: "Please add a valid number and consent to a reply." }, 400);
  }

  const supabase = adminClient();
  const limit = await consumeRequestRateLimit(supabase, req, "callback", 3, 60 * 60);
  if (!limit.allowed) {
    return browserJson(req, { error: "Please wait a little before requesting another callback." }, 429);
  }

  const method = body.contact_method === "whatsapp" ? "WhatsApp" : "Call";
  const name = clean(body.name, 120);
  const occasionFor = clean(body.occasion_for, 120);
  const occasionType = clean(body.occasion_type, 80);
  const occasionDate = clean(body.occasion_date, 10);
  const detail = [name, occasionFor && `for ${occasionFor}`, occasionType, occasionDate].filter(Boolean).join(" · ");
  await notify(
    supabase,
    "callback_requested",
    `${method} requested: ${phone}${detail ? ` (${detail})` : ""}`,
    "high",
    "/customers",
  );

  const businessEmail = Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za";
  await sendToAddress(businessEmail, "callback_request", {
    ...businessVars(),
    phone,
    name: name || "Not given",
    contact_method: method,
    contact_consent: "Yes",
    occasion_for: occasionFor || "Not given",
    occasion_type: occasionType || "Not given",
    occasion_date: occasionDate || "Not given",
  }, supabase);

  return browserJson(req, { status: "ok" });
});
