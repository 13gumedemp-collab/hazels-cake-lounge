"use client";
import { useEffect, useState, useCallback } from "react";
import Icon from "./Icon";

interface Note { id: string; type: string; message: string; priority: string; read: boolean; created_at: string; }

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const unread = notes.filter((n) => !n.read).length;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setNotes((await r.json()).notifications || []);
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

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 text-gold hover:text-goldBright" aria-label="Notifications">
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[11px] font-semibold grid place-items-center">{unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-[70vh] overflow-y-auto z-50 rounded-xl border border-line bg-ink2 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-ink2">
              <span className="font-serif text-cream">Notifications</span>
              <button onClick={markAll} className="text-xs text-gold hover:text-goldBright">Mark all as read</button>
            </div>
            {notes.length === 0 && <p className="px-4 py-6 text-sm text-muted">Nothing yet.</p>}
            {notes.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-line/50 ${!n.read ? "bg-white/[0.02]" : ""}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.priority === "high" ? "bg-rose" : "bg-gold"}`} />
                  <div>
                    <p className="text-sm text-cream leading-snug">{n.message}</p>
                    <p className="text-[11px] text-muted mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
