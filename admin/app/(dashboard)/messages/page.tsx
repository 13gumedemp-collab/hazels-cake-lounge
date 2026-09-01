import MessageCentre, { EmailMessage, EmailSuppression, EmailThread, MessageLog } from "@/components/MessageCentre";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const sb = supabaseAdmin();
  const [logsResult, threadsResult, messagesResult, suppressionsResult, customersResult, membersResult, templatesResult] = await Promise.all([
    sb.from("reminder_log").select(`
      id, customer_id, circle_member_id, reminder_type, status, error_message, sent_at, resend_email_id, email_thread_id,
      customer:customers ( id, full_name, email ),
      member:circle_members ( id, person_name, occasion_type )
    `).eq("channel", "email").order("sent_at", { ascending: false }).limit(300),
    sb.from("email_threads").select(`
      id, customer_id, contact_email, contact_name, subject, status, unread_count,
      last_message_at, last_message_preview,
      customer:customers ( id, full_name, email )
    `).order("last_message_at", { ascending: false }).limit(500),
    sb.from("email_messages").select(`
      id, thread_id, direction, from_address, to_addresses, subject, text_body,
      attachments, status, status_detail, created_at, sent_at, delivered_at, bounced_at
    `).order("created_at", { ascending: true }).limit(1500),
    sb.from("email_suppressions").select(`
      email_address, reason, diagnostic_code, updated_at,
      customer:customers ( id, full_name, email )
    `).eq("active", true).order("updated_at", { ascending: false }).limit(500),
    sb.from("customers").select("id, full_name, email").order("full_name"),
    sb.from("circle_members").select("id, customer_id, person_name, occasion_type").order("person_name"),
    sb.from("message_templates").select("template_name, subject").eq("channel", "email").order("template_name"),
  ]);

  const logs = (logsResult.data || []) as unknown as MessageLog[];
  const threads = (threadsResult.data || []) as unknown as EmailThread[];
  const messages = (messagesResult.data || []) as unknown as EmailMessage[];
  const suppressions = (suppressionsResult.data || []) as unknown as EmailSuppression[];
  const customers = (customersResult.data || []).map((row) => ({ id: row.id, label: `${row.full_name} (${row.email})` }));
  const members = (membersResult.data || []).map((row) => ({ id: row.id, customer_id: row.customer_id, label: `${row.person_name}'s ${row.occasion_type}` }));
  const templates = (templatesResult.data || []).map((row) => ({ id: row.template_name, label: row.template_name.replaceAll("_", " "), subject: row.subject }));

  return (
    <div className="admin-page max-w-[1500px] mx-auto">
      <div className="page-heading flex items-end justify-between gap-4 flex-wrap">
        <div><p className="eyebrow">Two way email</p><h1>Message Centre</h1><p className="text-creamSoft mt-2">Customer replies, safe conversations, delivery history and automatic bounce protection.</p></div>
        <span>{threads.reduce((total, thread) => total + thread.unread_count, 0)} unread</span>
      </div>
      <MessageCentre logs={logs} threads={threads} messages={messages} suppressions={suppressions} customers={customers} members={members} templates={templates} />
    </div>
  );
}
