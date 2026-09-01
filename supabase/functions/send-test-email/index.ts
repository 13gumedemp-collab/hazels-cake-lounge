import { adminClient, corsHeaders, json, requireServiceRole } from "../_shared/client.ts";
import { sendToAddress } from "../_shared/email.ts";

const RESEND_API = "https://api.resend.com/emails";
const DELIVERY_SCENARIOS = new Set(["delivered", "bounced", "complained", "suppressed"]);

async function senderWebhookAccess() {
  const key = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!key) return { status: "failed", error: "RESEND_API_KEY is not configured" };
  const result = await fetch("https://api.resend.com/webhooks", {
    headers: { Authorization: `Bearer ${key}` },
  });
  return { status: result.ok ? "available" : "unavailable", http_status: result.status };
}

async function sendDeliveryScenario(scenario: string) {
  const key = Deno.env.get("RESEND_INBOUND_API_KEY") ?? "";
  if (!key) return { status: "failed", error: "RESEND_INBOUND_API_KEY is not configured" };
  const label = `hcl-${Date.now()}`;
  const to = scenario === "suppressed" ? "suppressed@resend.dev" : `${scenario}+${label}@resend.dev`;
  const result = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Hazel's Cake Lounge Test <onboarding@resend.dev>",
      to: [to],
      subject: `HCL ${scenario} webhook test`,
      text: "Safe Resend delivery event test for the Hazel's Cake Lounge Command Centre.",
    }),
  });
  const raw = await result.text();
  if (!result.ok) return { status: "failed", error: `Resend ${result.status}: ${raw}` };
  const providerId = (JSON.parse(raw || "{}") as { id?: string }).id ?? null;
  return { status: "sent", scenario, to, message_id: providerId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authError = requireServiceRole(req);
  if (authError) return authError;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({})) as { scenario?: string };
  const scenario = String(body.scenario ?? "").trim().toLowerCase();
  if (scenario === "sender_access") return json(await senderWebhookAccess());
  if (DELIVERY_SCENARIOS.has(scenario)) {
    const result = await sendDeliveryScenario(scenario);
    return json(result, result.status === "failed" ? 502 : 200);
  }
  const to = Deno.env.get("BUSINESS_EMAIL");
  if (!to) return json({ status: "failed", error: "BUSINESS_EMAIL is not configured" }, 500);
  const sentAt = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "long", timeStyle: "short" });
  const result = await sendToAddress(to, "delivery_test", { sent_at: sentAt }, adminClient());
  return json(result, result.status === "failed" ? 502 : 200);
});
