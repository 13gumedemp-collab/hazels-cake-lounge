import Shell from "@/components/Shell";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { daysUntil } from "@/lib/occasions";

export const dynamic = "force-dynamic";

async function getCounts() {
  const sb = supabaseAdmin();
  const [waRes, ordersRes, membersRes] = await Promise.all([
    sb.from("whatsapp_reminders_due").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("orders").select("id", { count: "exact", head: true }).neq("status", "completed"),
    sb.from("circle_members").select("occasion_date, recurring_yearly"),
  ]);
  const occasions7 = (membersRes.data ?? []).filter(
    (m) => m.recurring_yearly && daysUntil(m.occasion_date) <= 7,
  ).length;
  return {
    whatsapp: waRes.count ?? 0,
    orders: ordersRes.count ?? 0,
    occasions: occasions7,
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const counts = await getCounts();
  return <Shell counts={counts}>{children}</Shell>;
}
