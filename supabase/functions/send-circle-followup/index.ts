// send-circle-followup
// Accepts: { customer_id }
// Sends the one-time circle_followup email (sent once, never again) and sets
// circle_followup_sent = true. Uses the customer's first completed order to
// reference the cake it was for.
import { adminClient, corsHeaders, firstName, json } from "../_shared/client.ts";
import { sendEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let b: { customer_id?: string };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b.customer_id) return json({ error: "customer_id is required" }, 400);

  const supabase = adminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, circle_followup_sent")
    .eq("id", b.customer_id)
    .single();
  if (!customer) return json({ error: "Customer not found" }, 404);
  if (customer.circle_followup_sent) return json({ status: "already_sent" });

  // Reference the most recent completed order's circle member.
  const { data: order } = await supabase
    .from("orders")
    .select("circle_member:circle_members ( person_name, occasion_type )")
    .eq("customer_id", customer.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cm = order?.circle_member as { person_name: string; occasion_type: string } | null;

  const r = await sendEmail(supabase, {
    customer_id: customer.id, template_name: "circle_followup", reminder_type: "circle_followup",
    dynamic_variables: {
      first_name: firstName(customer.full_name),
      person_name: cm?.person_name ?? "them", occasion_type: cm?.occasion_type ?? "celebration",
    },
  });
  await supabase.from("customers").update({ circle_followup_sent: true }).eq("id", customer.id);
  return json({ status: r.status });
});
