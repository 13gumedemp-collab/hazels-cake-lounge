"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "@/lib/nav";
import Icon from "./Icon";
import NotificationBell from "./NotificationBell";

export default function Shell({ counts, children }: { counts: Record<string, number>; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const badge = (key: string | null) => (key && counts[key] ? counts[key] : 0);

  return (
    <div className="min-h-screen md:pl-60">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-ink2/60 backdrop-blur">
        <div className="px-6 py-6">
          <div className="font-serif text-2xl text-gold leading-none">Hazel&apos;s</div>
          <div className="text-[0.65rem] tracking-[0.3em] uppercase text-creamSoft mt-1">Command Centre</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active(item.href) ? "bg-gold/10 text-gold" : "text-creamSoft hover:text-cream hover:bg-white/[0.03]"}`}>
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {badge(item.badge) > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold/20 text-gold text-[11px] grid place-items-center">{badge(item.badge)}</span>
              )}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="m-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-cream hover:bg-white/[0.03]">
          <Icon name="logout" /> <span>Log out</span>
        </button>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 h-16 border-b border-line bg-ink/80 backdrop-blur">
        <div className="md:hidden font-serif text-lg text-gold">Hazel&apos;s CC</div>
        <div className="hidden md:block" />
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
