import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";

import { BASE_URL as API } from "../../services/api";

const STATUS_CFG = {
  PENDING:    { label: "Pendiente",    bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308" },
  READY:      { label: "Preparado",   bg: "#DBEAFE", color: "#1E40AF", dot: "#3B82F6" },
  IN_TRANSIT: { label: "En tránsito", bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  DELIVERED:  { label: "Entregado",   bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: "#F3F4F6", color: "#374151", dot: "#9CA3AF" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: cfg.bg, color: cfg.color,
      padding: "3px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

// ── Confirm receipt modal ─────────────────────────────────────────────────────
function ConfirmModal({ dispatch, onClose, onConfirmed }) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const token = localStorage.getItem("access_token");

  const submit = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API}/logistics/dispatches/${dispatch.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receipt_notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error al confirmar");
      onConfirmed();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28, width: 420,
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <h3 style={{ margin: "0 0 6px", color: "#0B2E33", fontSize: 17 }}>Confirmar recepción</h3>
        <p style={{ margin: "0 0 18px", color: "#64748B", fontSize: 13 }}>
          {dispatch.material_name} · {dispatch.quantity} unidades
        </p>

        <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#4B5563" }}>
          Notas de recepción (opcional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Estado de los materiales recibidos, observaciones..."
          style={{
            width: "100%", padding: "8px 10px", borderRadius: 7,
            border: "1px solid #D1D5DB", fontSize: 14, resize: "vertical",
            marginBottom: 14, boxSizing: "border-box",
          }}
        />

        {err && <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px", borderRadius: 7, border: "1px solid #D1D5DB",
              background: "#fff", cursor: "pointer", fontSize: 14,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              padding: "8px 20px", borderRadius: 7, border: "none",
              background: "#22C55E", color: "#fff", cursor: "pointer",
              fontSize: 14, fontWeight: 700,
            }}
          >
            {loading ? "Confirmando..." : "Confirmar recepción"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delivery card ─────────────────────────────────────────────────────────────
function DeliveryCard({ d, onConfirm }) {
  const palette = { deep: "#0B2E33", dark: "#4F7C82", light: "#B8E3E9" };
  const isActive = d.status !== "DELIVERED";

  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      borderLeft: `4px solid ${isActive ? "#4F7C82" : "#22C55E"}`,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: palette.deep }}>{d.material_name ?? "—"}</div>
          <div style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{d.material_code ?? ""}</div>
        </div>
        <StatusBadge status={d.status} />
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 13,
      }}>
        <div>
          <span style={{ color: "#94A3B8", fontSize: 11, display: "block" }}>CANTIDAD</span>
          <span style={{ fontWeight: 600, color: palette.deep }}>{d.quantity ?? "—"}</span>
        </div>
        <div>
          <span style={{ color: "#94A3B8", fontSize: 11, display: "block" }}>ALMACÉN</span>
          <span style={{ color: "#475569" }}>{d.warehouse_name ?? "—"}</span>
        </div>
        <div>
          <span style={{ color: "#94A3B8", fontSize: 11, display: "block" }}>SOLICITADO</span>
          <span style={{ color: "#475569" }}>{fmt(d.created_at)}</span>
        </div>
        {d.dispatched_at && (
          <div>
            <span style={{ color: "#94A3B8", fontSize: 11, display: "block" }}>ENVIADO</span>
            <span style={{ color: "#475569" }}>{fmt(d.dispatched_at)}</span>
          </div>
        )}
        {d.delivered_at && (
          <div>
            <span style={{ color: "#94A3B8", fontSize: 11, display: "block" }}>ENTREGADO</span>
            <span style={{ color: "#16A34A", fontWeight: 600 }}>{fmt(d.delivered_at)}</span>
          </div>
        )}
      </div>

      {d.notes && (
        <div style={{
          background: "#F8FAFC", borderRadius: 7, padding: "8px 12px",
          fontSize: 13, color: "#4B5563", borderLeft: "3px solid #93B1B5",
        }}>
          {d.notes}
        </div>
      )}

      {d.receipt_notes && (
        <div style={{
          background: "#F0FDF4", borderRadius: 7, padding: "8px 12px",
          fontSize: 13, color: "#166534", borderLeft: "3px solid #22C55E",
        }}>
          <strong>Nota de recepción:</strong> {d.receipt_notes}
        </div>
      )}

      {d.status === "IN_TRANSIT" && (
        <button
          onClick={() => onConfirm(d)}
          style={{
            marginTop: 4, padding: "10px 0", borderRadius: 8, border: "none",
            background: "#22C55E", color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: "pointer", width: "100%",
          }}
        >
          ✓ Confirmar recepción
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MyDeliveries() {
  const token = localStorage.getItem("access_token");
  const [deliveries, setDeliveries] = useState([]);
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/requests/dispatches/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDeliveries(Array.isArray(data) ? data : []);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const active = deliveries.filter(d => d.status !== "DELIVERED");
  const done   = deliveries.filter(d => d.status === "DELIVERED");
  const visible = tab === "active" ? active : done;

  const palette = { deep: "#0B2E33", dark: "#4F7C82" };

  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F0F9FA" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: palette.deep }}>Mis entregas</h1>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>
            Materiales despachados asignados a ti
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "En camino", value: active.filter(d => d.status === "IN_TRANSIT").length, color: "#EF4444" },
            { label: "Preparados", value: active.filter(d => d.status === "READY").length, color: "#3B82F6" },
            { label: "Entregados", value: done.length, color: "#22C55E" },
          ].map(k => (
            <div key={k.label} style={{
              background: "#fff", borderRadius: 10, padding: "16px 20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderTop: `3px solid ${k.color}`,
            }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[
            { key: "active", label: `Activos (${active.length})` },
            { key: "done",   label: `Historial (${done.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 20px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: tab === t.key ? palette.deep : "#fff",
                color: tab === t.key ? "#fff" : "#4B5563",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Cargando...</div>
        ) : visible.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 40, textAlign: "center",
            color: "#9CA3AF", fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          }}>
            {tab === "active"
              ? "No tienes entregas pendientes"
              : "No hay entregas completadas aún"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {visible.map(d => (
              <DeliveryCard key={d.id} d={d} onConfirm={setConfirmTarget} />
            ))}
          </div>
        )}
      </div>

      {confirmTarget && (
        <ConfirmModal
          dispatch={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={() => { setConfirmTarget(null); load(); }}
        />
      )}
    </Layout>
  );
}
