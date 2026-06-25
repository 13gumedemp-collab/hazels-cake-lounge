import Link from "next/link";
import Icon from "./Icon";

export default function StatCard({ label, value, icon, href, accent = false, delay = 0 }:
  { label: string; value: number | string; icon: string; href: string; accent?: boolean; delay?: number }) {
  return (
    <Link href={href} style={{ animationDelay: `${delay}ms` }}
      className={`rise block rounded-2xl border p-5 transition hover:scale-[1.01] ${accent ? "border-gold/60 bg-ink2" : "border-line bg-ink2"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[0.7rem] tracking-[0.14em] uppercase ${accent ? "text-gold" : "text-creamSoft"}`}>{label}</span>
        <span className={accent ? "text-gold" : "text-muted"}><Icon name={icon} className="w-4 h-4" /></span>
      </div>
      <div className="mt-3 font-serif text-4xl text-cream">{value}</div>
    </Link>
  );
}
