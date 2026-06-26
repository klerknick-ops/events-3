// Lantern brand mark. Theme-agnostic: red structure + ember glow read well on
// both the parchment (light) and ink (dark) surfaces. The body is unfilled so it
// floats on any background.
const RED = "#BD3B2C";
const EMBER = "#E8643F";

export function LanternLogo({ height = 30, className }: { height?: number; className?: string }) {
  const width = (height * 200) / 240;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 240"
      className={className}
      role="img"
      aria-label="Lantern"
    >
      <defs>
        <filter id="lanternBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {/* glow rays */}
      <line x1="60" y1="80" x2="46" y2="66" stroke={EMBER} strokeWidth="3" strokeLinecap="round" />
      <line x1="140" y1="80" x2="154" y2="66" stroke={EMBER} strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="178" x2="44" y2="190" stroke={EMBER} strokeWidth="3" strokeLinecap="round" />
      <line x1="140" y1="178" x2="156" y2="190" stroke={EMBER} strokeWidth="3" strokeLinecap="round" />
      {/* hanging loop + cap */}
      <path d="M82,64 C82,30 118,30 118,64" fill="none" stroke={RED} strokeWidth="6" strokeLinecap="round" />
      <polygon points="64,86 136,86 100,54" fill={RED} />
      {/* body */}
      <rect x="66" y="86" width="68" height="90" rx="6" fill="none" stroke={RED} strokeWidth="6" />
      <line x1="100" y1="92" x2="100" y2="170" stroke={RED} strokeWidth="3" opacity="0.55" />
      <line x1="72" y1="131" x2="128" y2="131" stroke={RED} strokeWidth="3" opacity="0.55" />
      {/* ember core */}
      <circle cx="100" cy="131" r="11" fill={EMBER} opacity="0.9" filter="url(#lanternBlur)" />
      <circle cx="100" cy="131" r="6" fill={EMBER} />
      {/* base */}
      <rect x="54" y="176" width="92" height="16" rx="5" fill={RED} />
    </svg>
  );
}
