"use client";
import { useRouter } from "next/navigation";
export default function CallTasks({ tasks }: { tasks: any[] }) {
  const router = useRouter();
  async function done(id: string) { await fetch("/api/calls/complete", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id}) }); router.refresh(); }
  if (!tasks.length) return <p className="border border-dashed border-line rounded-xl p-8 text-center text-muted">No calls are due.</p>;
  return <div className="space-y-3">{tasks.map((t) => <article key={t.id} className="border border-line bg-ink2 rounded-xl p-4 flex justify-between gap-4 items-center"><div><p className="font-serif text-xl text-cream">{t.customer?.full_name}</p><p className="text-gold text-sm">{t.member?.person_name}&apos;s {t.member?.occasion_type}</p><p className="text-muted text-xs mt-1">{t.reminder_type.replaceAll("_"," ")} · due {t.due_date}</p></div><div className="flex gap-2"><a className="px-3 py-2 border border-gold text-gold rounded" href={`tel:${t.phone_number}`}>Call</a><button className="px-3 py-2 bg-gold text-ink rounded" onClick={() => done(t.id)}>Done</button></div></article>)}</div>;
}
