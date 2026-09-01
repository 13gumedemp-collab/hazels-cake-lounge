// Shared Resend sender. Customer email is recorded as private threads and
// messages so replies, delivery events and suppressions stay visible together.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { businessVars, fillTemplate, firstName, notify } from "./client.ts";

const RESEND_API = "https://api.resend.com/emails";
const FROM = Deno.env.get("RESEND_FROM_NAME") && Deno.env.get("RESEND_FROM_EMAIL")
  ? `${Deno.env.get("RESEND_FROM_NAME")} <${Deno.env.get("RESEND_FROM_EMAIL")}>`
  : (Deno.env.get("FROM_EMAIL") ?? "Hazel's Cake Lounge <hello@hazelscakelounge.co.za>");
const BUSINESS_REPLY_TO = Deno.env.get("BUSINESS_EMAIL") || undefined;
const REPLY_DOMAIN = Deno.env.get("RESEND_REPLY_DOMAIN") ?? "reply.hazelscakelounge.co.za";

export interface SendEmailInput {
  customer_id?: string | null;
  to_address?: string;
  contact_name?: string | null;
  template_name?: string;
  essential?: boolean;
  dynamic_variables?: Record<string, unknown>;
  circle_member_id?: string | null;
  reminder_type?: string;
  attachments?: { filename: string; content: string }[];
  thread_id?: string | null;
  subject?: string;
  text?: string;
  in_reply_to?: string | null;
  references?: string[];
}

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  error?: string | null;
  thread_id?: string | null;
  message_id?: string | null;
}

interface CustomerRecord {
  id: string;
  full_name: string;
  email: string;
  email_consent: boolean;
  email_unsubscribed: boolean;
}

interface ThreadRecord {
  id: string;
  customer_id: string | null;
  contact_email: string;
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function replyAddress(threadId: string): string {
  return `reply+${threadId}@${REPLY_DOMAIN}`;
}

function preview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}

function plainText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 100000);
}

function textHtml(value: string): string {
  const escaped = value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character] as string));
  return `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#2a2722">${escaped.replace(/\n/g, "<br>")}</div>`;
}

function deliveryIssue(error: string | null): string {
  if (/401|api key is invalid/i.test(error ?? "")) return "Resend rejected the request. Check the email delivery key.";
  return "Check the email delivery settings.";
}

function sastYear(): number {
  return new Date(Date.now() + 2 * 3600 * 1000).getUTCFullYear();
}

async function isSuppressed(supabase: SupabaseClient, email: string): Promise<{ reason: string } | null> {
  const { data } = await supabase
    .from("email_suppressions")
    .select("reason")
    .eq("email_address", normaliseEmail(email))
    .eq("active", true)
    .maybeSingle();
  return data as { reason: string } | null;
}

async function ensureThread(
  supabase: SupabaseClient,
  input: SendEmailInput,
  customer: CustomerRecord | null,
  email: string,
  subject: string,
): Promise<ThreadRecord> {
  if (input.thread_id) {
    const { data, error } = await supabase
      .from("email_threads")
      .select("id, customer_id, contact_email")
      .eq("id", input.thread_id)
      .maybeSingle();
    if (error || !data) throw new Error("Email thread not found");
    if (normaliseEmail(data.contact_email) !== normaliseEmail(email)) {
      throw new Error("Email thread does not match the recipient");
    }
    return data as ThreadRecord;
  }

  const { data, error } = await supabase
    .from("email_threads")
    .insert({
      customer_id: customer?.id ?? input.customer_id ?? null,
      contact_email: normaliseEmail(email),
      contact_name: customer?.full_name ?? input.contact_name ?? null,
      subject: subject || "(no subject)",
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id, customer_id, contact_email")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create the email thread");
  return data as ThreadRecord;
}

// Sends a templated operational alert to Hazel's ordinary business inbox.
export async function sendToAddress(
  to: string, template_name: string, vars: Record<string, unknown>, supabase: SupabaseClient,
): Promise<SendResult> {
  const suppression = await isSuppressed(supabase, to);
  if (suppression) return { status: "skipped", error: `address suppressed: ${suppression.reason}` };

  const { data: template } = await supabase
    .from("message_templates").select("subject, body").eq("template_name", template_name).single();
  if (!template) return { status: "failed", error: `Template '${template_name}' not found` };
  const merged = { ...businessVars(), ...vars };
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        reply_to: BUSINESS_REPLY_TO,
        to: [to],
        subject: fillTemplate(template.subject, merged),
        html: fillTemplate(template.body, merged, true),
      }),
    });
    const raw = await res.text();
    if (!res.ok) return { status: "failed", error: `Resend ${res.status}: ${raw}` };
    const result = JSON.parse(raw || "{}") as { id?: string };
    return { status: "sent", message_id: result.id ?? null };
  } catch (error) {
    return { status: "failed", error: String(error) };
  }
}

export async function sendEmail(supabase: SupabaseClient, input: SendEmailInput): Promise<SendResult> {
  const customerId = input.customer_id ?? null;
  const circleMemberId = input.circle_member_id ?? null;
  const reminderType = input.reminder_type ?? input.template_name ?? "conversation_reply";
  const vars = { ...businessVars(), ...(input.dynamic_variables ?? {}) };
  if (!customerId && !input.to_address) return { status: "failed", error: "customer_id or to_address required" };

  let customer: CustomerRecord | null = null;
  if (customerId) {
    const { data } = await supabase
      .from("customers")
      .select("id, full_name, email, email_consent, email_unsubscribed")
      .eq("id", customerId)
      .single();
    if (!data) return { status: "failed", error: "Customer not found" };
    customer = data as CustomerRecord;
  }

  const to = normaliseEmail(input.to_address || customer?.email || "");
  if (!to || !to.includes("@")) return { status: "failed", error: "A valid recipient email is required" };

  const log = (status: string, error_message: string | null = null, providerId: string | null = null, threadId: string | null = null) =>
    supabase.from("reminder_log").insert({
      customer_id: customerId,
      circle_member_id: circleMemberId,
      reminder_type: reminderType,
      channel: "email",
      status,
      error_message,
      year_sent: sastYear(),
      resend_email_id: providerId,
      email_thread_id: threadId,
    });

  if (customer && !input.essential && (customer.email_consent === false || customer.email_unsubscribed === true)) {
    await log("skipped", "email opted out");
    await notify(supabase, "reminder_skipped", `Email skipped for ${customer.full_name}: opted out`);
    return { status: "skipped" };
  }

  const suppression = await isSuppressed(supabase, to);
  if (suppression) {
    await log("skipped", `address suppressed: ${suppression.reason}`);
    await notify(supabase, "email_suppressed", `Email to ${to} was blocked because the address is suppressed.`, "high", "/messages");
    return { status: "skipped", error: `address suppressed: ${suppression.reason}` };
  }

  let subject = input.subject?.trim() || "";
  let html = "";
  let messageText = input.text?.trim() || "";
  if (input.template_name) {
    const { data: template } = await supabase
      .from("message_templates").select("subject, body").eq("template_name", input.template_name).single();
    if (!template) return { status: "failed", error: `Template '${input.template_name}' not found` };
    if (customer && vars.first_name === undefined) vars.first_name = firstName(customer.full_name);
    subject = subject || fillTemplate(template.subject, vars);
    html = fillTemplate(template.body, vars, true);
    messageText = messageText || plainText(html);
  } else {
    if (!subject || !messageText) return { status: "failed", error: "subject and text required" };
    html = textHtml(messageText);
  }

  subject = subject.replace(/[\r\n]+/g, " ").trim().slice(0, 200) || "(no subject)";
  messageText = messageText.slice(0, 100000);

  let thread: ThreadRecord;
  try {
    thread = await ensureThread(supabase, input, customer, to, subject.replace(/^re:\s*/i, ""));
  } catch (error) {
    return { status: "failed", error: String(error) };
  }

  const headers: Record<string, string> = {};
  if (input.in_reply_to) headers["In-Reply-To"] = input.in_reply_to.replace(/[\r\n]/g, "");
  if (input.references?.length) headers.References = input.references.map((value) => value.replace(/[\r\n]/g, "")).join(" ");

  let status: SendResult["status"] = "sent";
  let errorMessage: string | null = null;
  let providerId: string | null = null;
  try {
    const payload: Record<string, unknown> = {
      from: FROM,
      reply_to: replyAddress(thread.id),
      to: [to],
      subject,
      html,
      attachments: input.attachments,
    };
    if (Object.keys(headers).length) payload.headers = headers;
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) {
      status = "failed";
      errorMessage = `Resend ${res.status}: ${raw}`;
    } else {
      providerId = (JSON.parse(raw || "{}") as { id?: string }).id ?? null;
      if (!providerId) {
        status = "failed";
        errorMessage = "Resend accepted the request without a message ID";
      }
    }
  } catch (error) {
    status = "failed";
    errorMessage = String(error);
  }

  const messageTime = new Date().toISOString();
  const { error: messageError } = await supabase.from("email_messages").insert({
    thread_id: thread.id,
    direction: "outbound",
    provider_message_id: providerId,
    in_reply_to: input.in_reply_to ?? null,
    references_header: input.references ?? [],
    from_address: FROM,
    to_addresses: [to],
    subject,
    text_body: messageText,
    attachments: (input.attachments ?? []).map((attachment) => ({ filename: attachment.filename })),
    status: status === "sent" ? "sent" : "failed",
    status_detail: errorMessage,
    sent_at: status === "sent" ? messageTime : null,
  });

  await supabase.from("email_threads").update({
    last_message_at: messageTime,
    last_message_preview: preview(messageText),
    status: "open",
    updated_at: messageTime,
  }).eq("id", thread.id);
  await log(status, errorMessage, providerId, thread.id);

  if (messageError) {
    await notify(supabase, "email_tracking_failed", `Email delivery record could not be saved for ${to}.`, "high", "/messages");
  }
  if (status === "sent") {
    await notify(supabase, "reminder_sent", `Email '${reminderType}' sent to ${customer?.full_name || to}`);
  } else {
    await notify(supabase, "reminder_failed", `Could not send the ${reminderType.replaceAll("_", " ")} email to ${customer?.full_name || to}. ${deliveryIssue(errorMessage)}`, "high", "/messages");
  }
  return { status, error: errorMessage, thread_id: thread.id, message_id: providerId };
}
