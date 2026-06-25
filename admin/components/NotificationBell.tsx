"use client";
import { useEffect, useState, useCallback } from "react";
import Icon from "./Icon";
import NotificationList from "./NotificationList";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) {
        const list = (await r.json()).notifications || [];
        setUnread(list.filter((n: { read: boolean }) => !n.read).length);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 15000);
    return () => clearInterval(t);
  }, [loadCount, open]);

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
            <NotificationList />
          </div>
        </>
      )}
    </div>
  );
}
