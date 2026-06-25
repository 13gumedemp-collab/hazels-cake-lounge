// send-email
// Accepts: { customer_id, template_name, dynamic_variables, occasion_id?,
//            reminder_type?, attachments? }
// Fetches the template, fills variables, sends via Resend, logs to
// reminder_log, and creates a notification.
import {
  adminClient,
  corsHeaders,
  fillTemplate,
  firstName,
  json,
  notify,
} from "../_shared/client.ts";

const RESEND_API = "https://api.resend.com/emails";
const FROM = Deno.env.get("FROM_EMAIL") ??
  "Hazel's Cake Lounge <hello@hazelscakelounge.co.za>";

interface Payload {
  customer_id: string;
  template_name: string;
  dynamic_variables?: Record<string, unknown>;
  occasion_id?: string;
  reminder_type?: string;
  // Optional Resend attachments: [{ filename, content (base64) }]
  attachments?: { filename: string; content: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { customer_id, template_name, occasion_id } = body;
  const reminderType = body.reminder_type ?? template_name;
  const vars = { ...(body.dynamic_variables ?? {}) };

  if (!customer_id || !template_name) {
    return json({ error: "customer_id and template_name are required" }, 400);
  }

  // Recipient
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, full_name, email, email_consent")
    .eq("id", customer_id)
    .single();

  if (custErr || !customer) {
    return json({ error: "Customer not found" }, 404);
  }
  if (customer.email_consent === false) {
    await supabase.from("reminder_log").insert({
      customer_id,
      occasion_id: occasion_id ?? null,
      reminder_type: reminderType,
      channel: "email",
      status: "skipped",
      error_message: "email_consent is false",
    });
    await notify(supabase, "reminder_skipped",
      `Email skipped for ${customer.full_name}: no email consent`);
    return json({ status: "skipped", reason: "no email consent" });
  }

  // Template
  const { data: template, error: tplErr } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("template_name", template_name)
    .single();

  if (tplErr || !template) {
    return json({ error: `Template '${template_name}' not found` }, 404);
  }

  // Always make first_name available.
  if (vars.first_name === undefined) vars.first_name = firstName(customer.full_name);

  const subject = fillTemplate(template.subject, vars);
  const html = fillTemplate(template.body, vars);

  // Send via Resend
  let status = "sent";
  let errorMessage: string | null = null;
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [customer.email],
        subject,
        html,
        attachments: body.attachments,
      }),
    });
    if (!res.ok) {
      status = "failed";
      errorMessage = `Resend ${res.status}: ${await res.text()}`;
    }
  } catch (e) {
    status = "failed";
    errorMessage = String(e);
  }

  await supabase.from("reminder_log").insert({
    customer_id,
    occasion_id: occasion_id ?? null,
    reminder_type: reminderType,
    channel: "email",
    status,
    error_message: errorMessage,
  });

  if (status === "sent") {
    await notify(supabase, "reminder_sent",
      `Email '${template_name}' sent to ${customer.full_name}`);
    return json({ status: "sent" });
  }
  await notify(supabase, "reminder_failed",
    `Email '${template_name}' to ${customer.full_name} FAILED: ${errorMessage}`);
  return json({ status: "failed", error: errorMessage }, 502);
});
