// Wordmark only. The raster "H" tile that used to sit above it was removed on
// 14/09/2026. The same image is still the browser tab and installed app icon,
// set in app/layout.tsx — that is deliberate and separate from this lockup.
export default function BrandMark() {
  return (
    <div className="brand-lockup">
      <span className="brand-lockup__copy">
        <strong>Hazel&apos;s</strong>
        <em>Cake Lounge</em>
      </span>
    </div>
  );
}
