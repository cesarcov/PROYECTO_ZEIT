// Única fuente de verdad para la URL del backend. En producción (Vercel) se
// inyecta vía VITE_API_URL; en desarrollo cae al backend local. Importar desde
// aquí en todo el frontend — no hardcodear IPs.
import { reportApiError } from "./observability.js";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/";
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = buildApiError(body, res);
    // Los 4xx son errores esperados del usuario; sólo se reportan los 5xx.
    if (res.status >= 500) reportApiError(error);
    throw error;
  }

  return res.json();
}

// El backend devuelve un sobre único: {error:{code,message,request_id}} (F-000/T-03).
// `detail` se mantiene sólo por compatibilidad con las pantallas que aún no migran.
// El requestId viaja en el Error para que el usuario pueda reportarlo al soporte.
export function buildApiError(body, res) {
  const envelope = body?.error ?? {};
  const mensaje = envelope.message || body?.detail || `Error ${res.status}`;
  const error = new Error(mensaje);
  error.code = envelope.code ?? "http_error";
  error.status = res.status;
  error.requestId = envelope.request_id ?? res.headers.get("X-Request-ID") ?? null;
  error.details = envelope.details ?? null;
  return error;
}
