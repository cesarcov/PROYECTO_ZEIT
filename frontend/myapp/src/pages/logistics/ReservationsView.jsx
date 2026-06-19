import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_CFG = {
  BLOCKED:   { label: "Bloqueado",  bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308" },
  CONFIRMED: { label: "Confirmado", bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
  RELEASED:  { label: "Liberado",   bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" },
  EXPIRED:   { label: "Vencido",    bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
};

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || { label: status, bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function ExpiryCell({ expires_at, status }) {
  if (status !== "BLOCKED" || !expires_at) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const diff = (new Date(expires_at) - Date.now()) / 3600000;
  const color = diff < 0 ? "#DC2626" : diff < 4 ? "#D97706" : "#4B5563";
  return (
    <span style={{ fontSize: 12, fontWeight: diff < 4 ? 700 : 400, color }}>
      {diff < 0 ? "VENCIDA" : diff < 1 ? `${Math.round(diff * 60)}m` : `${diff.toFixed(1)}h`}
    </span>
  );
}

const FILTERS = ["TODOS", "BLOCKED", "CONFIRMED", "RELEASED", "EXPIRED"];
const FILTER_LABELS = { TODOS: "Todos", BLOCKED: "Bloqueados", CONFIRMED: "Confirmados", RELEASED: "Liberados", EXPIRED: "Vencidos" };

export default function ReservationsView() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("TODOS");
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/requests/reservations");
      setReservations(data);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "TODOS" ? reservations : reservations.filter((r) => r.status === filter);

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "TODOS" ? reservations.length : reservations.filter((r) => r.status === f).length;
    return acc;
  }, {});

  const doAction = async (id, action) => {
    setActionLoading(id + action);
    setError("");
    try {
      await apiFetch(`/requests/reservations/${id}/${action}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message || "Error al ejecutar la acción");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Reservas de Stock
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Gestión de reservas activas e historial
            </p>
          </div>
          <button
            onClick={load} disabled={loading}
            style={{ padding: "7px 16px", fontSize: 13, background: "white", border: "1px solid #E5E7EB", borderRadius: 8, color: "#374151", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, fontWeight: 500 }}
          >
            {loading ? "Cargando..." : "↻ Actualizar"}
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const s = STATUS_CFG[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  background: active ? (s ? s.bg : "#0B2E33") : "#F3F4F6",
                  color: active ? (s ? s.color : "white") : "#6B7280",
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {FILTER_LABELS[f]}
                <span style={{
                  marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 99,
                  background: active ? "rgba(0,0,0,0.1)" : "#E5E7EB",
                  color: active ? "inherit" : "#6B7280",
                }}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Tabla */}
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 100px 120px 120px 80px 120px", gap: 8, padding: "12px 20px", background: "#0B2E33" }}>
            {["Material", "Almacén", "Cant.", "Estado", "Reservado por", "Creado", "Vence en", "Acciones"].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando reservas...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Sin reservas {filter !== "TODOS" ? `en estado "${FILTER_LABELS[filter]}"` : ""}.
            </div>
          ) : (
            <div>
              {filtered.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 120px 80px 100px 120px 120px 80px 120px",
                    gap: 8, padding: "12px 20px", alignItems: "center",
                    borderBottom: idx < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                    background: idx % 2 === 0 ? "white" : "#FAFAFA",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F0F9FA"}
                  onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#FAFAFA"}
                >
                  <div style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>{r.material_name}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{r.warehouse_name}</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151" }}>{r.quantity}</div>
                  <div><StatusBadge status={r.status} /></div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{r.reserved_by}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{fmt(r.created_at)}</div>
                  <div><ExpiryCell expires_at={r.expires_at} status={r.status} /></div>
                  <div>
                    {r.status === "BLOCKED" && (
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          onClick={() => doAction(r.id, "confirm")}
                          disabled={!!actionLoading}
                          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#DCFCE7", color: "#166534", border: "1px solid #BBF7D0", borderRadius: 6, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.5 : 1 }}
                        >
                          {actionLoading === r.id + "confirm" ? "..." : "Confirmar"}
                        </button>
                        <button
                          onClick={() => doAction(r.id, "release")}
                          disabled={!!actionLoading}
                          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.5 : 1 }}
                        >
                          {actionLoading === r.id + "release" ? "..." : "Liberar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>
            {filtered.length} de {reservations.length} reservas
          </p>
        )}
      </div>
    </Layout>
  );
}
