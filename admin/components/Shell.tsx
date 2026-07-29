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
  const currentPage = NAV.find((item) => active(item.href))?.label || "Overview";

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const SidebarInner = (
    <>
      <div className={`px-5 py-6 ${collapsed ? "lg:px-0 lg:justify-center" : ""}`}>
      <div className={`sidebar-wordmark ${collapsed ? "sidebar-wordmark--compact" : ""}`}>
        {collapsed ? <span className="sidebar-wordmark__mark" role="img" aria-label="Hazel's Cake Lounge logo" /> : <><strong>Hazel&apos;s</strong><em>Cake Lounge</em></>}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className={`px-3 mb-1.5 text-[0.6rem] tracking-[0.25em] uppercase text-muted transition-all duration-300 ${collapsed ? "lg:opacity-0 lg:h-0 lg:mb-0 lg:overflow-hidden" : ""}`}>
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
                    } ${collapsed ? "lg:justify-center" : ""}`}
                  >
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r bg-gold transition-[height,opacity] duration-300 ease-cinematic ${on ? "h-6 opacity-100" : "h-0 opacity-0"}`} />
                    <Icon name={item.icon} className="w-5 h-5 shrink-0" />
                    <span className={`flex-1 whitespace-nowrap transition-all duration-300 ${collapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : "opacity-100"}`}>{item.label}</span>
                    {n > 0 && (
                      <span className={`min-w-[20px] h-5 px-1.5 rounded-full bg-gold/20 text-gold text-[11px] grid place-items-center ${collapsed ? "lg:absolute lg:top-1 lg:right-1 lg:min-w-0 lg:w-2 lg:h-2 lg:p-0" : ""}`}>
                        <span className={collapsed ? "lg:hidden" : ""}>{n}</span>
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
        className={`m-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-cream hover:bg-white/[0.04] transition ${collapsed ? "lg:justify-center" : ""}`}
      >
        <Icon name="logout" className="w-5 h-5 shrink-0" />
        <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden" : ""}`}>Log out</span>
      </button>
    </>
  );

  return (
    <div className={`admin-app min-h-screen ${padTx} ${collapsed ? "lg:pl-[88px]" : "lg:pl-[280px]"}`}>
      {/* Desktop sidebar */}
      <aside className={`admin-sidebar hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col ${widthTx} ${collapsed ? "w-[88px]" : "w-[280px]"}`}>
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
        <aside className={`admin-sidebar absolute inset-y-0 left-0 w-[min(88vw,320px)] flex flex-col transition-transform duration-300 ease-cinematic ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {SidebarInner}
        </aside>
      </div>

      {/* Top bar */}
      <header className="admin-topbar sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 h-[68px] lg:h-[76px] backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden min-w-11 min-h-11 grid place-items-center -ml-2 text-gold" aria-label="Open menu">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <button onClick={() => setCollapsed((c) => !c)} className="hidden lg:grid place-items-center p-2 -ml-2 text-gold hover:text-goldBright transition" aria-label="Toggle sidebar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
          </button>
          <div className="hidden md:block border-l border-white/10 pl-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Workspace</p>
            <p className="text-sm font-medium text-cream">{currentPage}</p>
          </div>
        </div>
        <NotificationBell />
      </header>

      <main className="admin-main px-4 sm:px-5 lg:px-8 py-5 sm:py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="admin-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 backdrop-blur">
        {NAV.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href}
            className={`relative flex flex-col items-center gap-0.5 min-w-0 py-2.5 text-[9px] sm:text-[10px] ${active(item.href) ? "text-gold" : "text-muted"}`}>
            <Icon name={item.icon} className="w-5 h-5" />
            <span className="max-w-full truncate px-1">{item.label}</span>
            {badge(item.badge) > 0 && <span className="absolute top-1 right-1/4 w-1.5 h-1.5 rounded-full bg-gold" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
