// Configuración central de marca (white-label).
// Para reusar el ERP en OTRA empresa: cambiá estos valores y/o el logo aquí
// (o sobreescribilos en runtime con localStorage "brand_override" = JSON).
// No hace falta tocar el resto del código.
//
// NOTA: la edición desde el panel de administrador (subir/quitar logo y nombre)
// llega como feature propia (marca configurable / white-label).

const DEFAULT_BRAND = {
  appName: "ZEIT SOLUTIONS",
  // Partes del nombre para el logo SVG (soft = color atenuado, como la "E" gris).
  nameParts: [
    { text: "Z",  soft: false },
    { text: "E",  soft: true  },
    { text: "IT", soft: false },
  ],
  sub: "Solutions",
  tagline: "Confiabilidad que impulsa la industria",
  // Logo oficial (imagen, fondo transparente, servido desde public/).
  // Para otra empresa: reemplazá public/zeit-logo.png o cambiá esta ruta a null
  // (vuelve al SVG de respaldo).
  logoSrc: "/zeit-logo.png",          // logo para fondos CLAROS (texto azul)
  logoSrcDark: "/zeit-logo-dark.png", // logo para fondos OSCUROS (texto blanco)
  // Versión solo-ícono (globo) para espacios chicos (ej. sidebar colapsada).
  logoIconSrc: "/zeit-logo-icon.png",
  poweredBy: "Powered by CeShark · ERP Engine",
};

export function getBrand() {
  try {
    const ov = JSON.parse(localStorage.getItem("brand_override") || "null");
    if (ov && typeof ov === "object") return { ...DEFAULT_BRAND, ...ov };
  } catch { /* sin override válido */ }
  return DEFAULT_BRAND;
}
