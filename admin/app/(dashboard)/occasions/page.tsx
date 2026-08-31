import OccasionCalendar, { OccasionEvent } from "@/components/OccasionCalendar";
import { nextOccurrence, OCCASION_COLOURS, sastToday } from "@/lib/occasions";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function OccasionsPage() {
  const { data } = await supabaseAdmin()
    .from("circle_members")
    .select(`
      id, person_name, occasion_type, occasion_date, recurring_yearly, is_one_time, relationship_to_customer, notes,
      customer:customers ( id, full_name, email, whatsapp_number )
    `)
    .order("occasion_date");

  const events: OccasionEvent[] = (data || []).map((row: any) => ({
    id: row.id,
    person_name: row.person_name,
    occasion_type: row.occasion_type,
    occasion_date: row.occasion_date,
    next_date: row.recurring_yearly
      ? nextOccurrence(row.occasion_date).toISOString().slice(0, 10)
      : row.occasion_date,
    recurring_yearly: row.recurring_yearly,
    is_one_time: row.is_one_time,
    relationship_to_customer: row.relationship_to_customer,
    notes: row.notes,
    colour: OCCASION_COLOURS[row.occasion_type] || OCCASION_COLOURS.Other,
    customer: row.customer,
  }));
  const today = sastToday().toISOString().slice(0, 10);

  return (
    <div className="admin-page max-w-[1500px] mx-auto">
      <div className="page-heading flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Every date in view</p>
          <h1>Occasions Calendar</h1>
          <p className="text-creamSoft mt-2">Recurring celebrations and one time dates, colour coded and connected to each customer.</p>
        </div>
        <span>{events.length} saved date{events.length === 1 ? "" : "s"}</span>
      </div>
      <OccasionCalendar events={events} today={today} />
    </div>
  );
}
