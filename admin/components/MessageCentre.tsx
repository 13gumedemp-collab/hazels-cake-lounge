"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export interface MessageLog {
  id: string;
  customer_id: string | null;
  circle_member_id: string | null;
  reminder_type: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  resend_email_id: string | null;
  email_thread_id: string | null;
  customer: { id: string; full_name: string; email: string } | null;
  member: { id: string; person_name: string; occasion_type: string } | null;
}

export interface EmailThread {
  id: string;
  customer_id: string | null;
  contact_email: string;
  contact_name: string | null;
  subject: string;
  status: "open" | "closed";
  unread_count: number;
  last_message_at: string;
  last_message_preview: string | null;
  customer: { id: string; full_name: string; email: string } | null;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_addresses: string[];
  subject: string;
  text_body: string;
  attachments: { id?: string; filename?: string; content_type?: string }[];
  status: string;
  status_detail: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
}

export interface EmailSuppression {
  email_address: string;
  reason: string;
  diagnostic_code: string | null;
  updated_at: string;
  customer: { id: string; full_name: string; email: string } | null;
}

interface Choice { id: string; label: string; customer_id?: string; subject?: string | null }
type CentreTab = "inbox" | "delivery" | "suppressed";

function when(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });
}

function statusName(value: string) {
  return value.replaceAll("_", " ");
}

export default function MessageCentre({ logs, threads, messages, suppressions, customers, members, templates }: {
  logs: MessageLog[];
  threads: EmailThread[];
  messages: EmailMessage[];
  suppressions: EmailSuppression[];
  customers: Choice[];
  members: Choice[];
  templates: Choice[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<CentreTab>("inbox");
  const [query, setQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState(threads[0]?.id || "");
  const [readThreads, setReadThreads] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("thread");
    if (requested && threads.some((thread) => thread.id === requested)) void chooseThread(requested);
    // This reads the initial deep link once. Later selection is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return threads.filter((thread) => !needle || [thread.contact_name, thread.contact_email, thread.subject, thread.last_message_preview]
      .some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [query, threads]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || visibleThreads[0] || null;
  const selectedMessages = selectedThread
    ? messages.filter((message) => message.thread_id === selectedThread.id)
    : [];
  const customerMembers = members.filter((member) => member.customer_id === customerId);
  const visibleLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      const statusMatches = deliveryFilter === "all" || log.status === deliveryFilter;
      const queryMatches = !needle || [log.customer?.full_name, log.customer?.email, log.member?.person_name, log.reminder_type, log.error_message]
        .some((value) => String(value || "").toLowerCase().includes(needle));
      return statusMatches && queryMatches;
    });
  }, [deliveryFilter, logs, query]);

  async function chooseThread(threadId: string) {
    setSelectedThreadId(threadId);
    setNotice("");
    const url = new URL(window.location.href);
    url.searchParams.set("thread", threadId);
    window.history.replaceState(null, "", url);
    const thread = threads.find((item) => item.id === threadId);
    if (thread && thread.unread_count > 0 && !readThreads.has(threadId)) {
      setReadThreads((current) => new Set(current).add(threadId));
      await fetch("/api/messages/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, action: "read" }),
      });
    }
  }

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
    setNotice(result.status === "skipped" ? "The address is opted out or suppressed, so the email was not sent." : "Email sent and added to its conversation.");
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

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread || !replyText.trim()) return;
    setBusy("reply");
    setNotice("");
    const response = await fetch("/api/messages/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: selectedThread.id, text: replyText }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setNotice(result.error || "The reply could not be sent.");
      return;
    }
    setReplyText("");
    setNotice("Reply sent and added to this conversation.");
    router.refresh();
  }

  async function changeThread(action: "open" | "close") {
    if (!selectedThread) return;
    setBusy(action);
    const response = await fetch("/api/messages/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: selectedThread.id, action }),
    });
    setBusy(null);
    if (!response.ok) {
      setNotice("The conversation status could not be changed.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="message-centre-tabs mt-6" role="tablist" aria-label="Message Centre views">
        <button type="button" className={tab === "inbox" ? "is-active" : ""} onClick={() => setTab("inbox")}>Inbox <span>{threads.reduce((total, thread) => total + (readThreads.has(thread.id) ? 0 : thread.unread_count), 0)}</span></button>
        <button type="button" className={tab === "delivery" ? "is-active" : ""} onClick={() => setTab("delivery")}>Delivery <span>{logs.length}</span></button>
        <button type="button" className={tab === "suppressed" ? "is-active" : ""} onClick={() => setTab("suppressed")}>Suppressed <span>{suppressions.length}</span></button>
        <button type="button" className="message-compose-button" onClick={() => setComposerOpen(!composerOpen)}>{composerOpen ? "Close composer" : "Send an email"}</button>
      </div>

      {composerOpen && (
        <form className="message-composer surface-card" onSubmit={manualSend} method="post">
          <div><p className="eyebrow">Manual send</p><h2>Send a template</h2><p>Choose a customer and a message. The email will start a replyable conversation.</p></div>
          <label><span>Customer</span><select name="customer_id" required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.label}</option>)}</select></label>
          <label><span>Occasion</span><select name="circle_member_id" defaultValue=""><option value="">No occasion</option>{customerMembers.map((member) => <option value={member.id} key={member.id}>{member.label}</option>)}</select></label>
          <label><span>Template</span><select name="template_name" required defaultValue=""><option value="" disabled>Choose a template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.label}{template.subject ? `: ${template.subject}` : ""}</option>)}</select></label>
          <button type="submit" disabled={busy === "manual"}>{busy === "manual" ? "Sending..." : "Send email now"}</button>
        </form>
      )}

      {notice && <p className="message-notice" role="status">{notice}</p>}

      {tab === "inbox" && (
        <div className="message-inbox surface-card mt-5">
          <aside className="message-thread-list">
            <label className="message-search"><span className="sr-only">Search conversations</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
            <div>
              {visibleThreads.length === 0 ? <p className="message-thread-empty">No conversations yet.</p> : visibleThreads.map((thread) => {
                const unread = readThreads.has(thread.id) ? 0 : thread.unread_count;
                return (
                  <button type="button" key={thread.id} className={`${selectedThread?.id === thread.id ? "is-active" : ""} ${unread ? "is-unread" : ""}`} onClick={() => void chooseThread(thread.id)}>
                    <span><strong>{thread.contact_name || thread.contact_email}</strong><time>{when(thread.last_message_at)}</time></span>
                    <b>{thread.subject}</b>
                    <small>{thread.last_message_preview || "No preview available"}</small>
                    {unread > 0 && <em>{unread}</em>}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="message-conversation">
            {!selectedThread ? <p className="message-thread-empty">Choose a conversation.</p> : (
              <>
                <header>
                  <div><p className="eyebrow">{selectedThread.status} conversation</p><h2>{selectedThread.subject}</h2><p>{selectedThread.contact_name || "Customer"} · {selectedThread.contact_email}</p></div>
                  <div>{selectedThread.customer?.id && <Link href={`/customers/${selectedThread.customer.id}`}>Customer profile</Link>}<button type="button" disabled={busy === "open" || busy === "close"} onClick={() => void changeThread(selectedThread.status === "open" ? "close" : "open")}>{selectedThread.status === "open" ? "Close" : "Reopen"}</button></div>
                </header>
                <div className="message-bubbles">
                  {selectedMessages.length === 0 ? <p className="message-thread-empty">No messages have been recorded in this conversation.</p> : selectedMessages.map((message) => (
                    <article key={message.id} className={`message-bubble is-${message.direction}`}>
                      <div><strong>{message.direction === "inbound" ? selectedThread.contact_name || message.from_address : "Hazel's Cake Lounge"}</strong><time>{when(message.created_at)}</time></div>
                      <p>{message.text_body || "No plain text content was supplied."}</p>
                      {message.attachments?.length > 0 && <ul>{message.attachments.map((attachment, index) => <li key={`${message.id}-${index}`}>{attachment.filename || "Attachment"} <small>{attachment.content_type || "file"}</small></li>)}</ul>}
                      <footer><span className={`message-delivery is-${message.status}`}>{statusName(message.status)}</span>{message.status_detail && <em>{message.status_detail}</em>}</footer>
                    </article>
                  ))}
                </div>
                <form className="message-reply" onSubmit={reply} method="post">
                  <label><span>Reply</span><textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} maxLength={10000} required placeholder="Write a plain text reply..." /></label>
                  <div><small>{replyText.length.toLocaleString("en-ZA")} / 10,000</small><button type="submit" disabled={busy === "reply" || !replyText.trim()}>{busy === "reply" ? "Sending..." : "Send reply"}</button></div>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "delivery" && (
        <>
          <div className="message-toolbar mt-5">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, address, occasion or error" />
            <div className="message-filters">
              {["all", "sent", "delivered", "failed", "bounced", "skipped"].map((value) => <button type="button" key={value} className={deliveryFilter === value ? "is-active" : ""} onClick={() => setDeliveryFilter(value)}>{value}</button>)}
            </div>
          </div>
          <div className="message-log surface-card mt-3">
            <div className="message-log__head"><span>Delivery</span><span>Customer</span><span>Message</span><span>Sent</span><span /></div>
            {visibleLogs.length === 0 ? <p className="message-log__empty">No messages match those filters.</p> : visibleLogs.map((log) => (
              <article key={log.id} className={`message-log__row is-${log.status}`}>
                <span className="message-status">{statusName(log.status)}</span>
                <span>{log.customer?.id ? <Link href={`/customers/${log.customer.id}`}><strong>{log.customer.full_name}</strong><small>{log.customer.email}</small></Link> : <small>Customer removed</small>}</span>
                <span><strong>{statusName(log.reminder_type || "Email")}</strong><small>{log.member ? `${log.member.person_name}'s ${log.member.occasion_type}` : "General message"}</small>{log.error_message && <em>{log.error_message}</em>}</span>
                <time>{when(log.sent_at)}</time>
                <span>{log.email_thread_id && <button type="button" onClick={() => { setTab("inbox"); void chooseThread(log.email_thread_id!); }}>Open</button>}{log.status === "failed" && log.customer_id && <button type="button" disabled={busy === log.id} onClick={() => send({ customer_id: log.customer_id, circle_member_id: log.circle_member_id, reminder_type: log.reminder_type }, log.id)}>{busy === log.id ? "Retrying..." : "Retry"}</button>}</span>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "suppressed" && (
        <div className="message-suppressions surface-card mt-5">
          <div className="message-log__head"><span>Address</span><span>Reason</span><span>Detail</span><span>Updated</span></div>
          {suppressions.length === 0 ? <p className="message-log__empty">No addresses are suppressed.</p> : suppressions.map((entry) => (
            <article key={entry.email_address}>
              <span>{entry.customer?.id ? <Link href={`/customers/${entry.customer.id}`}><strong>{entry.customer.full_name}</strong><small>{entry.email_address}</small></Link> : <strong>{entry.email_address}</strong>}</span>
              <span className="message-status">{statusName(entry.reason)}</span>
              <small>{entry.diagnostic_code || "The provider blocked further delivery to this address."}</small>
              <time>{when(entry.updated_at)}</time>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
