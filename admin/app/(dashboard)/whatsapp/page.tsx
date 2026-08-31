import WhatsAppTasks, { WhatsAppTask } from "@/components/WhatsAppTasks";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const { data } = await supabaseAdmin()
    .from("whatsapp_reminders_due")
    .select(`
      id, reminder_type, whatsapp_number, message_copy, due_date, status, completed_at,
      customer:customers ( id, full_name ),
      member:circle_members ( person_name, occasion_type )
    `)
    .order("created_at", { ascending: false })
    .limit(200);
  const tasks = (data || []) as unknown as WhatsAppTask[];

  return (
    <div className="admin-page max-w-6xl mx-auto">
      <div className="page-heading flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Personal reminders</p>
          <h1>WhatsApp Reminders</h1>
          <p className="text-creamSoft mt-2">Copy the prepared message, open the customer&apos;s chat, then mark the task as sent.</p>
        </div>
        <span>{tasks.filter((task) => task.status === "pending").length} waiting</span>
      </div>
      <WhatsAppTasks initialTasks={tasks} />
    </div>
  );
}
