"use client";
import { useEffect, useState, useCallback } from "react";
import Icon from "./Icon";
import NotificationList, { Note } from "./NotificationList";

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

  const markAll = useCallback(async () => {
    // Optimistic clear, then persist, then re-sync from the server.
    setNotes((n) => n.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
    load();
  }, [load]);

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
          <div className="absolute right-0 mt-2 w-[22rem] max-w-[92vw] max-h-[72vh] overflow-y-auto z-50 rounded-2xl border border-line bg-ink2 shadow-2xl p-4 rise">
            <NotificationList notes={notes} onMarkAll={markAll} />
          </div>
        </>
      )}
    </div>
  );
}
