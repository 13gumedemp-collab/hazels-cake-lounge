import CallTasks from "@/components/CallTasks";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export default async function CallsPage() {
  const { data } = await supabaseAdmin().from("phone_call_reminders_due")
    .select("id,reminder_type,phone_number,due_date,status,customer:customers(full_name),member:circle_members(person_name,occasion_type)")
    .eq("status", "pending").order("due_date");
  return <div className="max-w-4xl mx-auto"><h1 className="font-serif text-4xl text-cream mb-2">Phone call reminders</h1><p className="text-creamSoft mb-6">Customers who asked Hazel to call before an occasion.</p><CallTasks tasks={(data || []) as any} /></div>;
}
