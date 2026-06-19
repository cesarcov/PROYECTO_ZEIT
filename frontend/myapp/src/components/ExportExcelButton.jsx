import { useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Botón reutilizable para descargar un endpoint como archivo Excel (.xlsx).
 *
 * Props:
 *   url       — ruta del endpoint (ej: "/logistics/materials/export")
 *   filename  — nombre sugerido para el archivo descargado
 *   label     — texto del botón (por defecto "Exportar Excel")
 *   params    — URLSearchParams o string de query opcionales (ej: "?status=ACTIVO")
 */
export default function ExportExcelButton({ url, filename = "export.xlsx", label = "Exportar Excel", params = "" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      const query = params ? (params.startsWith("?") ? params : `?${params}`) : "";
      const res = await fetch(`${API}${url}${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e.message || "Error al exportar");
      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={handleExport}
        disabled={loading}
        title="Exportar como Excel"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          background: loading ? "#F3F4F6" : "white",
          color: loading ? "#9CA3AF" : "#0B2E33",
          border: "1.5px solid #B8E3E9",
          borderRadius: 9,
          fontSize: 13, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = "#EEF7F8"; e.currentTarget.style.borderColor = "#4F7C82"; } }}
        onMouseLeave={(e) => { e.currentTarget.style.background = loading ? "#F3F4F6" : "white"; e.currentTarget.style.borderColor = "#B8E3E9"; }}
      >
        {loading ? (
          <>
            <span style={{ fontSize: 14, animation: "spin 1s linear infinite" }}>⟳</span>
            Exportando…
          </>
        ) : (
          <>
            <span style={{ fontSize: 15 }}>⬇</span>
            {label}
          </>
        )}
      </button>

      {error && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 8, padding: "8px 12px",
          color: "#DC2626", fontSize: 12, whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
