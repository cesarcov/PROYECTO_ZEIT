import { getBrand } from "../branding/brand";

// Isotipo de respaldo (globo + onda) cuando no hay imagen de logo configurada.
function SvgGlobe({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: "block" }} aria-hidden="true">
      <defs>
        <radialGradient id="zeitGlobe" cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#3E7BD6" />
          <stop offset="55%" stopColor="#1E5FC0" />
          <stop offset="100%" stopColor="#001F54" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="url(#zeitGlobe)" />
      <g stroke="#9CC2F5" strokeWidth="1.4" fill="none" opacity="0.45">
        <ellipse cx="60" cy="60" rx="22" ry="50" />
        <ellipse cx="60" cy="60" rx="50" ry="22" />
        <line x1="10" y1="60" x2="110" y2="60" />
      </g>
      <path d="M 8 64 C 22 20, 34 20, 44 64 C 52 100, 64 100, 72 52 C 80 16, 92 16, 100 64 C 105 86, 114 80, 118 62"
        stroke="#FF6B00" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Tagline({ onDark, size, children }) {
  return (
    <div style={{
      fontWeight: 500, fontSize: 14, lineHeight: 1.3,
      color: onDark ? "rgba(255,255,255,0.72)" : "#003A8C", whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
}

/**
 * ZeitLogo — Identidad de marca (resuelta por white-label vía branding/brand.js).
 * API (drop-in): size, width, onDark, showText, tagline
 */
export default function ZeitLogo({
  size     = 40,
  width    = null,
  onDark   = true,
  showText = false,
  tagline  = false,
}) {
  const b = getBrand();
  const hasImage = !!b.logoSrc;
  const mainSrc = onDark ? (b.logoSrcDark || b.logoSrc) : b.logoSrc;
  const iconSrc = b.logoIconSrc || b.logoSrc;

  const imgStyle = width
    ? { width, height: "auto", display: "block", flexShrink: 0 }
    : { height: size, width: "auto", display: "block", flexShrink: 0 };

  // ── Caso 1: el logo (imagen) ya incluye el nombre → solo imagen ──────────────
  if (hasImage && b.logoIncluyeNombre) {
    if (!showText) {
      return <img src={iconSrc} alt={b.appName} style={{ height: size, width: "auto", display: "block", flexShrink: 0 }} />;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <img src={mainSrc} alt={b.appName} style={imgStyle} />
        {tagline && b.tagline && <Tagline onDark={onDark}>{b.tagline}</Tagline>}
      </div>
    );
  }

  // ── Caso 2/3/4: mostrar el NOMBRE como texto (logo solo-símbolo o sin logo) ──
  const icono = hasImage
    ? <img src={iconSrc} alt={b.appName} style={{ height: size, width: "auto", display: "block", flexShrink: 0 }} />
    : <SvgGlobe size={size} />;

  if (!showText) return icono;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
      {icono}
      <div style={{ lineHeight: 1.1, userSelect: "none" }}>
        <div style={{
          fontWeight: 900, fontSize: Math.round(size * 0.42), letterSpacing: "-0.01em",
          color: onDark ? "#FFFFFF" : "#003A8C", whiteSpace: "nowrap",
        }}>
          {b.appName}
        </div>
        {tagline && b.tagline && <Tagline onDark={onDark}>{b.tagline}</Tagline>}
      </div>
    </div>
  );
}
