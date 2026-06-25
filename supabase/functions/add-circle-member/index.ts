// add-circle-member
// Called from the admin dashboard (and the occasion-book "add another" form via
// the public path) to add a person to a customer's Circle.
// Accepts: { customer_id?, email?, person_name, relationship_to_customer,
//            occasion_type, occasion_date, notes }
// Either customer_id or email must identify an existing customer.
import { adminClient, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { sendEmail } from "../_shared/email.ts";

function occasionRules(type: string) {
  switch ((type || "").toLowerCase()) {
    case "birthday": case "anniversary": return { recurring_yearly: true, is_one_time: false };
    case "wedding": case "graduation": case "baby shower": return { recurring_yearly: false, is_one_time: true };
    default: return { recurring_yearly: false, is_one_time: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b.person_name || !b.occasion_type || !b.occasion_date) {
    return json({ error: "person_name, occasion_type and occasion_date are required" }, 400);
  }
  const supabase = adminClient();

  let customer;
  if (b.customer_id) {
    ({ data: customer } = await supabase.from("customers")
      .select("id, full_name").eq("id", b.customer_id).single());
  } else if (b.email) {
    ({ data: customer } = await supabase.from("customers")
      .select("id, full_name").eq("email", b.email.toLowerCase().trim()).single());
  }
  if (!customer) return json({ status: "not_found" }, 200);

  const rules = occasionRules(b.occasion_type);
  const { data: member, error } = await supabase
    .from("circle_members")
    .insert({
      customer_id: customer.id,
      person_name: b.person_name,
      relationship_to_customer: b.relationship_to_customer || null,
      occasion_type: b.occasion_type,
      occasion_date: b.occasion_date,
      recurring_yearly: rules.recurring_yearly,
      is_one_time: rules.is_one_time,
      notes: b.notes || null,
    })
    .select("id, person_name, occasion_type, occasion_date")
    .single();
  if (error || !member) return json({ error: error?.message }, 500);

  await notify(supabase, "circle_member_added",
    `${customer.full_name} added ${member.person_name}'s ${member.occasion_type} to their Circle.`);

  await sendEmail(supabase, {
    customer_id: customer.id, template_name: "circle_member_added", reminder_type: "circle_member_added",
    circle_member_id: member.id,
    dynamic_variables: {
      first_name: firstName(customer.full_name),
      person_name: member.person_name, occasion_type: member.occasion_type, occasion_date: member.occasion_date,
    },
  });

  return json({ status: "success", circle_member_id: member.id });
});
