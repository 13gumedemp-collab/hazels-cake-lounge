// Public Resend webhook. Requests are accepted only after Svix signature
// verification. Raw HTML and attachment bytes are never stored or rendered.
import { adminClient, notify } from "../_shared/client.ts";

const MAX_BODY_BYTES = 1024 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const REPLY_DOMAIN = Deno.env.get("RESEND_REPLY_DOMAIN") ?? "reply.hazelscakelounge.co.za";
const RESEND_RECEIVING_API = "https://api.resend.com/emails/receiving";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let different = left.length ^ right.length;
  for (let index = 0; index < length; index++) {
    different |= (left[index] || 0) ^ (right[index] || 0);
  }
  return different === 0;
}

async function verifyWebhook(req: Request, rawBody: string): Promise<boolean> {
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signatureHeader = req.headers.get("svix-signature") ?? "";
  const configuredSecret = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
  if (!id || !timestamp || !signatureHeader || !configuredSecret) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  try {
    const secret = decodeBase64(configuredSecret.replace(/^whsec_/, ""));
    const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
    return signatureHeader.split(" ").some((candidate) => {
      const [version, signature] = candidate.split(",", 2);
      if (version !== "v1" || !signature) return false;
      try {
        return constantTimeEqual(expected, decodeBase64(signature));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function emailPart(value: unknown): { email: string; name: string | null } {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      email: String(record.email ?? record.address ?? "").trim().toLowerCase(),
      name: record.name ? String(record.name).trim().slice(0, 200) : null,
    };
  }
  const text = String(value ?? "").trim();
  const bracketed = text.match(/^(.*?)\s*<([^>]+)>$/);
  return bracketed
    ? { email: bracketed[2].trim().toLowerCase(), name: bracketed[1].replace(/^"|"$/g, "").trim().slice(0, 200) || null }
    : { email: text.toLowerCase(), name: null };
}

function addressList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => emailPart(entry).email).filter((email) => email.includes("@")).slice(0, 50);
}

function headerValue(headers: unknown, name: string): string | null {
  if (Array.isArray(headers)) {
    const found = headers.find((header) => String(header?.name ?? "").toLowerCase() === name.toLowerCase());
    return found?.value ? String(found.value).slice(0, 2000) : null;
  }
  if (headers && typeof headers === "object") {
    const found = Object.entries(headers as Record<string, unknown>)
      .find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] ? String(found[1]).slice(0, 2000) : null;
  }
  return null;
}

function safeTextFromHtml(value: unknown): string {
  return String(value ?? "")
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

function preview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}

function validDate(value: unknown): string {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
}

function replyThreadId(recipients: string[]): string | null {
  const escapedDomain = REPLY_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^reply\\+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@${escapedDomain}$`, "i");
  for (const recipient of recipients) {
    const match = recipient.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

async function receivedEmail(providerId: string): Promise<Record<string, unknown>> {
  const key = Deno.env.get("RESEND_INBOUND_API_KEY") ?? Deno.env.get("RESEND_API_KEY") ?? "";
  const result = await fetch(`${RESEND_RECEIVING_API}/${encodeURIComponent(providerId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!result.ok) throw new Error(`Could not retrieve received email (${result.status})`);
  return await result.json() as Record<string, unknown>;
}

async function processInbound(data: Record<string, unknown>): Promise<void> {
  const providerId = String(data.email_id ?? data.id ?? "");
  if (!providerId) throw new Error("Received event has no email ID");
  const supabase = adminClient();
  const { data: existing } = await supabase
    .from("email_messages").select("id").eq("provider_message_id", providerId).maybeSingle();
  if (existing) return;

  const received = await receivedEmail(providerId);
  const sender = emailPart(received.from ?? data.from);
  if (!sender.email.includes("@")) throw new Error("Received email has no valid sender");
  const recipients = addressList(received.to ?? data.to);
  const subject = String(received.subject ?? data.subject ?? "(no subject)").replace(/[\r\n]+/g, " ").trim().slice(0, 200) || "(no subject)";
  const internetMessageId = String(received.message_id ?? headerValue(received.headers, "message-id") ?? data.message_id ?? "").trim().slice(0, 2000) || null;
  const inReplyTo = String(headerValue(received.headers, "in-reply-to") ?? "").trim().slice(0, 2000) || null;
  const references = String(headerValue(received.headers, "references") ?? "")
    .split(/\s+/).filter(Boolean).slice(-30).map((value) => value.slice(0, 2000));

  let threadId = replyThreadId(recipients);
  if (threadId) {
    const { data: thread } = await supabase.from("email_threads").select("id").eq("id", threadId).maybeSingle();
    if (!thread) threadId = null;
  }
  if (!threadId && inReplyTo) {
    const { data: related } = await supabase
      .from("email_messages").select("thread_id").eq("internet_message_id", inReplyTo).maybeSingle();
    threadId = related?.thread_id ?? null;
  }

  const { data: customer } = await supabase
    .from("customers").select("id, full_name").ilike("email", sender.email).maybeSingle();
  if (!threadId) {
    const { data: thread, error } = await supabase.from("email_threads").insert({
      customer_id: customer?.id ?? null,
      contact_email: sender.email,
      contact_name: sender.name ?? customer?.full_name ?? null,
      subject: subject.replace(/^re:\s*/i, "") || "(no subject)",
      status: "open",
    }).select("id").single();
    if (error || !thread) throw new Error(error?.message || "Could not create inbound thread");
    threadId = thread.id;
  }

  const textBody = String(received.text ?? "").trim().slice(0, 100000) || safeTextFromHtml(received.html);
  const attachments = (Array.isArray(received.attachments) ? received.attachments : []).slice(0, 50).map((attachment) => ({
    id: String(attachment?.id ?? "").slice(0, 200),
    filename: String(attachment?.filename ?? "attachment").replace(/[\r\n]/g, " ").slice(0, 255),
    content_type: String(attachment?.content_type ?? "application/octet-stream").slice(0, 200),
    content_disposition: String(attachment?.content_disposition ?? "attachment").slice(0, 100),
  }));
  const messageTime = validDate(received.created_at ?? data.created_at);
  const { error: insertError } = await supabase.from("email_messages").insert({
    thread_id: threadId,
    direction: "inbound",
    provider_message_id: providerId,
    internet_message_id: internetMessageId,
    in_reply_to: inReplyTo,
    references_header: references,
    from_address: sender.email,
    to_addresses: recipients,
    subject,
    text_body: textBody,
    attachments,
    status: "received",
    created_at: messageTime,
  });
  if (insertError) throw new Error(insertError.message);

  const { data: currentThread } = await supabase
    .from("email_threads").select("unread_count").eq("id", threadId).single();
  await supabase.from("email_threads").update({
    unread_count: Number(currentThread?.unread_count ?? 0) + 1,
    last_message_at: messageTime,
    last_message_preview: preview(textBody),
    status: "open",
    updated_at: new Date().toISOString(),
  }).eq("id", threadId);
  await notify(supabase, "email_received", `New email from ${sender.name || sender.email}: ${subject}`, "high", `/messages?thread=${threadId}`);
}

async function suppressRecipients(eventType: string, data: Record<string, unknown>): Promise<void> {
  if (!new Set(["email.bounced", "email.suppressed", "email.complained"]).has(eventType)) return;
  const recipients = addressList(data.to);
  if (!recipients.length) return;
  const reason = eventType === "email.bounced" ? "bounce" : eventType === "email.complained" ? "complaint" : "provider_suppressed";
  const providerId = String(data.email_id ?? "") || null;
  const bounce = data.bounce && typeof data.bounce === "object" ? data.bounce as Record<string, unknown> : {};
  const diagnostic = String(bounce.diagnosticCode ?? bounce.diagnostic_code ?? bounce.message ?? "").slice(0, 2000) || null;
  const supabase = adminClient();
  for (const email of recipients) {
    const { data: customer } = await supabase.from("customers").select("id").ilike("email", email).maybeSingle();
    await supabase.from("email_suppressions").upsert({
      email_address: email,
      customer_id: customer?.id ?? null,
      reason,
      provider_event: eventType,
      provider_message_id: providerId,
      diagnostic_code: diagnostic,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "email_address" });
    await notify(supabase, "email_suppressed", `${email} was automatically suppressed after ${reason.replaceAll("_", " ")}.`, "high", "/messages");
  }
}

async function processDelivery(eventType: string, data: Record<string, unknown>): Promise<void> {
  const providerId = String(data.email_id ?? "");
  if (!providerId) return;
  const statusByType: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delivery_delayed",
    "email.bounced": "bounced",
    "email.failed": "failed",
    "email.suppressed": "suppressed",
    "email.complained": "complained",
  };
  const status = statusByType[eventType];
  if (!status) return;
  const eventTime = validDate(data.created_at);
  const details = data.bounce && typeof data.bounce === "object"
    ? String((data.bounce as Record<string, unknown>).message ?? (data.bounce as Record<string, unknown>).diagnosticCode ?? "").slice(0, 2000) || null
    : null;
  const changes: Record<string, unknown> = { status, status_detail: details };
  if (status === "delivered") changes.delivered_at = eventTime;
  if (status === "bounced") changes.bounced_at = eventTime;
  const supabase = adminClient();
  await supabase.from("email_messages").update(changes).eq("provider_message_id", providerId);
  await supabase.from("reminder_log").update({
    status,
    error_message: details,
  }).eq("resend_email_id", providerId);
  await suppressRecipients(eventType, data);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return response({ error: "Payload too large" }, 413);
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return response({ error: "Payload too large" }, 413);
  if (!await verifyWebhook(req, rawBody)) return response({ error: "Invalid signature" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }

  const eventId = req.headers.get("svix-id")!;
  const eventType = String(payload.type ?? "");
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const providerId = String(data.email_id ?? "") || null;
  const supabase = adminClient();
  const { data: existing } = await supabase
    .from("email_webhook_events").select("status").eq("event_id", eventId).maybeSingle();
  if (existing?.status === "processed") return response({ received: true, duplicate: true });

  await supabase.from("email_webhook_events").upsert({
    event_id: eventId,
    event_type: eventType,
    provider_message_id: providerId,
    status: "processing",
    error_message: null,
    received_at: new Date().toISOString(),
    processed_at: null,
  }, { onConflict: "event_id" });

  try {
    if (eventType === "email.received") await processInbound(data);
    else await processDelivery(eventType, data);
    await supabase.from("email_webhook_events").update({
      status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("event_id", eventId);
    return response({ received: true });
  } catch (error) {
    const message = String(error).slice(0, 2000);
    await supabase.from("email_webhook_events").update({
      status: "failed",
      error_message: message,
    }).eq("event_id", eventId);
    return response({ error: "Webhook processing failed" }, 500);
  }
});
