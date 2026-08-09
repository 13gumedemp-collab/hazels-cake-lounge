// account-login-activity
// Called after a customer account has loaded. One notification per customer per
// SAST day makes genuine return visits visible without filling the feed on refresh.
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";

const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

function southAfricanDay(): string {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  if (Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS) {
    return json({ status: "skipped", reason: "new_account" });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!customer) return json({ error: "Customer record is not ready" }, 409);

  const { error: insertError } = await supabase
    .from("customer_login_activity")
    .insert({ customer_id: customer.id, login_date: southAfricanDay() });

  if (insertError?.code === "23505") return json({ status: "already_recorded" });
  if (insertError) return json({ error: "Could not record customer login" }, 500);

  await notify(supabase, "customer_login", `${customer.full_name} signed in.`, "standard", `/customers/${customer.id}`);
  return json({ status: "recorded" });
});
