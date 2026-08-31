"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type PipelineStatus = "scheduled" | "sent" | "skipped" | "attention";
export interface PipelineRow {
  key: string;
  customer_id: string;
  circle_member_id: string;
  customer_name: string;
  person_name: string;
  occasion_type: string;
  occurrence_date: string;
  reminder_type: string;
  due_date: string;
  status: PipelineStatus;
  detail: string;
}

type Filter = "all" | PipelineStatus;
const pretty = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function ReminderPipeline({ rows }: { rows: PipelineRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => rows.filter((row) => filter === "all" || row.status === filter), [filter, rows]);

  async function runDailyCheck() {
    setBusy("daily"); setNotice("");
    const response = await fetch("/api/reminders/run", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) { setNotice(result.error || "The daily check could not run."); return; }
    setNotice(`Daily check complete. ${result.emails || 0} emails, ${result.waTasks || 0} WhatsApp tasks and ${result.callTasks || 0} call tasks created.`);
    router.refresh();
  }

  async function sendNow(row: PipelineRow) {
    setBusy(row.key); setNotice("");
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: row.customer_id, circle_member_id: row.circle_member_id, reminder_type: row.reminder_type }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok || result.status === "failed") { setNotice(result.error || "The reminder could not be sent."); return; }
    setNotice(result.status === "skipped" ? "The customer has opted out, so the reminder was skipped." : "Reminder sent and added to the delivery log.");
    router.refresh();
  }

  return (
    <>
      <div className="pipeline-summary mt-6">
        {([
          ["scheduled", "Scheduled"], ["sent", "Sent"], ["attention", "Needs attention"], ["skipped", "Skipped"],
        ] as [PipelineStatus, string][]).map(([status, label]) => (
          <button type="button" key={status} className={filter === status ? "is-active" : ""} onClick={() => setFilter(filter === status ? "all" : status)}>
            <span>{label}</span><strong>{rows.filter((row) => row.status === status).length}</strong>
          </button>
        ))}
        <button type="button" className="pipeline-run" disabled={busy === "daily"} onClick={runDailyCheck}>{busy === "daily" ? "Running..." : "Run daily check"}</button>
      </div>
      {notice && <p className="message-notice" role="status">{notice}</p>}
      <div className="pipeline-table surface-card mt-5">
        <div className="pipeline-table__head"><span>Status</span><span>Reminder</span><span>Customer</span><span>Send date</span><span>Occasion</span><span /></div>
        {visible.length === 0 ? <p className="pipeline-table__empty">No reminders match this view.</p> : visible.map((row) => (
          <article className={`pipeline-table__row is-${row.status}`} key={row.key}>
            <span className="pipeline-status">{row.status === "attention" ? "Needs attention" : row.status}</span>
            <span><strong>{row.reminder_type.replaceAll("_", " ")}</strong><small>{row.detail}</small></span>
            <span><Link href={`/customers/${row.customer_id}`}><strong>{row.customer_name}</strong><small>{row.person_name}&apos;s {row.occasion_type}</small></Link></span>
            <time>{pretty(row.due_date)}</time>
            <time>{pretty(row.occurrence_date)}</time>
            <span>{row.status === "attention" && <button type="button" disabled={busy === row.key} onClick={() => sendNow(row)}>{busy === row.key ? "Sending..." : row.detail === "Delivery failed" ? "Retry" : "Send now"}</button>}</span>
          </article>
        ))}
      </div>
    </>
  );
}
