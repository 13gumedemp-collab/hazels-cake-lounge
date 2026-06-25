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

function relationshipPossessive(rel: string): string {
  return ({
    "My child": "your child", "My partner or spouse": "your partner", "My parent": "your parent",
    "My sibling": "your sibling", "My friend": "your friend", "My colleague": "your colleague",
  } as Record<string, string>)[rel] || "";
}

function buildLabels(opts: { name: string; rel: string; occLabel: string; customerName: string }) {
  const { name, rel, occLabel, customerName } = opts;
  let celebration_label: string;
  let person_name: string;
  if (rel === "Myself") {
    celebration_label = `your ${occLabel}`;
    person_name = name || customerName;
  } else if (name) {
    celebration_label = `${name}'s ${occLabel}`;
    person_name = name;
  } else {
    const poss = relationshipPossessive(rel);
    celebration_label = poss ? `${poss}'s ${occLabel}` : `the ${occLabel}`;
    person_name = rel ? rel.replace(/^My /, "") : "Someone special";
  }
  const celebration_label_their = celebration_label.replace(/^your\b/, "their").replace(/\byour /g, "their ");
  return { celebration_label, celebration_label_their, person_name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b.occasion_type || !b.occasion_date) {
    return json({ error: "occasion_type and occasion_date are required" }, 400);
  }
  const supabase = adminClient();
  const occLabel = (b.occasion_type === "Other" && (b.occasion_other || "").trim())
    ? (b.occasion_other || "").trim()
    : b.occasion_type;

  let customer;
  if (b.customer_id) {
    ({ data: customer } = await supabase.from("customers")
      .select("id, full_name").eq("id", b.customer_id).single());
  } else if (b.email) {
    ({ data: customer } = await supabase.from("customers")
      .select("id, full_name").eq("email", b.email.toLowerCase().trim()).single());
  }
  // Anyone can join the Occasion Book, even without a prior order: if we have
  // no record yet but they gave a name + email, start one for them.
  if (!customer && b.email && b.full_name) {
    const { data: created } = await supabase
      .from("customers")
      .insert({ full_name: b.full_name, email: b.email.toLowerCase().trim(), email_consent: true })
      .select("id, full_name")
      .single();
    customer = created;
  }
  if (!customer) return json({ status: "not_found" }, 200);

  const rules = occasionRules(b.occasion_type);
  const labels = buildLabels({
    name: (b.person_name || "").trim(),
    rel: b.relationship_to_customer || "",
    occLabel,
    customerName: customer.full_name,
  });
  const { data: member, error } = await supabase
    .from("circle_members")
    .insert({
      customer_id: customer.id,
      person_name: labels.person_name,
      relationship_to_customer: b.relationship_to_customer || null,
      occasion_type: occLabel,
      occasion_date: b.occasion_date,
      recurring_yearly: rules.recurring_yearly,
      is_one_time: rules.is_one_time,
      notes: b.notes || null,
    })
    .select("id, person_name, occasion_type, occasion_date")
    .single();
  if (error || !member) return json({ error: error?.message }, 500);

  await notify(supabase, "circle_member_added",
    `${customer.full_name} added ${labels.celebration_label_their} to their Circle.`);

  await sendEmail(supabase, {
    customer_id: customer.id, template_name: "circle_member_added", reminder_type: "circle_member_added",
    circle_member_id: member.id,
    dynamic_variables: {
      first_name: firstName(customer.full_name),
      person_name: member.person_name, celebration_label: labels.celebration_label,
      occasion_type: member.occasion_type, occasion_date: member.occasion_date,
    },
  });

  return json({ status: "success", circle_member_id: member.id, is_one_time: rules.is_one_time });
});
