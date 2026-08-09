"use client";
import { useState } from "react";
import { activityLabel, activityMessage } from "@/lib/activityPresentation";

export interface Note { id: string; type: string; message: string; priority: string; read: boolean; created_at: string; action_url: string | null; }

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
const dotTone = (p: string) => (p === "high" ? "bg-rose" : "bg-gold");
export default function NotificationList({ notes, onMarkAll }: { notes: Note[]; onMarkAll: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const unread = notes.filter((n) => !n.read).length;
  const visible = expanded ? notes : notes.slice(0, 5);

  if (notes.length === 0) {
    return <p className="notification-empty">All caught up. New activity will appear here.</p>;
  }

  return (
    <div className="notification-list">
      <div className="notification-list__header">
        <div>
          <p className="notification-list__eyebrow">Command centre</p>
          <h2>Notifications</h2>
          <p className="notification-list__summary">{unread ? `${unread} unread` : "All caught up"}</p>
        </div>
        {unread > 0 && (
          <button onClick={onMarkAll} className="notification-list__mark-all">Mark all read</button>
        )}
      </div>

      <div className="notification-list__items">
        {visible.map((n) => (
          <article
            key={n.id}
            className={`notification-item ${n.read ? "is-read" : "is-unread"}`}
          >
            <span className={`notification-item__dot ${dotTone(n.priority)}`} />
            <div className="notification-item__body">
              <div className="notification-item__meta">
                <p>{activityLabel(n.type)}</p>
                <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
              </div>
              <p className="notification-item__message">{activityMessage(n)}</p>
              {n.action_url && <a href={n.action_url} className="notification-item__action">Open</a>}
            </div>
          </article>
        ))}
      </div>

      {notes.length > 5 && (
        <button onClick={() => setExpanded((e) => !e)} className="notification-list__toggle">
          {expanded ? "Show less" : `Show all ${notes.length}`}
        </button>
      )}
    </div>
  );
}
