"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export interface OrderCard {
  id: string;
  status: string;
  payment_status: string;
  total_amount_zar: number | null;
  amount_paid_zar: number | null;
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
  { key: "deposit_paid", label: "Confirmed" },
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

type PaymentEditor = {
  order: OrderCard;
  payment_status: string;
  total_amount_zar: string;
  amount_paid_zar: string;
};

export default function OrderBoard({ orders }: { orders: OrderCard[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [paymentFor, setPaymentFor] = useState<PaymentEditor | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [deleteFor, setDeleteFor] = useState<OrderCard | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const statusOf = (o: OrderCard) => optimistic[o.id] || o.status || "enquiry";

  async function move(id: string, new_status: string) {
    setMenuFor(null);
    const current = orders.find((o) => o.id === id);
    if (current && statusOf(current) === new_status) return;
    setOptimistic((m) => ({ ...m, [id]: new_status }));
    setBusy(id);
    try {
      const r = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: id, new_status }),
      });
      if (r.ok) router.refresh();
      else setOptimistic((m) => { const n = { ...m }; delete n[id]; return n; });
    } catch {
      setOptimistic((m) => { const n = { ...m }; delete n[id]; return n; });
    } finally {
      setBusy(null);
    }
  }

  function openPayment(order: OrderCard, payment_status: string) {
    setPaymentError("");
    setPaymentFor({
      order,
      payment_status,
      total_amount_zar: order.total_amount_zar != null ? String(order.total_amount_zar) : "",
      amount_paid_zar: order.amount_paid_zar ? String(order.amount_paid_zar) : "",
    });
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentFor) return;
    const { order, payment_status, total_amount_zar, amount_paid_zar } = paymentFor;
    setPaymentError("");
    setBusy(order.id);
    try {
      const r = await fetch("/api/orders/payment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, payment_status, total_amount_zar: total_amount_zar || null, amount_paid_zar: amount_paid_zar || null }),
      });
      if (r.ok) {
        setPaymentFor(null);
        router.refresh();
      } else {
        const result = await r.json().catch(() => ({}));
        setPaymentError(result.error || "The payment update could not be saved.");
      }
    } catch {
      setPaymentError("The payment update could not be saved.");
    } finally { setBusy(null); }
  }

  async function removeProspect() {
    if (!deleteFor) return;
    setDeleteError("");
    setBusy(deleteFor.id);
    try {
      const r = await fetch("/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: deleteFor.id }),
      });
      if (!r.ok) {
        const result = await r.json().catch(() => ({}));
        setDeleteError(result.error || "The prospect could not be removed.");
        return;
      }
      const removedId = deleteFor.id;
      setDeleteFor(null);
      setRemoving(removedId);
      window.setTimeout(() => router.refresh(), 280);
    } catch {
      setDeleteError("The prospect could not be removed.");
    } finally { setBusy(null); }
  }

  const byStage = (k: string) => orders.filter((o) => statusOf(o) === k);

  return (
    <>
      <div className="order-board flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {STAGES.map((stage) => {
        const cards = byStage(stage.key);
        const isOver = overStage === stage.key;
        return (
          <div
            key={stage.key}
            className="shrink-0 w-[300px]"
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverStage(stage.key); } }}
            onDragLeave={() => setOverStage((s) => (s === stage.key ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) move(dragId, stage.key);
              setDragId(null); setOverStage(null);
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-serif text-cream text-lg">{stage.label}</h2>
              <span className="text-xs text-muted bg-ink3 rounded-full px-2 py-0.5">{cards.length}</span>
            </div>
            <div className={`space-y-3 min-h-[120px] rounded-2xl transition-colors duration-200 ${isOver ? "ring-1 ring-gold/60 bg-gold/[0.04]" : ""}`}>
              {cards.length === 0 && (
                <div className={`rounded-xl border border-dashed p-4 text-center text-xs transition-colors ${isOver ? "border-gold/60 text-gold" : "border-line/60 text-muted"}`}>
                  {isOver ? "Drop to move here" : "Nothing here yet."}
                </div>
              )}
              {cards.map((o) => {
                const cd = countdown(o.days_until);
                const isOpen = open === o.id;
                const dragging = dragId === o.id;
                return (
                  <article
                    key={o.id}
                    draggable
                    onDragStart={(e) => { setDragId(o.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    className={`group rounded-xl border bg-ink2 overflow-visible transition-all duration-300 ease-cinematic cursor-grab active:cursor-grabbing ${
                      dragging ? "opacity-40 border-gold" : "border-line hover:border-gold/60"
                    } ${busy === o.id ? "animate-pulse" : ""} ${removing === o.id ? "opacity-0 -translate-y-2 scale-[0.98] pointer-events-none" : ""}`}
                  >
                    <button onClick={() => setOpen(isOpen ? null : o.id)} className="w-full text-left p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-serif text-cream leading-tight">{o.customer_name}</p>
                        {cd && <span className={`text-[11px] whitespace-nowrap ${cd.tone}`}>{cd.text}</span>}
                      </div>
                      <p className="text-sm text-gold mt-1">{o.celebration}</p>
                      <p className="text-[11px] text-creamSoft mt-1">Payment: {o.payment_status.replaceAll("_", " ")}</p>
                      {o.occasion_date && <p className="text-[11px] text-muted mt-1">{o.occasion_date}</p>}
                      {o.photos.length > 0 && (
                        <div className="flex gap-1.5 mt-3">
                          {o.photos.slice(0, 4).map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p} alt="" className="w-10 h-10 rounded object-cover border border-line" />
                          ))}
                        </div>
                      )}
                    </button>

                    <div className="grid transition-all duration-500 ease-cinematic" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-2 text-sm border-t border-line/50 pt-3">
                          <a href={`mailto:${o.customer_email}`} className="block text-creamSoft hover:text-gold break-all">{o.customer_email}</a>
                          {o.customer_phone && (
                            <a href={`https://wa.me/${o.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="block text-creamSoft hover:text-gold">{o.customer_phone}</a>
                          )}
                          {o.number_of_people && <p className="text-creamSoft"><span className="text-muted">Serves:</span> {o.number_of_people}</p>}
                          {o.cake_description && <p className="text-creamSoft whitespace-pre-line"><span className="text-muted">Notes:</span> {o.cake_description}</p>}
                          {o.colours_and_themes && <p className="text-creamSoft"><span className="text-muted">Theme:</span> {o.colours_and_themes}</p>}
                          {(o.total_amount_zar != null || o.amount_paid_zar != null) && <p className="text-creamSoft"><span className="text-muted">Payment:</span> R {Number(o.amount_paid_zar || 0).toFixed(2)} paid{o.total_amount_zar != null ? ` of R ${Number(o.total_amount_zar).toFixed(2)}` : ""}</p>}
                          {o.photos.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {o.photos.map((p, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <a key={i} href={p} target="_blank" rel="noreferrer"><img src={p} alt="" className="w-16 h-16 rounded object-cover border border-line hover:border-gold" /></a>
                              ))}
                            </div>
                          )}

                          {/* Cinematic stage selector (chips) */}
                          {isOpen && (
                            <div className="pt-2">
                              <label className="text-[11px] text-muted block mb-2">Payment status</label>
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {[['unpaid','Unpaid'],['deposit_paid','Deposit paid'],['paid_in_full','Paid in full']].map(([key,label]) => <button key={key} onClick={() => openPayment(o, key)} className={`px-2.5 py-1.5 rounded-full text-[11px] border ${o.payment_status === key ? "bg-gold text-ink border-gold" : "border-line text-creamSoft"}`}>{label}</button>)}
                              </div>
                              <label className="text-[11px] text-muted block mb-2">Move to, or drag the card</label>
                              <div className="flex flex-wrap gap-1.5">
                                {STAGES.map((s, i) => {
                                  const on = statusOf(o) === s.key;
                                  return (
                                    <button
                                      key={s.key}
                                      disabled={busy === o.id}
                                      onClick={() => move(o.id, s.key)}
                                      style={{ animationDelay: `${i * 40}ms` }}
                                      className={`omenu__item inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] border transition-colors duration-200 ${
                                        on ? "bg-gold text-ink border-gold" : "border-line text-creamSoft hover:border-gold/60 hover:text-cream"
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-ink" : "bg-creamSoft/40"}`} />
                                      {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {statusOf(o) === "enquiry" && (
                                <button
                                  type="button"
                                  disabled={busy === o.id}
                                  onClick={() => { setDeleteError(""); setDeleteFor(o); }}
                                  className="mt-4 text-[11px] text-rose hover:text-rose/80 underline underline-offset-4 disabled:opacity-50"
                                >
                                  Remove prospect
                                </button>
                              )}
                            </div>
                          )}
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

      {paymentFor && (
        <div className="order-modal" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
          <button type="button" className="order-modal__scrim" aria-label="Close payment editor" onClick={() => !busy && setPaymentFor(null)} />
          <form className="order-modal__panel" onSubmit={savePayment}>
            <div className="order-modal__eyebrow">Payment update</div>
            <h2 id="payment-dialog-title">Record a payment</h2>
            <p className="order-modal__lede">{paymentFor.order.customer_name} · {paymentFor.order.celebration}</p>
            <fieldset className="order-modal__statuses">
              <legend>Payment status</legend>
              {[['unpaid', 'Unpaid'], ['deposit_paid', 'Deposit paid'], ['paid_in_full', 'Paid in full']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentFor((current) => current ? { ...current, payment_status: key } : current)}
                  className={paymentFor.payment_status === key ? "is-selected" : ""}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <label className="order-modal__field">
              <span>Total order amount</span>
              <div><b>R</b><input type="number" min="0" step="0.01" inputMode="decimal" value={paymentFor.total_amount_zar} onChange={(event) => setPaymentFor((current) => current ? { ...current, total_amount_zar: event.target.value } : current)} placeholder="0.00" /></div>
            </label>
            <label className="order-modal__field">
              <span>Amount paid</span>
              <div><b>R</b><input type="number" min="0" step="0.01" inputMode="decimal" value={paymentFor.amount_paid_zar} onChange={(event) => setPaymentFor((current) => current ? { ...current, amount_paid_zar: event.target.value } : current)} placeholder="0.00" /></div>
            </label>
            {paymentError && <p className="order-modal__error" role="alert">{paymentError}</p>}
            <div className="order-modal__actions">
              <button type="button" className="order-modal__cancel" disabled={busy === paymentFor.order.id} onClick={() => setPaymentFor(null)}>Cancel</button>
              <button type="submit" className="order-modal__submit" disabled={busy === paymentFor.order.id}>{busy === paymentFor.order.id ? "Saving..." : "Save payment"}</button>
            </div>
          </form>
        </div>
      )}

      {deleteFor && (
        <div className="order-modal" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <button type="button" className="order-modal__scrim" aria-label="Close removal confirmation" onClick={() => !busy && setDeleteFor(null)} />
          <div className="order-modal__panel order-modal__panel--danger">
            <div className="order-modal__eyebrow">Remove new enquiry</div>
            <h2 id="delete-dialog-title">Are you sure?</h2>
            <p className="order-modal__lede">This removes {deleteFor.customer_name}&apos;s new enquiry from the Order Board. Their customer record and any other saved occasions will stay untouched.</p>
            {deleteError && <p className="order-modal__error" role="alert">{deleteError}</p>}
            <div className="order-modal__actions">
              <button type="button" className="order-modal__cancel" disabled={busy === deleteFor.id} onClick={() => setDeleteFor(null)}>Keep prospect</button>
              <button type="button" className="order-modal__submit order-modal__submit--danger" disabled={busy === deleteFor.id} onClick={removeProspect}>{busy === deleteFor.id ? "Removing..." : "Remove prospect"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
