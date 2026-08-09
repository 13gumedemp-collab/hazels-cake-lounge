// Customer-initiated account deletion (POPIA right to erasure).
//
// What goes and what stays is a deliberate split:
//   * customers row      -> deleted. Name, address, phone, consents, all of it.
//   * circle_members     -> deleted with it, by ON DELETE CASCADE.
//   * orders             -> kept, customer_id set to null by ON DELETE SET NULL.
//   * reminder_log       -> kept, customer_id set to null the same way.
//   * auth user          -> deleted, so the sign in itself stops working.
//
// Orders survive on purpose. SARS requires sales records to be kept for five
// years, so they are anonymised rather than destroyed. That is the lawful
// position and the customer is told it plainly in the account page copy.
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabase = adminClient();
  // The caller proves who they are with their own JWT. Nothing in the body is
  // trusted, so there is no id to tamper with and no way to delete anyone else.
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

  const { data: customer } = await supabase
    .from("customers").select("id, full_name, email").eq("auth_user_id", auth.user.id).maybeSingle();

  if (customer) {
    const { error: rowError } = await supabase.from("customers").delete().eq("id", customer.id);
    if (rowError) return json({ error: "Could not delete your details" }, 500);
  }

  // Last, because losing the auth user before the row would strand the row with
  // no way for its owner to reach it again.
  const { error: userError } = await supabase.auth.admin.deleteUser(auth.user.id);
  if (userError) return json({ error: "Could not close your sign in" }, 500);

  await notify(
    supabase,
    "account_deleted",
    `${customer?.full_name || auth.user.email || "A customer"} deleted their account. Their orders are kept without a name attached.`,
    "high",
  );

  return json({ deleted: true });
});
