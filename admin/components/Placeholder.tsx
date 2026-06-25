export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-cream">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-ink2/40 p-10 text-center">
        <p className="text-creamSoft">{note}</p>
        <p className="text-muted text-sm mt-2">Coming in the next build step.</p>
      </div>
    </div>
  );
}
