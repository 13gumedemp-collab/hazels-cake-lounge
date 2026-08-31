import MessageCentre, { MessageLog } from "@/components/MessageCentre";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const sb = supabaseAdmin();
  const [logsResult, customersResult, membersResult, templatesResult] = await Promise.all([
    sb.from("reminder_log").select(`
      id, customer_id, circle_member_id, reminder_type, status, error_message, sent_at,
      customer:customers ( id, full_name, email ),
      member:circle_members ( id, person_name, occasion_type )
    `).eq("channel", "email").order("sent_at", { ascending: false }).limit(300),
    sb.from("customers").select("id, full_name, email").order("full_name"),
    sb.from("circle_members").select("id, customer_id, person_name, occasion_type").order("person_name"),
    sb.from("message_templates").select("template_name, subject").eq("channel", "email").order("template_name"),
  ]);

  const logs = (logsResult.data || []) as unknown as MessageLog[];
  const customers = (customersResult.data || []).map((row) => ({ id: row.id, label: `${row.full_name} (${row.email})` }));
  const members = (membersResult.data || []).map((row) => ({ id: row.id, customer_id: row.customer_id, label: `${row.person_name}'s ${row.occasion_type}` }));
  const templates = (templatesResult.data || []).map((row) => ({ id: row.template_name, label: row.template_name.replaceAll("_", " "), subject: row.subject }));

  return (
    <div className="admin-page max-w-[1500px] mx-auto">
      <div className="page-heading flex items-end justify-between gap-4 flex-wrap">
        <div><p className="eyebrow">Delivery history</p><h1>Message Centre</h1><p className="text-creamSoft mt-2">Every customer email, with clear failures and safe manual sends.</p></div>
        <span>{logs.filter((log) => log.status === "failed").length} need attention</span>
      </div>
      <MessageCentre logs={logs} customers={customers} members={members} templates={templates} />
    </div>
  );
}
