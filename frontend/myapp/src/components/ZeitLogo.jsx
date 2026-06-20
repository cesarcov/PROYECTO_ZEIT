import { getBrand } from "../branding/brand";

/**
 * ZeitLogo — Identidad de marca (configurable vía branding/brand.js).
 *
 * Si brand.logoSrc tiene una imagen, la usa (incluye el wordmark, no redibuja
 * texto). Usa la versión completa cuando showText, o el ícono (globo) cuando no.
 * Si no hay imagen configurada, dibuja el SVG de respaldo.
 *
 * API (drop-in): size, onDark, showText, tagline
 */
export default function ZeitLogo({
  size     = 40,
  onDark   = true,
  showText = false,
  tagline  = false,
}) {
  const b = getBrand();

  // ── Logo en imagen (incluye el nombre) ──────────────────────────────────────
  if (b.logoSrc) {
    // Colapsado / sin texto → solo el globo.
    if (!showText) {
      return (
        <img
          src={b.logoIconSrc || b.logoSrc}
          alt={b.appName}
          style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
        />
      );
    }
    // Con texto → variante según el fondo (oscuro = texto blanco, claro = texto azul).
    const src = onDark ? (b.logoSrcDark || b.logoSrc) : b.logoSrc;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: Math.round(size * 0.16) }}>
        <img
          src={src}
          alt={b.appName}
          style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
        />
        {tagline && b.tagline && (
          <div style={{
            fontWeight: 600,
            fontSize: Math.round(size * 0.2),
            letterSpacing: "0.02em",
            color: onDark ? "rgba(255,255,255,0.72)" : "#003A8C",
            whiteSpace: "nowrap",
          }}>
            {b.tagline}
          </div>
        )}
      </div>
    );
  }

  // ── Respaldo SVG (sin imagen configurada) ───────────────────────────────────
  const azul    = "#003A8C";
  const gris    = "#5A6573";
  const naranja = "#FF6B00";
  const nameMain = onDark ? "#FFFFFF" : azul;
  const nameSoft = onDark ? "#9AA6B5" : gris;
  const subColor = onDark ? "rgba(199,210,229,0.65)" : gris;
  const VW = 120, VH = 120;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: showText ? Math.round(size * 0.28) : 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${VW} ${VH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, display: "block" }}
        aria-label={b.appName}
      >
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
        <path
          d="M 8 64 C 22 20, 34 20, 44 64 C 52 100, 64 100, 72 52 C 80 16, 92 16, 100 64 C 105 86, 114 80, 118 62"
          stroke={naranja}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {showText && (
        <div style={{ lineHeight: 1, userSelect: "none" }}>
          <div style={{ fontWeight: 900, fontSize: Math.round(size * 0.5), letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            {b.nameParts.map((p, i) => (
              <span key={i} style={{ color: p.soft ? nameSoft : nameMain }}>{p.text}</span>
            ))}
          </div>
          {b.sub && (
            <div style={{
              fontWeight: 700, fontSize: Math.round(size * 0.2), letterSpacing: "0.26em",
              textTransform: "uppercase", color: subColor, marginTop: Math.round(size * 0.06), whiteSpace: "nowrap",
            }}>
              {b.sub}
            </div>
          )}
          {tagline && b.tagline && (
            <div style={{
              fontWeight: 500, fontSize: Math.round(size * 0.15), letterSpacing: "0.04em",
              color: onDark ? "rgba(199,210,229,0.45)" : gris, marginTop: Math.round(size * 0.12), whiteSpace: "nowrap",
            }}>
              {b.tagline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
