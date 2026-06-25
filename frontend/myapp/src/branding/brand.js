// Configuración de marca (white-label). Se resuelve desde el servidor al
// arrancar (GET /branding) con fallback a los defaults ZEIT. Editable por el
// admin desde el panel; ningún rebrand requiere tocar código.

import { BASE_URL as API_BASE } from "../services/api";

const DEFAULT_BRAND = {
  appName: "ZEIT SOLUTIONS",
  tagline: "Confiabilidad que impulsa la industria",
  logoIncluyeNombre: true,
  logoSrc: "/zeit-logo.png",        // fondo claro (público del frontend)
  logoSrcDark: "/zeit-logo-dark.png", // fondo oscuro
  logoIconSrc: "/zeit-logo-icon.png", // isotipo
  colors: {},
  poweredBy: "Powered by CeShark · ERP Engine",
  favicon: null,
};

function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem("brand_cache") || "null");
    if (c && typeof c === "object") return { ...DEFAULT_BRAND, ...c };
  } catch { /* cache inválido */ }
  return DEFAULT_BRAND;
}

let _resolved = loadCache();

export function getBrand() {
  return _resolved;
}

// Los logos subidos los sirve el backend; sus rutas deben ser absolutas.
const abs = (u) => (u && u.startsWith("/branding-assets")) ? (API_BASE + u) : u;

function mapServer(s) {
  const logos = s.logos || {};
  const hasLogo = !!(logos.claro || logos.oscuro);
  const isDefault = !s.appName && !hasLogo; // nada configurado → ZEIT puro
  return {
    appName: s.appName || DEFAULT_BRAND.appName,
    tagline: s.tagline || DEFAULT_BRAND.tagline,
    logoIncluyeNombre: s.logoIncluyeNombre !== false,
    logoSrc:     hasLogo ? abs(logos.claro || logos.oscuro) : (isDefault ? DEFAULT_BRAND.logoSrc : null),
    logoSrcDark: hasLogo ? abs(logos.oscuro || logos.claro) : (isDefault ? DEFAULT_BRAND.logoSrcDark : null),
    logoIconSrc: abs(logos.icono) || (isDefault ? DEFAULT_BRAND.logoIconSrc : null),
    colors: s.colors || {},
    poweredBy: s.poweredBy || DEFAULT_BRAND.poweredBy,
    favicon: abs(logos.favicon),
  };
}

// Aplica al DOM lo que no es React: título, favicon y colores corporativos.
export function applyBrand(b) {
  if (b.appName) document.title = b.appName;
  if (b.favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = b.favicon;
  }
  const root = document.documentElement.style;
  const c = b.colors || {};
  c.primary ? root.setProperty("--primary", c.primary) : root.removeProperty("--primary");
  c.accent  ? root.setProperty("--accent",  c.accent)  : root.removeProperty("--accent");
  c.action  ? root.setProperty("--action",  c.action)  : root.removeProperty("--action");
}

export async function loadBrandFromServer() {
  try {
    const res = await fetch(`${API_BASE}/branding`);
    if (res.ok) {
      _resolved = mapServer(await res.json());
      localStorage.setItem("brand_cache", JSON.stringify(_resolved));
    }
  } catch { /* sin red: queda el caché/default */ }
  applyBrand(_resolved);
  return _resolved;
}
