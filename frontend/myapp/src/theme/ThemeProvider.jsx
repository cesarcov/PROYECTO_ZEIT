import { createContext, useContext, useEffect } from "react";
import { BASE_URL as API_BASE } from "../services/api";

// Tema único. El selector de apariencia fue eliminado; el ERP usa siempre modo claro.
export const TEMAS = [];

const TEMA_FIJO = "zeit-claro";

export function aplicarTema() {
  document.documentElement.dataset.theme = TEMA_FIJO;
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
  // Aplica el tema fijo al montar y carga tokens de branding.
  useEffect(() => {
    aplicarTema();

    fetch(`${API_BASE}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.colors) inyectarTokensBranding(data.colors);
      })
      .catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ tema: TEMA_FIJO, temaEfectivo: TEMA_FIJO, setTema: () => {}, temas: TEMAS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
