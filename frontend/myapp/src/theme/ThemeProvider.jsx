import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BASE_URL as API_BASE } from "../services/api";

// Catálogo de temas (id → etiqueta). "system" sigue el tema del sistema operativo.
export const TEMAS = [
  { id: "system",              label: "Seguir el sistema" },
  { id: "zeit-claro",          label: "ZEIT Claro" },
  { id: "zeit-oscuro",         label: "ZEIT Oscuro" },
  { id: "zeit-oscuro-energia", label: "ZEIT Oscuro Energía" },
  { id: "zeit-turquesa",       label: "ZEIT Turquesa" },
  { id: "zeit-grafito",        label: "ZEIT Grafito" },
];

const TEMAS_VALIDOS = TEMAS.map((t) => t.id);
const STORAGE_KEY = "zeit_tema";

// Resuelve el tema efectivo (si es "system", mira la preferencia del SO).
function resolverEfectivo(tema) {
  if (tema === "system") {
    const oscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return oscuro ? "zeit-oscuro" : "zeit-claro";
  }
  return tema;
}

// Aplica el tema efectivo al <html> (usado también por el script anti-parpadeo).
export function aplicarTema(temaEfectivo) {
  document.documentElement.dataset.theme = temaEfectivo;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return TEMAS_VALIDOS.includes(guardado) ? guardado : "system";
  });

  const [temaEfectivo, setTemaEfectivo] = useState(() => resolverEfectivo(tema));

  // Aplica el tema efectivo y lo persiste localmente cuando cambia la preferencia.
  useEffect(() => {
    const efectivo = resolverEfectivo(tema);
    setTemaEfectivo(efectivo);
    aplicarTema(efectivo);
    localStorage.setItem(STORAGE_KEY, tema);
  }, [tema]);

  // Si el usuario eligió "seguir el sistema", reacciona a los cambios del SO.
  useEffect(() => {
    if (tema !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => {
      const efectivo = resolverEfectivo("system");
      setTemaEfectivo(efectivo);
      aplicarTema(efectivo);
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [tema]);

  // Al montar con sesión activa, traer el tema guardado en la cuenta (US2).
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    fetch(`${API_BASE}/auth/me/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (prefs && TEMAS_VALIDOS.includes(prefs.tema)) setTemaState(prefs.tema);
      })
      .catch(() => { /* sin red: se queda el caché local */ });
  }, []);

  const setTema = useCallback((nuevo) => {
    if (!TEMAS_VALIDOS.includes(nuevo)) return;
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
