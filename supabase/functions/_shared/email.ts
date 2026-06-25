// Shared email sender used by the send-email function and directly by other
// functions (daily-occasion-checker, occasion-registration, generate-memory-card).
// Sends via Resend, logs to reminder_log, and creates a notification.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { businessVars, fillTemplate, firstName, notify } from "./client.ts";

const RESEND_API = "https://api.resend.com/emails";
const FROM = Deno.env.get("FROM_EMAIL") ??
  "Hazel's Cake Lounge <hello@hazelscakelounge.co.za>";

export interface SendEmailInput {
  customer_id: string;
  template_name: string;
  dynamic_variables?: Record<string, unknown>;
  occasion_id?: string | null;
  reminder_type?: string;
  attachments?: { filename: string; content: string }[];
}

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  error?: string | null;
}

// Send a templated email to an explicit address (e.g. Hazel's business inbox).
// No consent check, no per-customer reminder_log entry.
export async function sendToAddress(
  to: string,
  template_name: string,
  vars: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<SendResult> {
  const { data: template } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("template_name", template_name)
    .single();
  if (!template) return { status: "failed", error: `Template '${template_name}' not found` };
  const merged = { ...businessVars(), ...vars };

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: fillTemplate(template.subject, merged),
        html: fillTemplate(template.body, merged),
      }),
    });
    if (!res.ok) return { status: "failed", error: `Resend ${res.status}: ${await res.text()}` };
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: String(e) };
  }
}

export async function sendEmail(
  supabase: SupabaseClient,
  input: SendEmailInput,
): Promise<SendResult> {
  const { customer_id, template_name } = input;
  const occasion_id = input.occasion_id ?? null;
  const reminderType = input.reminder_type ?? template_name;
  const vars = { ...businessVars(), ...(input.dynamic_variables ?? {}) };

  if (!customer_id || !template_name) {
    return { status: "failed", error: "customer_id and template_name required" };
  }

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, full_name, email, email_consent")
    .eq("id", customer_id)
    .single();
  if (custErr || !customer) return { status: "failed", error: "Customer not found" };

  if (customer.email_consent === false) {
    await supabase.from("reminder_log").insert({
      customer_id, occasion_id, reminder_type: reminderType, channel: "email",
      status: "skipped", error_message: "email_consent is false",
    });
    await notify(supabase, "reminder_skipped",
      `Email skipped for ${customer.full_name}: no email consent`);
    return { status: "skipped" };
  }

  const { data: template, error: tplErr } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("template_name", template_name)
    .single();
  if (tplErr || !template) {
    return { status: "failed", error: `Template '${template_name}' not found` };
  }

  if (vars.first_name === undefined) vars.first_name = firstName(customer.full_name);
  const subject = fillTemplate(template.subject, vars);
  const html = fillTemplate(template.body, vars);

  let status: SendResult["status"] = "sent";
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
        attachments: input.attachments,
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
    customer_id, occasion_id, reminder_type: reminderType, channel: "email",
    status, error_message: errorMessage,
  });

  if (status === "sent") {
    await notify(supabase, "reminder_sent",
      `Email '${template_name}' sent to ${customer.full_name}`);
  } else {
    await notify(supabase, "reminder_failed",
      `Email '${template_name}' to ${customer.full_name} FAILED: ${errorMessage}`);
  }
  return { status, error: errorMessage };
}
