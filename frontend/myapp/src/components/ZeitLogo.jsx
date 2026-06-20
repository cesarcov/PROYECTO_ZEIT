import { getBrand } from "../branding/brand";

/**
 * ZeitLogo — Identidad de marca (configurable por white-label vía branding/brand.js).
 *
 * Si brand.logoSrc tiene una imagen, la usa (<img>). Si no, dibuja el SVG de
 * respaldo (globo + onda de energía). Reemplazar la marca por otra empresa =
 * editar branding/brand.js (o el override en localStorage), sin tocar este archivo.
 *
 * API (compatible drop-in):
 *   size, onDark, showText, tagline
 */
export default function ZeitLogo({
  size     = 40,
  onDark   = true,
  showText = false,
  tagline  = false,
}) {
  const b = getBrand();

  const azul    = "#003A8C";
  const gris    = "#5A6573";
  const naranja = "#FF6B00";
  const nameMain = onDark ? "#FFFFFF" : azul;
  const nameSoft = onDark ? "#9AA6B5" : gris;
  const subColor = onDark ? "rgba(199,210,229,0.65)" : gris;

  const VW = 120, VH = 120;

  const icono = b.logoSrc ? (
    <img
      src={b.logoSrc}
      alt={b.appName}
      style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
    />
  ) : (
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
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: showText ? Math.round(size * 0.28) : 0 }}>
      {icono}

      {showText && (
        <div style={{ lineHeight: 1, userSelect: "none" }}>
          <div style={{
            fontWeight: 900,
            fontSize: Math.round(size * 0.5),
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}>
            {b.nameParts.map((p, i) => (
              <span key={i} style={{ color: p.soft ? nameSoft : nameMain }}>{p.text}</span>
            ))}
          </div>
          {b.sub && (
            <div style={{
              fontWeight: 700,
              fontSize: Math.round(size * 0.2),
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: subColor,
              marginTop: Math.round(size * 0.06),
              whiteSpace: "nowrap",
            }}>
              {b.sub}
            </div>
          )}
          {tagline && b.tagline && (
            <div style={{
              fontWeight: 500,
              fontSize: Math.round(size * 0.15),
              letterSpacing: "0.04em",
              color: onDark ? "rgba(199,210,229,0.45)" : gris,
              marginTop: Math.round(size * 0.12),
              whiteSpace: "nowrap",
            }}>
              {b.tagline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
