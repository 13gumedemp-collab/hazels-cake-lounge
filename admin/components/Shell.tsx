"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/nav";
import Icon from "./Icon";
import NotificationBell from "./NotificationBell";

const GROUPS: { label: string; items: typeof NAV }[] = [
  { label: "Today", items: NAV.filter((n) => ["/", "/orders", "/occasions"].includes(n.href)) },
  { label: "People", items: NAV.filter((n) => ["/customers", "/whatsapp", "/messages", "/reminders"].includes(n.href)) },
  { label: "Insight", items: NAV.filter((n) => ["/analytics", "/settings"].includes(n.href)) },
];

export default function Shell({ counts, children }: { counts: Record<string, number>; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Read the stored width once, before enabling transitions, so the sidebar
  // never animates on first paint or on page navigation.
  useEffect(() => {
    setCollapsed(localStorage.getItem("hcl_sidebar_collapsed") === "1");
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("hcl_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed, ready]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Transitions only fire for deliberate user toggles, never on mount/nav.
  const widthTx = ready ? "transition-[width] duration-300 ease-cinematic" : "";
  const padTx = ready ? "transition-[padding] duration-300 ease-cinematic" : "";

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const badge = (key: string | null) => (key && counts[key] ? counts[key] : 0);

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const SidebarInner = (
    <>
      <div className={`flex items-center gap-3 px-5 py-6 ${collapsed ? "md:px-0 md:justify-center" : ""}`}>
        <div className="shrink-0 w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 grid place-items-center font-serif italic text-gold text-lg">H</div>
        <div className={`transition-all duration-300 ${collapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : "opacity-100"}`}>
          <div className="font-serif text-xl text-gold leading-none whitespace-nowrap">Hazel&apos;s</div>
          <div className="text-[0.6rem] tracking-[0.3em] uppercase text-creamSoft mt-1 whitespace-nowrap">Command Centre</div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className={`px-3 mb-1.5 text-[0.6rem] tracking-[0.25em] uppercase text-muted transition-all duration-300 ${collapsed ? "md:opacity-0 md:h-0 md:mb-0 md:overflow-hidden" : ""}`}>
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const on = active(item.href);
                const n = badge(item.badge);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                      on ? "bg-gold/10 text-gold" : "text-creamSoft hover:text-cream hover:bg-white/[0.04]"
                    } ${collapsed ? "md:justify-center" : ""}`}
                  >
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r bg-gold transition-[height,opacity] duration-300 ease-cinematic ${on ? "h-6 opacity-100" : "h-0 opacity-0"}`} />
                    <Icon name={item.icon} className="w-5 h-5 shrink-0" />
                    <span className={`flex-1 whitespace-nowrap transition-all duration-300 ${collapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : "opacity-100"}`}>{item.label}</span>
                    {n > 0 && (
                      <span className={`min-w-[20px] h-5 px-1.5 rounded-full bg-gold/20 text-gold text-[11px] grid place-items-center ${collapsed ? "md:absolute md:top-1 md:right-1 md:min-w-0 md:w-2 md:h-2 md:p-0" : ""}`}>
                        <span className={collapsed ? "md:hidden" : ""}>{n}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={logout}
        title={collapsed ? "Log out" : undefined}
        className={`m-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-cream hover:bg-white/[0.04] transition ${collapsed ? "md:justify-center" : ""}`}
      >
        <Icon name="logout" className="w-5 h-5 shrink-0" />
        <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : ""}`}>Log out</span>
      </button>
    </>
  );

  return (
    <div className={`min-h-screen ${padTx} ${collapsed ? "md:pl-[76px]" : "md:pl-64"}`}>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-line bg-ink2 ${widthTx} ${collapsed ? "w-[76px]" : "w-64"}`}>
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 w-64 flex flex-col border-r border-line bg-ink2 transition-transform duration-300 ease-cinematic ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {SidebarInner}
        </aside>
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 h-16 border-b border-line bg-ink/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-gold" aria-label="Open menu">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <button onClick={() => setCollapsed((c) => !c)} className="hidden md:grid place-items-center p-2 -ml-2 text-gold hover:text-goldBright transition" aria-label="Toggle sidebar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
          </button>
        </div>
        <NotificationBell />
      </header>

      <main className="px-4 md:px-8 py-6 pb-24 md:pb-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-line bg-ink2/95 backdrop-blur">
        {NAV.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href}
            className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${active(item.href) ? "text-gold" : "text-muted"}`}>
            <Icon name={item.icon} className="w-5 h-5" />
            {item.label}
            {badge(item.badge) > 0 && <span className="absolute top-1 right-1/4 w-1.5 h-1.5 rounded-full bg-gold" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
