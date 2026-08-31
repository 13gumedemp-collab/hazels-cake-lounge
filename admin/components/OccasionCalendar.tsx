"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface OccasionEvent {
  id: string;
  person_name: string;
  occasion_type: string;
  occasion_date: string;
  next_date: string;
  recurring_yearly: boolean;
  is_one_time: boolean;
  relationship_to_customer: string | null;
  notes: string | null;
  colour: string;
  customer: { id: string; full_name: string; email: string; whatsapp_number: string | null };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pretty(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function OccasionCalendar({ events, today }: { events: OccasionEvent[]; today: string }) {
  const current = new Date(`${today}T00:00:00Z`);
  const [month, setMonth] = useState(() => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const selected = events.find((event) => event.id === selectedId) || null;
  const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((event) => event.next_date.startsWith(monthKey));
  const firstWeekday = (month.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  while (cells.length % 7) cells.push(null);

  const agenda = useMemo(() => events
    .filter((event) => showPast || event.next_date >= today)
    .sort((a, b) => a.next_date.localeCompare(b.next_date)), [events, showPast, today]);

  const move = (by: number) => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + by, 1)));
  const reset = () => setMonth(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)));

  return (
    <div className="occasion-workspace mt-6">
      <section className="occasion-calendar surface-card">
        <div className="occasion-calendar__toolbar">
          <div>
            <p className="eyebrow">Calendar</p>
            <h2>{month.toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
          </div>
          <div>
            <button type="button" onClick={() => move(-1)} aria-label="Previous month">‹</button>
            <button type="button" onClick={reset}>Today</button>
            <button type="button" onClick={() => move(1)} aria-label="Next month">›</button>
          </div>
        </div>
        <div className="occasion-calendar__weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="occasion-calendar__grid">
          {cells.map((day, index) => {
            if (!day) return <div className="is-empty" key={`empty-${index}`} />;
            const date = isoDate(month.getUTCFullYear(), month.getUTCMonth(), day);
            const onDay = monthEvents.filter((event) => event.next_date === date);
            return (
              <div className={date === today ? "is-today" : ""} key={date}>
                <time>{day}</time>
                <div className="occasion-calendar__events">
                  {onDay.map((event) => (
                    <button type="button" key={event.id} style={{ "--event-colour": event.colour } as React.CSSProperties} onClick={() => setSelectedId(event.id)}>
                      <span>{event.person_name}</span>
                      <small>{event.occasion_type}</small>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className={`occasion-detail surface-card ${selected ? "is-open" : ""}`}>
        {selected ? (
          <>
            <button type="button" className="occasion-detail__close" onClick={() => setSelectedId(null)} aria-label="Close details">×</button>
            <span className="occasion-detail__accent" style={{ background: selected.colour }} />
            <p className="eyebrow">{selected.relationship_to_customer || "Someone special"}</p>
            <h2>{selected.person_name}</h2>
            <p className="occasion-detail__date">{selected.occasion_type} on {pretty(selected.next_date)}</p>
            <dl>
              <div><dt>Customer</dt><dd><Link href={`/customers/${selected.customer.id}`}>{selected.customer.full_name}</Link></dd></div>
              <div><dt>Email</dt><dd>{selected.customer.email}</dd></div>
              <div><dt>Phone</dt><dd>{selected.customer.whatsapp_number || "Not supplied"}</dd></div>
              <div><dt>Repeats</dt><dd>{selected.recurring_yearly ? "Every year" : "One time"}</dd></div>
            </dl>
            {selected.notes && <div className="occasion-detail__notes"><span>Notes</span><p>{selected.notes}</p></div>}
          </>
        ) : (
          <div className="occasion-detail__empty"><span>Pick an occasion</span><p>Select a date card to see the customer, contact details and notes.</p></div>
        )}
      </aside>

      <section className="occasion-agenda surface-card">
        <div className="occasion-agenda__heading">
          <div><p className="eyebrow">Agenda</p><h2>{showPast ? "All saved dates" : "Upcoming dates"}</h2></div>
          <button type="button" onClick={() => setShowPast(!showPast)}>{showPast ? "Hide past dates" : "Show past dates"}</button>
        </div>
        <div className="occasion-agenda__list">
          {agenda.length === 0 ? <p className="occasion-agenda__empty">No dates to show.</p> : agenda.map((event) => (
            <button type="button" key={event.id} onClick={() => setSelectedId(event.id)}>
              <span className="occasion-agenda__dot" style={{ background: event.colour }} />
              <time><strong>{new Date(`${event.next_date}T00:00:00Z`).getUTCDate()}</strong>{new Date(`${event.next_date}T00:00:00Z`).toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" })}</time>
              <span><strong>{event.person_name}</strong><small>{event.occasion_type} for {event.customer.full_name}</small></span>
              <em>{event.recurring_yearly ? "Yearly" : "One time"}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
