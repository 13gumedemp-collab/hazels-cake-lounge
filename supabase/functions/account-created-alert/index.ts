// account-created-alert
// Invoked by the authenticated account page. The function validates the JWT,
// deduplicates per auth user and emails Hazel after a genuinely new account.
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";
import { sendToAddress } from "../_shared/email.ts";

const ALERT_EMAIL = Deno.env.get("ACCOUNT_ALERT_EMAIL") ?? "hazelscakelounge@gmail.com";
const RECENT_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] as string));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabase = adminClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  const user = auth.user;
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const createdAt = Date.parse(user.created_at);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > RECENT_ACCOUNT_WINDOW_MS) {
    return json({ status: "skipped", reason: "not_a_new_account" });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!customer) return json({ error: "Customer record is not ready" }, 409);

  const { data: delivery } = await supabase
    .from("account_alert_deliveries")
    .select("status")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (delivery?.status === "sent") return json({ status: "already_sent" });

  await supabase.from("account_alert_deliveries").upsert({
    auth_user_id: user.id,
    customer_id: customer.id,
    status: "pending",
    last_error: null,
  });

  const result = await sendToAddress(ALERT_EMAIL, "new_account_alert", {
    customer_name: escapeHtml(customer.full_name),
    customer_email: escapeHtml(customer.email),
    account_created_at: new Date(createdAt).toLocaleString("en-ZA", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg",
    }),
  }, supabase);

  await supabase.from("account_alert_deliveries").update({
    status: result.status,
    last_error: result.error ?? null,
    sent_at: result.status === "sent" ? new Date().toISOString() : null,
  }).eq("auth_user_id", user.id);

  if (result.status === "failed") {
    await notify(supabase, "account_alert_failed", `New-account email alert failed for ${customer.full_name}: ${result.error ?? "Unknown error"}`, "high", "/customers");
  }

  return json({ status: result.status, error: result.error ?? null });
});
