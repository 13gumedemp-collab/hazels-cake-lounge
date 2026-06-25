// request-callback  (public — exit-intent capture from the enquiry overlay)
// Someone left the form before finishing and asked Hazel to call them.
// Accepts: { phone, name?, occasion_for?, occasion_type?, occasion_date? }
// Raises a high-priority notification and emails Hazel so she can call back.
import { adminClient, businessVars, corsHeaders, json, notify } from "../_shared/client.ts";
import { sendToAddress } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b.phone) return json({ error: "phone is required" }, 400);

  const supabase = adminClient();
  const method = b.contact_method === "whatsapp" ? "WhatsApp" : "Call";
  const detail = [b.name, b.occasion_for && `for ${b.occasion_for}`, b.occasion_type, b.occasion_date]
    .filter(Boolean).join(" · ");
  await notify(
    supabase, "callback_requested",
    `${method} requested: ${b.phone}${detail ? " (" + detail + ")" : ""}`,
    "high", "/customers",
  );

  const businessEmail = Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za";
  await sendToAddress(businessEmail, "callback_request", {
    ...businessVars(),
    phone: b.phone, name: b.name || "Not given", contact_method: method,
    contact_consent: b.contact_consent ? "Yes" : "Not given",
    occasion_for: b.occasion_for || "Not given",
    occasion_type: b.occasion_type || "Not given", occasion_date: b.occasion_date || "Not given",
  }, supabase);

  return json({ status: "ok" });
});
