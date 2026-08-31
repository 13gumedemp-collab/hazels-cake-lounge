import ReminderPipeline, { PipelineRow, PipelineStatus } from "@/components/ReminderPipeline";
import { nextOccurrence, sastToday } from "@/lib/occasions";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const REMINDERS = [
  { type: "one_month", days: 30 },
  { type: "two_weeks", days: 14 },
  { type: "one_week", days: 7 },
];

function iso(date: Date) { return date.toISOString().slice(0, 10); }

export default async function RemindersPage() {
  const sb = supabaseAdmin();
  const todayDate = sastToday();
  const today = iso(todayDate);
  const [{ data: members }, { data: logs }] = await Promise.all([
    sb.from("circle_members").select(`
      id, person_name, occasion_type, occasion_date, recurring_yearly, is_one_time,
      customer:customers ( id, full_name )
    `),
    sb.from("reminder_log").select("circle_member_id, reminder_type, status, error_message, year_sent, sent_at").order("sent_at", { ascending: false }),
  ]);

  const rows: PipelineRow[] = [];
  for (const member of members || []) {
    const customer = member.customer as unknown as { id: string; full_name: string } | null;
    if (!customer) continue;
    const occurrence = member.recurring_yearly ? nextOccurrence(member.occasion_date, todayDate) : new Date(`${member.occasion_date}T00:00:00Z`);
    const occurrenceDate = iso(occurrence);
    if (!member.recurring_yearly && occurrenceDate < today) continue;

    for (const reminder of REMINDERS) {
      const dueDate = iso(new Date(occurrence.getTime() - reminder.days * DAY));
      const match = (logs || []).find((log) => log.circle_member_id === member.id
        && log.reminder_type === reminder.type
        && log.year_sent === Number(dueDate.slice(0, 4)));
      let status: PipelineStatus = "scheduled";
      let detail = `Due ${reminder.days} days before`;
      if (match?.status === "sent" || match?.status === "manually_sent") { status = "sent"; detail = "Delivered"; }
      else if (match?.status === "skipped") { status = "skipped"; detail = match.error_message || "Customer opted out"; }
      else if (match?.status === "failed") { status = "attention"; detail = "Delivery failed"; }
      else if (dueDate < today) { status = "attention"; detail = "Send date has passed"; }
      rows.push({
        key: `${member.id}-${reminder.type}-${occurrence.getUTCFullYear()}`,
        customer_id: customer.id,
        circle_member_id: member.id,
        customer_name: customer.full_name,
        person_name: member.person_name,
        occasion_type: member.occasion_type,
        occurrence_date: occurrenceDate,
        reminder_type: reminder.type,
        due_date: dueDate,
        status,
        detail,
      });
    }
  }
  rows.sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="admin-page max-w-[1500px] mx-auto">
      <div className="page-heading flex items-end justify-between gap-4 flex-wrap">
        <div><p className="eyebrow">Delivery plan</p><h1>Reminder Pipeline</h1><p className="text-creamSoft mt-2">Every one month, two week and one week reminder, from scheduled through delivery.</p></div>
        <span>{rows.filter((row) => row.status === "attention").length} need attention</span>
      </div>
      <ReminderPipeline rows={rows} />
    </div>
  );
}
