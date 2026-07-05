import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BASE_URL as API_BASE } from "../services/api";

// Catálogo de temas. Solo 2 opciones (constitución Art. 2).
export const TEMAS = [
  { id: "zeit-claro",  label: "Claro"  },
  { id: "zeit-oscuro", label: "Oscuro" },
];

const TEMAS_VALIDOS = new Set(TEMAS.map((t) => t.id));
const STORAGE_KEY = "zeit_tema";
const DEFAULT_TEMA = "zeit-claro";

// Aplica el tema efectivo al <html> (usado también por el script anti-parpadeo).
export function aplicarTema(temaEfectivo) {
  document.documentElement.dataset.theme = temaEfectivo;
}

// Inyecta los tokens de branding del admin como variables CSS en :root.
// Si un valor es null/undefined, limpia el override para que themes.css tome el default.
export function inyectarTokensBranding(colors) {
  if (!colors) return;
  const map = [
    ["--primary",    colors.primary],
    ["--accent",     colors.accent],
    ["--action",     colors.action],
    ["--text-muted", colors.textSecondary],
  ];
  for (const [prop, val] of map) {
    if (val) {
      document.documentElement.style.setProperty(prop, val);
    } else {
      document.documentElement.style.removeProperty(prop);
    }
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return TEMAS_VALIDOS.has(guardado) ? guardado : DEFAULT_TEMA;
  });

  const [temaEfectivo, setTemaEfectivo] = useState(tema);

  // Aplica el tema y persiste en localStorage cuando cambia.
  useEffect(() => {
    setTemaEfectivo(tema);
    aplicarTema(tema);
    localStorage.setItem(STORAGE_KEY, tema);
  }, [tema]);

  // Al montar: sincroniza preferencia del servidor + inyecta tokens de branding.
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    // Preferencia de tema guardada en la cuenta
    if (token) {
      fetch(`${API_BASE}/auth/me/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((prefs) => {
          if (prefs && TEMAS_VALIDOS.has(prefs.tema)) setTemaState(prefs.tema);
        })
        .catch(() => { /* sin red: se queda el caché local */ });
    }

    // Tokens de branding corporativo (público, sin auth)
    fetch(`${API_BASE}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.colors) inyectarTokensBranding(data.colors);
      })
      .catch(() => { /* falla silenciosa; themes.css provee los defaults */ });
  }, []);

  const setTema = useCallback((nuevo) => {
    if (!TEMAS_VALIDOS.has(nuevo)) return;
    setTemaState(nuevo);
    const token = localStorage.getItem("access_token");
    if (!token) return;
    fetch(`${API_BASE}/auth/me/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tema: nuevo }),
    }).catch(() => { /* se reintenta el próximo cambio; el caché local ya aplicó */ });
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, temaEfectivo, setTema, temas: TEMAS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
