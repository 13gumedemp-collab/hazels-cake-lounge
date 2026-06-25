"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { prettyDate } from "@/lib/occasions";

function greeting() {
  const h = new Date(Date.now() + 2 * 3600 * 1000).getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Stats {
  counts: { activeOrders: number; enquiriesToday: number; occ30: number; whatsapp: number };
  week: { person_name: string; occasion_type: string; customer: string; d: number; next: string }[];
  recent: { message: string; priority: string; created_at: string }[];
}

export default function Overview() {
  const [data, setData] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/stats?ts=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const c = data?.counts;
  const week = data?.week ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-serif text-3xl md:text-4xl text-cream">{greeting()}, Hazel.</h1>
      <p className="text-creamSoft mt-1">Here is your day at a glance.</p>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <StatCard label="New enquiries today" value={c?.enquiriesToday ?? 0} icon="mail" href="/orders" accent delay={0} />
        <StatCard label="Occasions in 30 days" value={c?.occ30 ?? 0} icon="calendar" href="/occasions" delay={80} />
        <StatCard label="Active orders" value={c?.activeOrders ?? 0} icon="kanban" href="/orders" delay={160} />
        <StatCard label="WhatsApp pending" value={c?.whatsapp ?? 0} icon="whatsapp" href="/whatsapp" delay={240} />
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mt-8">
        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <h2 className="font-serif text-xl text-cream mb-4">This week&apos;s occasions</h2>
          {week.length === 0 && <p className="text-muted text-sm">Nothing in the next 7 days.</p>}
          <ul className="space-y-3">
            {week.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-cream text-sm">{m.person_name}&apos;s {m.occasion_type}</p>
                  <p className="text-muted text-xs">{m.customer} &middot; {prettyDate(m.next)}</p>
                </div>
                <span className="text-gold text-xs whitespace-nowrap">{m.d === 0 ? "Today" : `in ${m.d} day${m.d > 1 ? "s" : ""}`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <h2 className="font-serif text-xl text-cream mb-4">Recent activity</h2>
          {recent.length === 0 && <p className="text-muted text-sm">No activity yet.</p>}
          <ul className="space-y-3">
            {recent.map((n, i) => (
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
