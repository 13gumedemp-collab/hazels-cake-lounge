import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { daysUntil, nextOccurrence } from "@/lib/occasions";
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Live dashboard figures, fetched client-side with a cache-busting query so no
// service worker or router cache can ever serve a stale copy.
export async function GET() {
  if (!(await verifySession(cookies().get(COOKIE)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const todayIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

  const [ordersRes, membersRes, waRes, notesRes] = await Promise.all([
    sb.from("orders").select("status, created_at"),
    sb.from("circle_members").select("person_name, occasion_type, occasion_date, recurring_yearly, customer:customers(full_name)"),
    sb.from("whatsapp_reminders_due").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("notifications").select("message, priority, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const orders = ordersRes.data ?? [];
  const activeOrders = orders.filter((o) => o.status !== "completed").length;
  const enquiriesToday = orders.filter((o) => o.status === "enquiry" && (o.created_at || "").slice(0, 10) === todayIso).length;

  const recurring = (membersRes.data ?? []).filter((m) => m.recurring_yearly);
  const occ30 = recurring.filter((m) => daysUntil(m.occasion_date) <= 30).length;
  const week = recurring
    .map((m) => ({
      person_name: m.person_name,
      occasion_type: m.occasion_type,
      customer: (m.customer as any)?.full_name ?? "",
      d: daysUntil(m.occasion_date),
      next: nextOccurrence(m.occasion_date).toISOString().slice(0, 10),
    }))
    .filter((m) => m.d <= 7)
    .sort((a, b) => a.d - b.d);
  const occ7 = week.length;

  return NextResponse.json({
    counts: { activeOrders, enquiriesToday, occasions: occ7, orders: activeOrders, whatsapp: waRes.count ?? 0, occ30 },
    week,
    recent: notesRes.data ?? [],
  });
}
