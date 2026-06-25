"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Note { id: string; type: string; message: string; priority: string; read: boolean; created_at: string; }

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function dotTone(p: string) {
  return p === "high" ? "bg-rose" : "bg-gold";
}

// A cinematic stacking notification list: collapsed the newest cards sit in a
// neat stack; expanding fans them into a full, staggered list.
export default function NotificationList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [expanded, setExpanded] = useState(false);
  const seenTop = useRef<string | null>(null);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) {
        const list: Note[] = (await r.json()).notifications || [];
        setNotes(list);
        if (list[0] && seenTop.current && list[0].id !== seenTop.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1200);
        }
        if (list[0]) seenTop.current = list[0].id;
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
    setNotes((n) => n.map((x) => ({ ...x, read: true })));
  }

  const unread = notes.filter((n) => !n.read).length;
  const visible = expanded ? notes : notes.slice(0, 3);

  if (notes.length === 0) {
    return <p className="text-sm text-muted py-6 text-center">All quiet for now.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-serif text-cream text-lg">Notifications</span>
          {unread > 0 && (
            <span className={`text-[11px] text-ink bg-gold rounded-full px-2 py-0.5 transition-transform ${pulse ? "scale-125" : ""}`}>
              {unread} new
            </span>
          )}
        </div>
        <button onClick={markAll} className="text-xs text-gold hover:text-goldBright transition-colors">
          Mark all read
        </button>
      </div>

      <div
        className={`nlist ${expanded ? "nlist--open" : "nlist--stack"}`}
        onClick={() => !expanded && setExpanded(true)}
        role={expanded ? undefined : "button"}
      >
        {visible.map((n, i) => (
          <div
            key={n.id}
            className="nlist__card"
            style={{
              // Stagger depth in stacked mode; stagger reveal in open mode.
              ["--i" as string]: i,
              zIndex: visible.length - i,
              transitionDelay: expanded ? `${i * 45}ms` : "0ms",
            }}
          >
            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotTone(n.priority)} ${!n.read ? "ring-2 ring-gold/30" : ""}`} />
            <div className="min-w-0">
              <p className="text-sm text-cream leading-snug">{n.message}</p>
              <p className="text-[11px] text-muted mt-1">{timeAgo(n.created_at)}</p>
            </div>
          </div>
        ))}
      </div>

      {notes.length > 3 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full mt-3 text-xs text-gold hover:text-goldBright transition-colors"
        >
          {expanded ? "Show less" : `Show all ${notes.length}`}
        </button>
      )}
    </div>
  );
}
