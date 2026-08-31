"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

export interface MessageLog {
  id: string;
  customer_id: string | null;
  circle_member_id: string | null;
  reminder_type: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  customer: { id: string; full_name: string; email: string } | null;
  member: { id: string; person_name: string; occasion_type: string } | null;
}

interface Choice { id: string; label: string; customer_id?: string; subject?: string | null }
type StatusFilter = "all" | "sent" | "failed" | "skipped";

function when(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });
}

export default function MessageCentre({ logs, customers, members, templates }: {
  logs: MessageLog[];
  customers: Choice[];
  members: Choice[];
  templates: Choice[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      const statusMatches = filter === "all" || log.status === filter;
      const queryMatches = !needle || [log.customer?.full_name, log.customer?.email, log.member?.person_name, log.reminder_type, log.error_message]
        .some((value) => String(value || "").toLowerCase().includes(needle));
      return statusMatches && queryMatches;
    });
  }, [filter, logs, query]);
  const customerMembers = members.filter((member) => member.customer_id === customerId);

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setNotice("");
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok || result.status === "failed") {
      setNotice(result.error || "The email could not be sent.");
      return false;
    }
    setNotice(result.status === "skipped" ? "The customer has opted out, so the email was skipped." : "Email sent and added to the delivery log.");
    router.refresh();
    return true;
  }

  async function manualSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await send({
      customer_id: form.get("customer_id"),
      circle_member_id: form.get("circle_member_id") || null,
      template_name: form.get("template_name"),
    }, "manual");
    if (ok) setComposerOpen(false);
  }

  return (
    <>
      <div className="message-toolbar mt-6">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, address, occasion or error" />
        <div className="message-filters">
          {(["all", "sent", "failed", "skipped"] as StatusFilter[]).map((value) => (
            <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value}</button>
          ))}
        </div>
        <button type="button" className="message-compose-button" onClick={() => setComposerOpen(!composerOpen)}>{composerOpen ? "Close composer" : "Send an email"}</button>
      </div>

      {composerOpen && (
        <form className="message-composer surface-card" onSubmit={manualSend}>
          <div><p className="eyebrow">Manual send</p><h2>Send a template</h2><p>Choose the customer and the message. An occasion is optional but gives reminder templates the right names and date.</p></div>
          <label><span>Customer</span><select name="customer_id" required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.label}</option>)}</select></label>
          <label><span>Occasion</span><select name="circle_member_id" defaultValue=""><option value="">No occasion</option>{customerMembers.map((member) => <option value={member.id} key={member.id}>{member.label}</option>)}</select></label>
          <label><span>Template</span><select name="template_name" required defaultValue=""><option value="" disabled>Choose a template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.label}{template.subject ? `: ${template.subject}` : ""}</option>)}</select></label>
          <button type="submit" disabled={busy === "manual"}>{busy === "manual" ? "Sending..." : "Send email now"}</button>
        </form>
      )}

      {notice && <p className="message-notice" role="status">{notice}</p>}

      <div className="message-log surface-card mt-5">
        <div className="message-log__head"><span>Delivery</span><span>Customer</span><span>Message</span><span>Sent</span><span /></div>
        {visible.length === 0 ? <p className="message-log__empty">No messages match those filters.</p> : visible.map((log) => (
          <article key={log.id} className={`message-log__row is-${log.status}`}>
            <span className="message-status">{log.status}</span>
            <span>{log.customer?.id ? <Link href={`/customers/${log.customer.id}`}><strong>{log.customer.full_name}</strong><small>{log.customer.email}</small></Link> : <small>Customer removed</small>}</span>
            <span><strong>{String(log.reminder_type || "Email").replaceAll("_", " ")}</strong><small>{log.member ? `${log.member.person_name}'s ${log.member.occasion_type}` : "General message"}</small>{log.error_message && <em>{log.error_message}</em>}</span>
            <time>{when(log.sent_at)}</time>
            <span>{log.status === "failed" && log.customer_id && <button type="button" disabled={busy === log.id} onClick={() => send({ customer_id: log.customer_id, circle_member_id: log.circle_member_id, reminder_type: log.reminder_type }, log.id)}>{busy === log.id ? "Retrying..." : "Retry"}</button>}</span>
          </article>
        ))}
      </div>
    </>
  );
}
