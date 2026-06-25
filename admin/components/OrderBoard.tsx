"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface OrderCard {
  id: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  celebration: string;
  occasion_date: string | null;
  days_until: number | null;
  cake_description: string | null;
  number_of_people: string | null;
  colours_and_themes: string | null;
  photos: string[];
  created_at: string;
}

const STAGES: { key: string; label: string }[] = [
  { key: "enquiry", label: "New enquiries" },
  { key: "quoted", label: "Quoted" },
  { key: "deposit_paid", label: "Deposit paid" },
  { key: "baking", label: "Baking" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
];

function countdown(days: number | null) {
  if (days == null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: "text-rose" };
  if (days === 0) return { text: "Today", tone: "text-goldBright" };
  if (days === 1) return { text: "Tomorrow", tone: "text-goldBright" };
  return { text: `in ${days} days`, tone: days <= 7 ? "text-goldBright" : "text-creamSoft" };
}

export default function OrderBoard({ orders }: { orders: OrderCard[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function move(id: string, new_status: string) {
    setBusy(id);
    try {
      const r = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: id, new_status }),
      });
      if (r.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const byStage = (k: string) => orders.filter((o) => (o.status || "enquiry") === k);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {STAGES.map((stage) => {
        const cards = byStage(stage.key);
        return (
          <div key={stage.key} className="shrink-0 w-[300px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-serif text-cream text-lg">{stage.label}</h2>
              <span className="text-xs text-muted bg-ink3 rounded-full px-2 py-0.5">{cards.length}</span>
            </div>
            <div className="space-y-3 min-h-[40px]">
              {cards.length === 0 && (
                <div className="rounded-xl border border-dashed border-line/60 p-4 text-center text-xs text-muted">
                  Nothing here yet.
                </div>
              )}
              {cards.map((o) => {
                const cd = countdown(o.days_until);
                const isOpen = open === o.id;
                return (
                  <article
                    key={o.id}
                    className="rounded-xl border border-line bg-ink2 overflow-hidden transition-all duration-500 ease-cinematic hover:border-gold/60"
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : o.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-serif text-cream leading-tight">{o.customer_name}</p>
                        {cd && <span className={`text-[11px] whitespace-nowrap ${cd.tone}`}>{cd.text}</span>}
                      </div>
                      <p className="text-sm text-gold mt-1">{o.celebration}</p>
                      {o.occasion_date && (
                        <p className="text-[11px] text-muted mt-1">{o.occasion_date}</p>
                      )}
                      {o.photos.length > 0 && (
                        <div className="flex gap-1.5 mt-3">
                          {o.photos.slice(0, 4).map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p} alt="" className="w-10 h-10 rounded object-cover border border-line" />
                          ))}
                        </div>
                      )}
                    </button>

                    <div
                      className="grid transition-all duration-500 ease-cinematic"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-2 text-sm border-t border-line/50 pt-3">
                          <a href={`mailto:${o.customer_email}`} className="block text-creamSoft hover:text-gold break-all">{o.customer_email}</a>
                          {o.customer_phone && (
                            <a href={`https://wa.me/${o.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="block text-creamSoft hover:text-gold">{o.customer_phone}</a>
                          )}
                          {o.number_of_people && <p className="text-creamSoft"><span className="text-muted">Serves:</span> {o.number_of_people}</p>}
                          {o.cake_description && <p className="text-creamSoft whitespace-pre-line"><span className="text-muted">Notes:</span> {o.cake_description}</p>}
                          {o.colours_and_themes && <p className="text-creamSoft"><span className="text-muted">Theme:</span> {o.colours_and_themes}</p>}
                          {o.photos.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {o.photos.map((p, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <a key={i} href={p} target="_blank" rel="noreferrer">
                                  <img src={p} alt="" className="w-16 h-16 rounded object-cover border border-line hover:border-gold" />
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="pt-2">
                            <label className="text-[11px] text-muted block mb-1">Move to</label>
                            <select
                              disabled={busy === o.id}
                              defaultValue={o.status}
                              onChange={(e) => move(o.id, e.target.value)}
                              className="w-full bg-ink3 border border-line rounded-lg px-3 py-2 text-sm text-cream focus:border-gold outline-none"
                            >
                              {STAGES.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
