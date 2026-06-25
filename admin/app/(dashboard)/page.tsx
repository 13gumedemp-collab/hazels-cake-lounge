import Link from "next/link";
import StatCard from "@/components/StatCard";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { daysUntil, nextOccurrence, prettyDate, sastToday } from "@/lib/occasions";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date(Date.now() + 2 * 3600 * 1000).getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function Overview() {
  const sb = supabaseAdmin();
  const todayIso = sastToday().toISOString().slice(0, 10);

  const [customers, orders, members, waPending, notes] = await Promise.all([
    sb.from("customers").select("id", { count: "exact", head: true }),
    sb.from("orders").select("status, created_at"),
    sb.from("circle_members").select("person_name, occasion_type, occasion_date, recurring_yearly, customer:customers(full_name)"),
    sb.from("whatsapp_reminders_due").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("notifications").select("message, priority, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const orderRows = orders.data ?? [];
  const activeOrders = orderRows.filter((o) => o.status !== "completed").length;
  const enquiriesToday = orderRows.filter((o) => o.status === "enquiry" && (o.created_at || "").slice(0, 10) === todayIso).length;
  const recurring = (members.data ?? []).filter((m) => m.recurring_yearly);
  const occ30 = recurring.filter((m) => daysUntil(m.occasion_date) <= 30).length;
  const week = recurring
    .map((m) => ({ ...m, d: daysUntil(m.occasion_date), next: nextOccurrence(m.occasion_date) }))
    .filter((m) => m.d <= 7)
    .sort((a, b) => a.d - b.d);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-serif text-3xl md:text-4xl text-cream">{greeting()}, Hazel.</h1>
      <p className="text-creamSoft mt-1">Here is your day at a glance.</p>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <StatCard label="New enquiries today" value={enquiriesToday} icon="mail" href="/orders" accent delay={0} />
        <StatCard label="Occasions in 30 days" value={occ30} icon="calendar" href="/occasions" delay={80} />
        <StatCard label="Active orders" value={activeOrders} icon="kanban" href="/orders" delay={160} />
        <StatCard label="WhatsApp pending" value={waPending.count ?? 0} icon="whatsapp" href="/whatsapp" delay={240} />
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mt-8">
        <section className="rounded-2xl border border-line bg-ink2/50 p-5">
          <h2 className="font-serif text-xl text-cream mb-4">This week&apos;s occasions</h2>
          {week.length === 0 && <p className="text-muted text-sm">Nothing in the next 7 days.</p>}
          <ul className="space-y-3">
            {week.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-cream text-sm">{m.person_name}&apos;s {m.occasion_type}</p>
                  <p className="text-muted text-xs">{(m.customer as any)?.full_name} &middot; {prettyDate(m.next)}</p>
                </div>
                <span className="text-gold text-xs whitespace-nowrap">{m.d === 0 ? "Today" : `in ${m.d} day${m.d > 1 ? "s" : ""}`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-ink2/50 p-5">
          <h2 className="font-serif text-xl text-cream mb-4">Recent activity</h2>
          {(notes.data ?? []).length === 0 && <p className="text-muted text-sm">No activity yet.</p>}
          <ul className="space-y-3">
            {(notes.data ?? []).map((n, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.priority === "high" ? "bg-rose" : "bg-gold"}`} />
                <p className="text-sm text-creamSoft leading-snug">{n.message}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-xl text-cream mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/customers", label: "View customers" },
            { href: "/orders", label: "Order board" },
            { href: "/whatsapp", label: "WhatsApp reminders" },
            { href: "/occasions", label: "Occasion calendar" },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className="rounded-full border border-gold/40 text-gold text-sm px-5 py-2.5 hover:bg-gold hover:text-ink transition">
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
