"use client";

import { useRouter } from "next/navigation";

export default function CallTasks({ tasks }: { tasks: any[] }) {
  const router = useRouter();

  async function done(id: string) {
    await fetch("/api/calls/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  if (!tasks.length) return <p className="surface-card surface-card--empty p-8 text-center text-muted">No calls are due.</p>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article key={task.id} className="task-card p-4 flex flex-col sm:flex-row sm:justify-between gap-4 sm:items-center">
          <div className="min-w-0">
            <p className="font-serif text-xl text-cream">{task.customer?.full_name}</p>
            <p className="text-gold text-sm">{task.member?.person_name}&apos;s {task.member?.occasion_type}</p>
            <p className="text-muted text-xs mt-1">{task.reminder_type.replaceAll("_", " ")} · due {task.due_date}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <a className="task-card__secondary flex-1 sm:flex-none text-center px-3 py-2.5" href={`tel:${task.phone_number}`}>Call</a>
            <button className="task-card__primary flex-1 sm:flex-none px-3 py-2.5" onClick={() => done(task.id)}>Done</button>
          </div>
        </article>
      ))}
    </div>
  );
}
