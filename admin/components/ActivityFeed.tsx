"use client";

import { useState } from "react";
import { ActivityNote, ActivityTab, activityLabel, activityMessage, activityTab } from "@/lib/activityPresentation";

type Note = ActivityNote & { id?: string; created_at: string };

const tabs: { id: ActivityTab; label: string }[] = [
  { id: "urgent", label: "Urgent" },
  { id: "not_urgent", label: "Not urgent" },
  { id: "fyi", label: "FYI" },
  { id: "all", label: "All" },
];

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActivityFeed({ notes }: { notes: Note[] }) {
  const [selected, setSelected] = useState<ActivityTab>("urgent");
  const visible = selected === "all" ? notes : notes.filter((note) => activityTab(note) === selected);

  return (
    <section className="surface-card p-5 md:p-6">
      <p className="eyebrow mb-2">Live feed</p><h2>Recent activity</h2>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gold/20 pb-2" role="tablist" aria-label="Recent activity filters">
        {tabs.map((tab) => {
          const count = tab.id === "all" ? notes.length : notes.filter((note) => activityTab(note) === tab.id).length;
          const active = selected === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(tab.id)}
              className={`min-h-9 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition ${active ? "bg-gold text-ink" : "text-muted hover:bg-cream/5 hover:text-cream"}`}
            >
              {tab.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {selected === "urgent" ? "Nothing urgent right now." : selected === "not_urgent" ? "No non-urgent tasks right now." : selected === "fyi" ? "No updates to share yet." : "No activity yet."}
        </p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {visible.map((note, index) => {
            const urgent = activityTab(note) === "urgent";
            return (
              <li key={note.id || `${note.created_at}-${index}`} className={`rounded-xl border p-3 ${urgent ? "border-rose/40 bg-rose/5" : "border-gold/15 bg-cream/5"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${urgent ? "text-rose" : "text-gold"}`}>{activityLabel(note.type)}</p>
                  <time className="shrink-0 text-xs text-muted" dateTime={note.created_at}>{timeAgo(note.created_at)}</time>
                </div>
                <p className="mt-1 text-sm leading-6 text-creamSoft">{activityMessage(note)}</p>
                {note.action_url && <a className="mt-2 inline-block text-xs font-semibold text-gold underline underline-offset-4" href={note.action_url}>Open</a>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
