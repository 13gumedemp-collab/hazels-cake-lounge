// process-enquiry  (public — called from the website enquiry overlay)
// Creates/updates customer, creates a circle_member (with recurring rules by
// occasion type), creates an enquiry order, notifies Hazel, and sends the
// customer acknowledgement + Hazel's alert. The 24h no-reply nudge is handled
// by the hourly enquiry-followup-check cron.
import { adminClient, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { sendEmail, sendToAddress } from "../_shared/email.ts";

// recurring_yearly / is_one_time rules by occasion type.
function occasionRules(type: string): { recurring_yearly: boolean; is_one_time: boolean } {
  switch ((type || "").toLowerCase()) {
    case "birthday":
    case "anniversary":
      return { recurring_yearly: true, is_one_time: false };
    case "wedding":
    case "graduation":
    case "baby shower":
      return { recurring_yearly: false, is_one_time: true };
    default: // Just Because, Other
      return { recurring_yearly: false, is_one_time: false };
  }
}

interface Payload {
  full_name: string;
  email: string;
  whatsapp_number?: string;
  occasion_for: string;
  relationship_to_customer?: string;
  occasion_type: string;
  occasion_date: string;
  cake_description?: string;
  number_of_people?: string;
  colours_and_themes?: string;
  inspiration_photo_url?: string;
  email_consent?: boolean;
  whatsapp_consent?: boolean;
  occasion_book_opted_in?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let p: Payload;
  try { p = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (!p.full_name || !p.email || !p.occasion_for || !p.occasion_type || !p.occasion_date) {
    return json({ error: "Missing required fields" }, 400);
  }
  const supabase = adminClient();
  const emailConsent = p.email_consent ?? true;
  const whatsappConsent = p.whatsapp_consent ?? false;

  // (a) upsert customer
  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .upsert({
      full_name: p.full_name,
      email: p.email.toLowerCase().trim(),
      whatsapp_number: p.whatsapp_number || null,
      email_consent: emailConsent,
      whatsapp_consent: whatsappConsent,
      whatsapp_consent_date: whatsappConsent ? new Date().toISOString() : null,
    }, { onConflict: "email" })
    .select("id, full_name, email, whatsapp_number")
    .single();
  if (cErr || !customer) return json({ error: `Customer save failed: ${cErr?.message}` }, 500);

  // (b+c) circle_member with rules
  const rules = occasionRules(p.occasion_type);
  const { data: member, error: mErr } = await supabase
    .from("circle_members")
    .insert({
      customer_id: customer.id,
      person_name: p.occasion_for,
      relationship_to_customer: p.relationship_to_customer || null,
      occasion_type: p.occasion_type,
      occasion_date: p.occasion_date,
      recurring_yearly: p.occasion_book_opted_in === false ? false : rules.recurring_yearly,
      is_one_time: rules.is_one_time,
      notes: p.cake_description || null,
    })
    .select("id, person_name, occasion_type, occasion_date, recurring_yearly")
    .single();
  if (mErr || !member) return json({ error: `Circle member failed: ${mErr?.message}` }, 500);

  // (d) order
  const { data: order } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      circle_member_id: member.id,
      cake_description: p.cake_description || null,
      inspiration_photo_url: p.inspiration_photo_url || null,
      number_of_people: p.number_of_people || null,
      colours_and_themes: p.colours_and_themes || null,
      order_date: new Date().toISOString().slice(0, 10),
      occasion_date: p.occasion_date,
      status: "enquiry",
    })
    .select("id")
    .single();

  // (e) notification (high / gold)
  await notify(
    supabase, "new_enquiry",
    `New enquiry from ${customer.full_name} for ${member.person_name}'s ${member.occasion_type} on ${member.occasion_date}.`,
    "high", "/orders",
  );

  // (f+g) emails
  const vars = {
    first_name: firstName(customer.full_name),
    customer_name: customer.full_name,
    customer_email: customer.email,
    customer_phone: customer.whatsapp_number ?? "",
    person_name: member.person_name,
    relationship: p.relationship_to_customer ?? "",
    occasion_type: member.occasion_type,
    occasion_date: member.occasion_date,
    customer_notes: p.cake_description ?? "",
    number_of_people: p.number_of_people ?? "",
    occasion_book_opted_in: member.recurring_yearly ? "yes" : "",
    whatsapp_opted_in: whatsappConsent ? "yes" : "",
    occasion_book_status: member.recurring_yearly ? "Opted in" : "Not opted in",
    whatsapp_status: whatsappConsent ? "Opted in" : "Not opted in",
  };
  const businessEmail = Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za";
  await Promise.allSettled([
    sendEmail(supabase, {
      customer_id: customer.id, template_name: "enquiry_acknowledgement",
      reminder_type: "enquiry_acknowledgement", circle_member_id: member.id, dynamic_variables: vars,
    }),
    sendToAddress(businessEmail, "new_enquiry_alert", vars, supabase),
  ]);

  return json({
    status: "success",
    customer_id: customer.id,
    circle_member_id: member.id,
    order_id: order?.id ?? null,
    first_name: firstName(customer.full_name),
    person_name: member.person_name,
    occasion_type: member.occasion_type,
    occasion_date: member.occasion_date,
    occasion_book_opted_in: member.recurring_yearly,
  });
});
