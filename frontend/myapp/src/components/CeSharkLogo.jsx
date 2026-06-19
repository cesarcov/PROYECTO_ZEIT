/**
 * CeSharkLogo — Logotipo vectorial CeShark ERP Modular (v6)
 *
 * SVG ViewBox: 0 0 280 260
 *
 * Elementos:
 *  1. Aleta dorsal: borde frontal casi recto, borde trasero con
 *     concavidad ("scoop") suave y apertura en la base.
 *  2. Ola superior: forma crescent — ambos bordes curvados,
 *     cresta a y=134, ancho x 18→268.
 *  3. Ola inferior: crescent más grande, cresta a y=160,
 *     ancho x 2→278.
 *
 * Props:
 *   size     — altura del ícono en px
 *   onDark   — true = fondo oscuro (teal luminoso), false = fondo claro (teal marca)
 *   showText — agrega "CeShark / ERP Modular" a la derecha
 *   tagline  — agrega "INTELIGENCIA · FUERZA · EVOLUCIÓN" (solo si showText)
 */
export default function CeSharkLogo({
  size     = 40,
  onDark   = true,
  showText = false,
  tagline  = false,
}) {
  const sharkTeal = onDark ? "#5DCACC" : "#1A8086";
  const nameMain  = onDark ? "#FFFFFF"  : "#182D35";
  const ceAccent  = sharkTeal;
  const subColor  = onDark ? "rgba(184,227,233,0.60)" : "#1A8086";
  const tagColor  = onDark ? "rgba(184,227,233,0.38)" : "#8AACB0";
  const lineColor = sharkTeal;

  const VW = 280, VH = 260;
  const iconH = size;
  const iconW = Math.round(size * (VW / VH));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: showText ? Math.round(size * 0.26) : 0 }}>

      <svg
        width={iconW}
        height={iconH}
        viewBox={`0 0 ${VW} ${VH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, display: "block" }}
        aria-label="CeShark"
      >
        {/* ── Aleta dorsal ──────────────────────────────────────────
            Borde frontal (izq): leve curvatura convexa hacia arriba
            Borde trasero (der): va a la derecha (hombro),
            scoop cóncavo, luego apertura hacia la base derecha     */}
        <path
          d={`M 55 170
              C 48 125, 52 70, 100 12
              C 116 2, 136 20, 150 68
              C 162 118, 122 152, 110 168
              C 118 176, 152 184, 188 170
              Z`}
          fill={sharkTeal}
        />

        {/* ── Ola superior (crescent) ────────────────────────────────
            Top edge: cresta a y≈134, sweep de x=18 a x=268
            Bottom edge: también curvada (y≈174), da la forma crescent */}
        <path
          d={`M 18 172
              C 80 136, 192 134, 268 160
              C 278 167, 273 188, 263 188
              C 188 178, 77 174, 18 181
              C 9 181, 7 178, 18 172
              Z`}
          fill={sharkTeal}
        />

        {/* ── Ola inferior (crescent más grande) ────────────────────
            Top edge: cresta a y≈160, sweep de x=2 a x=278
            Más gruesa y baja que la ola superior                    */}
        <path
          d={`M 2 200
              C 82 162, 214 160, 278 196
              C 288 203, 283 228, 272 228
              C 208 213, 79 212, 2 218
              C -7 218, -8 208, 2 200
              Z`}
          fill={sharkTeal}
        />
      </svg>

      {showText && (
        <div style={{ lineHeight: 1, userSelect: "none" }}>
          <div style={{
            fontWeight: 900,
            fontSize:   Math.round(size * 0.42),
            letterSpacing: "-0.025em",
            whiteSpace: "nowrap",
          }}>
            <span style={{ color: ceAccent }}>Ce</span>
            <span style={{ color: nameMain }}>Shark</span>
          </div>

          <div style={{
            display: "flex", alignItems: "center",
            gap: Math.round(size * 0.09),
            marginTop: Math.round(size * 0.07),
          }}>
            <span style={{
              display: "inline-block",
              width: Math.round(size * 0.15), height: 1.5,
              background: lineColor, borderRadius: 1, flexShrink: 0,
            }} />
            <span style={{
              fontWeight: 700,
              fontSize:   Math.round(size * 0.175),
              letterSpacing: "0.17em",
              textTransform: "uppercase",
              color: subColor,
              whiteSpace: "nowrap",
            }}>ERP Modular</span>
            <span style={{
              display: "inline-block",
              width: Math.round(size * 0.15), height: 1.5,
              background: lineColor, borderRadius: 1, flexShrink: 0,
            }} />
          </div>

          {tagline && (
            <div style={{
              fontWeight: 500,
              fontSize:   Math.round(size * 0.145),
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: tagColor,
              marginTop: Math.round(size * 0.14),
              whiteSpace: "nowrap",
            }}>
              INTELIGENCIA · FUERZA · EVOLUCIÓN
            </div>
          )}
        </div>
      )}
    </div>
  );
}
