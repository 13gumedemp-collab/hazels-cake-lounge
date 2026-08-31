import { adminClient, corsHeaders, json } from "../_shared/client.ts";
import { sendToAddress } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const to = Deno.env.get("BUSINESS_EMAIL");
  if (!to) return json({ status: "failed", error: "BUSINESS_EMAIL is not configured" }, 500);
  const sentAt = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "long", timeStyle: "short" });
  const result = await sendToAddress(to, "delivery_test", { sent_at: sentAt }, adminClient());
  return json(result, result.status === "failed" ? 502 : 200);
});
