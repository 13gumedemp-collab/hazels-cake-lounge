// occasion-registration  (public — called from the website)
// Creates/updates a customer, creates their occasion(s), optionally creates an
// enquiry order, raises a notification, and sends the right emails:
//   source 'enquiry'      -> enquiry_acknowledgement (customer) + new_enquiry_alert (Hazel)
//   source 'occasion_book'-> welcome_occasion_book (customer)
//
// Accepts:
// {
//   customer: { full_name, email, whatsapp_number?, own_birthday? },
//   consent:  { email_consent?: bool, whatsapp_consent?: bool },
//   occasions:[ { person_name, occasion_type, occasion_date, recurring_yearly?, notes? } ],
//   order?:   { cake_description?, cake_flavour?, occasion_date?, delivery_or_collection? },
//   source?:  'enquiry' | 'occasion_book'
// }
import { adminClient, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { sendEmail, sendToAddress } from "../_shared/email.ts";

interface Occasion {
  person_name: string;
  occasion_type: string;
  occasion_date: string;
  recurring_yearly?: boolean;
  notes?: string;
}
interface Payload {
  customer: { full_name: string; email: string; whatsapp_number?: string; own_birthday?: string };
  consent?: { email_consent?: boolean; whatsapp_consent?: boolean };
  occasions: Occasion[];
  order?: {
    cake_description?: string; cake_flavour?: string;
    occasion_date?: string; delivery_or_collection?: string;
  };
  source?: "enquiry" | "occasion_book";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { customer, occasions, order } = body;
  const source = body.source ?? "occasion_book";
  if (!customer?.full_name || !customer?.email) {
    return json({ error: "Customer full_name and email are required" }, 400);
  }
  if (!Array.isArray(occasions) || occasions.length === 0) {
    return json({ error: "At least one occasion is required" }, 400);
  }

  const supabase = adminClient();
  const emailConsent = body.consent?.email_consent ?? true;
  const whatsappConsent = body.consent?.whatsapp_consent ?? false;

  // (a) Upsert customer by email (create or update existing).
  const customerRow: Record<string, unknown> = {
    full_name: customer.full_name,
    email: customer.email.toLowerCase().trim(),
    whatsapp_number: customer.whatsapp_number || null,
    own_birthday: customer.own_birthday || null,
    email_consent: emailConsent,
    whatsapp_consent: whatsappConsent,
    whatsapp_consent_date: whatsappConsent ? new Date().toISOString() : null,
  };
  const { data: saved, error: custErr } = await supabase
    .from("customers")
    .upsert(customerRow, { onConflict: "email" })
    .select("id, full_name, email, whatsapp_number")
    .single();
  if (custErr || !saved) {
    return json({ error: `Could not save customer: ${custErr?.message}` }, 500);
  }

  // (b) Create occasion(s).
  const occasionRows = occasions.map((o) => ({
    customer_id: saved.id,
    person_name: o.person_name,
    occasion_type: o.occasion_type,
    occasion_date: o.occasion_date,
    recurring_yearly: o.recurring_yearly ?? true,
    notes: o.notes || null,
  }));
  const { data: insertedOccasions, error: occErr } = await supabase
    .from("occasions")
    .insert(occasionRows)
    .select("id, person_name, occasion_type, occasion_date, recurring_yearly, notes");
  if (occErr) return json({ error: `Could not save occasions: ${occErr.message}` }, 500);
  const first = insertedOccasions?.[0];

  // (c) Optional enquiry order.
  let orderId: string | null = null;
  if (source === "enquiry") {
    const { data: newOrder } = await supabase
      .from("orders")
      .insert({
        customer_id: saved.id,
        occasion_id: first?.id ?? null,
        cake_flavour: order?.cake_flavour || null,
        cake_description: order?.cake_description || first?.notes || null,
        order_date: new Date().toISOString().slice(0, 10),
        occasion_date: order?.occasion_date || first?.occasion_date || null,
        delivery_or_collection: order?.delivery_or_collection || null,
        status: "enquiry",
      })
      .select("id")
      .single();
    orderId = newOrder?.id ?? null;
  }

  // (d) Notification.
  const prettyDate = first?.occasion_date ?? "";
  if (source === "enquiry") {
    await notify(supabase, "new_enquiry",
      `New enquiry received from ${saved.full_name} for ${first?.person_name}'s ${first?.occasion_type} on ${prettyDate}.`);
  } else {
    await notify(supabase, "new_customer",
      `${saved.full_name} added ${first?.person_name}'s ${first?.occasion_type} to the Occasion Book.`);
  }

  // Emails
  const sharedVars = {
    first_name: firstName(saved.full_name),
    customer_name: saved.full_name,
    customer_email: saved.email,
    customer_phone: saved.whatsapp_number ?? "",
    person_name: first?.person_name ?? "",
    occasion_type: first?.occasion_type ?? "",
    occasion_date: prettyDate,
    customer_notes: first?.notes ?? (order?.cake_description ?? ""),
    occasion_book_opted_in: first?.recurring_yearly ? "yes" : "",
    whatsapp_opted_in: whatsappConsent ? "yes" : "",
    occasion_book_status: first?.recurring_yearly ? "Opted in" : "Not opted in",
    whatsapp_status: whatsappConsent ? "Opted in" : "Not opted in",
  };

  const businessEmail = Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za";
  const emailJobs: Promise<unknown>[] = [];

  if (source === "enquiry") {
    // EMAIL 1: customer acknowledgement + Occasion Book welcome (combined)
    emailJobs.push(sendEmail(supabase, {
      customer_id: saved.id,
      template_name: "enquiry_acknowledgement",
      reminder_type: "enquiry_acknowledgement",
      occasion_id: first?.id ?? null,
      dynamic_variables: sharedVars,
    }));
    // EMAIL 2: Hazel's internal alert
    emailJobs.push(sendToAddress(businessEmail, "new_enquiry_alert", sharedVars, supabase));
  } else {
    emailJobs.push(sendEmail(supabase, {
      customer_id: saved.id,
      template_name: "welcome_occasion_book",
      reminder_type: "welcome",
      occasion_id: first?.id ?? null,
      dynamic_variables: sharedVars,
    }));
  }
  const results = await Promise.allSettled(emailJobs);
  const emailOk = results.every((r) => r.status === "fulfilled");

  return json({
    status: "success",
    customer_id: saved.id,
    occasion_ids: insertedOccasions?.map((o) => o.id) ?? [],
    order_id: orderId,
    emails_ok: emailOk,
    first_name: firstName(saved.full_name),
    person_name: first?.person_name ?? "",
    occasion_type: first?.occasion_type ?? "",
  });
});
