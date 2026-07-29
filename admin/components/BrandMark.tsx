export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? "brand-lockup--compact" : ""}`}>
      <span className="brand-mark" role="img" aria-label="Hazel's Cake Lounge logo" />
      {!compact && (
        <span className="brand-lockup__copy">
          <strong>Hazel&apos;s</strong>
          <em>Cake Lounge</em>
        </span>
      )}
    </div>
  );
}
