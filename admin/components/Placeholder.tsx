export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="admin-page max-w-3xl mx-auto">
      <p className="eyebrow">Workspace</p><h1 className="font-serif text-3xl text-cream mt-2">{title}</h1>
      <div className="surface-card surface-card--empty mt-6 p-10 text-center">
        <p className="text-creamSoft">{note}</p>
        <p className="text-muted text-sm mt-2">Coming in the next build step.</p>
      </div>
    </div>
  );
}
