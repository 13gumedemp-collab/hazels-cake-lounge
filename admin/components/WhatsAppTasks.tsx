"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface WhatsAppTask {
  id: string;
  reminder_type: string;
  whatsapp_number: string | null;
  message_copy: string | null;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  customer: { id: string; full_name: string } | null;
  member: { person_name: string; occasion_type: string } | null;
}

function whatsappNumber(value: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

function pretty(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function WhatsAppTasks({ initialTasks }: { initialTasks: WhatsAppTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<"pending" | "completed">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const visible = useMemo(() => tasks.filter((task) => view === "pending" ? task.status === "pending" : task.status !== "pending"), [tasks, view]);

  async function copy(task: WhatsAppTask) {
    if (!task.message_copy) return;
    await navigator.clipboard.writeText(task.message_copy);
    setCopied(task.id);
    window.setTimeout(() => setCopied((current) => current === task.id ? null : current), 1600);
  }

  async function complete(id: string) {
    setBusy(id);
    const response = await fetch("/api/whatsapp/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setTasks((current) => current.map((task) => task.id === id
        ? { ...task, status: "completed", completed_at: new Date().toISOString() }
        : task));
    }
    setBusy(null);
  }

  return (
    <>
      <div className="task-tabs mt-6">
        <button type="button" className={view === "pending" ? "is-active" : ""} onClick={() => setView("pending")}>Pending ({tasks.filter((task) => task.status === "pending").length})</button>
        <button type="button" className={view === "completed" ? "is-active" : ""} onClick={() => setView("completed")}>Completed ({tasks.filter((task) => task.status !== "pending").length})</button>
      </div>
      {visible.length === 0 ? (
        <div className="surface-card surface-card--empty mt-5 p-10 text-center">
          <p className="text-creamSoft">{view === "pending" ? "No WhatsApp reminders are waiting." : "No completed WhatsApp reminders yet."}</p>
        </div>
      ) : (
        <div className="whatsapp-task-grid mt-5">
          {visible.map((task) => {
            const number = whatsappNumber(task.whatsapp_number);
            const text = encodeURIComponent(task.message_copy || "");
            return (
              <article className="whatsapp-task surface-card" key={task.id}>
                <header>
                  <div>
                    <p className="eyebrow">{String(task.reminder_type || "Reminder").replaceAll("_", " ")}</p>
                    <h2>{task.customer?.full_name || "Customer"}</h2>
                    <p>{task.member ? `${task.member.person_name}'s ${task.member.occasion_type}` : "Occasion reminder"}</p>
                  </div>
                  <time>{pretty(task.due_date)}</time>
                </header>
                <div className="whatsapp-task__message">{task.message_copy || "No message copy was saved for this task."}</div>
                <div className="whatsapp-task__meta">
                  {task.customer?.id && <Link href={`/customers/${task.customer.id}`}>Open customer</Link>}
                  <span>{task.whatsapp_number || "No phone number"}</span>
                </div>
                {view === "pending" && (
                  <div className="whatsapp-task__actions">
                    <button type="button" onClick={() => copy(task)}>{copied === task.id ? "Copied" : "Copy message"}</button>
                    {number && <a href={`https://wa.me/${number}?text=${text}`} target="_blank" rel="noreferrer">Open WhatsApp</a>}
                    <button type="button" className="is-primary" disabled={busy === task.id} onClick={() => complete(task.id)}>{busy === task.id ? "Saving..." : "Mark as sent"}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
