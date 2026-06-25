// Única fuente de verdad para la URL del backend. En producción (Vercel) se
// inyecta vía VITE_API_URL; en desarrollo cae al backend local. Importar desde
// aquí en todo el frontend — no hardcodear IPs.
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
    const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }

  return res.json();
}
