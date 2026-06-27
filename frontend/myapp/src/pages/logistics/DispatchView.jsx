import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch, BASE_URL as API } from "../../services/api";

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
      padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
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

const TABS = [
  { key: "ALL",        label: "Todos" },
  { key: "PENDING",    label: "Pendientes" },
  { key: "READY",      label: "Preparados" },
  { key: "IN_TRANSIT", label: "En tránsito" },
  { key: "DELIVERED",  label: "Entregados" },
];

// ── Create dispatch modal ──────────────────────────────────────────────────────
function CreateDispatchModal({ token, onClose, onCreated }) {
  const [reservations, setReservations] = useState([]);
  const [reservationId, setReservationId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/requests/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const confirmed = Array.isArray(data) ? data.filter(r => r.status === "CONFIRMED") : [];
        setReservations(confirmed);
      })
      .catch(() => setReservations([]));
  }, [token]);

  const submit = async () => {
    if (!reservationId) return setErr("Selecciona una reserva confirmada");
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API}/logistics/dispatches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reservation_id: reservationId, recipient_name: recipientName || null, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error al crear despacho");
      onCreated();
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
        background: "#fff", borderRadius: 12, padding: 28, width: 460,
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <h3 style={{ margin: "0 0 18px", color: "var(--primary)", fontSize: 17 }}>Nuevo despacho</h3>

        <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#4B5563" }}>
          Reserva confirmada *
        </label>
        <select
          value={reservationId}
          onChange={e => setReservationId(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #D1D5DB", marginBottom: 14, fontSize: 14 }}
        >
          <option value="">— seleccionar —</option>
          {reservations.map(r => (
            <option key={r.id} value={r.id}>
              {r.material_name} · {r.quantity} · {r.warehouse_name}
            </option>
          ))}
        </select>

        <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#4B5563" }}>
          Destinatario (nombre)
        </label>
        <input
          value={recipientName}
          onChange={e => setRecipientName(e.target.value)}
          placeholder="Nombre del receptor"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #D1D5DB", marginBottom: 14, fontSize: 14, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#4B5563" }}>
          Notas
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Observaciones del despacho..."
          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #D1D5DB", marginBottom: 14, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
        />

        {err && <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 20px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 14 }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              padding: "8px 20px", borderRadius: 7, border: "none",
              background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}
          >
            {loading ? "Creando..." : "Crear despacho"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm receipt modal (for logistics to mark IN_TRANSIT → workaround if needed) ──
function ConfirmNotes({ onClose, onConfirm }) {
  const [notes, setNotes] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 380, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 14px", color: "var(--primary)", fontSize: 16 }}>Confirmar acción</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Notas opcionales..."
          style={{ width: "100%", padding: 9, borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, resize: "vertical", boxSizing: "border-box", marginBottom: 14 }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => onConfirm(notes)} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: "#22C55E", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DispatchView() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const [dispatches, setDispatches]     = useState([]);
  const [projects, setProjects]         = useState([]);
  const [tab, setTab]                   = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  const [loading, setLoading]           = useState(true);
  const [showCreate, setShowCreate]     = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [actionErr, setActionErr]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dispRes, projRes] = await Promise.allSettled([
        fetch(`${API}/logistics/dispatches`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        apiFetch("/logistics/projects"),
      ]);
      if (dispRes.status  === "fulfilled") setDispatches(Array.isArray(dispRes.value) ? dispRes.value : []);
      if (projRes.status  === "fulfilled") setProjects(Array.isArray(projRes.value) ? projRes.value : []);
    } catch {
      setDispatches([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const visible = (tab === "ALL" ? dispatches : dispatches.filter(d => d.status === tab))
    .filter(d => !projectFilter || d.project_id === projectFilter);

  const moveStatus = async (dispatch_id, status) => {
    setActionErr("");
    try {
      const res = await fetch(`${API}/logistics/dispatches/${dispatch_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error");
      load();
    } catch (e) {
      setActionErr(e.message);
    }
  };

  const confirmAction = async (notes) => {
    setConfirmModal(null);
    if (!confirmModal) return;
    if (confirmModal.action === "IN_TRANSIT") {
      await moveStatus(confirmModal.dispatch_id, "IN_TRANSIT");
    }
  };

  const palette = { deep: "var(--primary)", dark: "var(--primary)", mid: "#93B1B5", light: "rgba(199,210,229,0.85)" };

  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F8FAFC" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: palette.deep }}>Despachos</h1>
            <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>
              Gestión del flujo de despacho de materiales
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {projects.length > 0 && (
              <>
                <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                  style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", background: "white", cursor: "pointer" }}>
                  <option value="">Todos los proyectos</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
                {projectFilter && (
                  <button onClick={() => navigate(`/logistics/projects/${projectFilter}`)}
                    style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", background: palette.deep, color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
                    Ver 360° →
                  </button>
                )}
              </>
            )}
            <button onClick={() => setShowCreate(true)}
              style={{ background: palette.dark, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              + Nuevo despacho
            </button>
          </div>
        </div>

        {actionErr && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            {actionErr}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: tab === t.key ? palette.deep : "#fff",
                color: tab === t.key ? "#fff" : "#4B5563",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {t.label}
              {t.key !== "ALL" && (
                <span style={{
                  marginLeft: 6, background: tab === t.key ? "rgba(255,255,255,0.2)" : "#E5E7EB",
                  color: tab === t.key ? "#fff" : "#374151",
                  borderRadius: 10, padding: "1px 7px", fontSize: 11,
                }}>
                  {dispatches.filter(d => d.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 1fr 0.8fr 1.2fr 1fr 1fr 120px",
            background: palette.deep, color: "rgba(199,210,229,0.85)",
            padding: "11px 20px", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px",
          }}>
            <span>MATERIAL</span>
            <span>ALMACÉN</span>
            <span>CANTIDAD</span>
            <span>DESTINATARIO</span>
            <span>ESTADO</span>
            <span>FECHA</span>
            <span>ACCIONES</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Cargando...</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              No hay despachos en esta categoría
            </div>
          ) : (
            visible.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 1fr 0.8fr 1.2fr 1fr 1fr 120px",
                  padding: "13px 20px",
                  alignItems: "center",
                  borderBottom: "1px solid #F1F5F9",
                  background: i % 2 === 0 ? "#fff" : "#FAFBFC",
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#1E293B" }}>{d.material_name ?? "—"}</div>
                  <div style={{ color: "#94A3B8", fontSize: 11 }}>{d.material_code ?? ""}</div>
                </div>
                <span style={{ color: "#475569" }}>{d.warehouse_name ?? "—"}</span>
                <span style={{ fontWeight: 600, color: "var(--primary)" }}>{d.quantity ?? "—"}</span>
                <div>
                  <div style={{ color: "#1E293B" }}>{d.recipient_name ?? d.recipient_username ?? "—"}</div>
                </div>
                <StatusBadge status={d.status} />
                <span style={{ color: "#64748B", fontSize: 12 }}>{fmt(d.created_at)}</span>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 5 }}>
                  {d.status === "PENDING" && (
                    <button
                      onClick={() => moveStatus(d.id, "READY")}
                      style={{
                        padding: "5px 10px", fontSize: 11, fontWeight: 600,
                        borderRadius: 6, border: "none", cursor: "pointer",
                        background: "#DBEAFE", color: "#1E40AF",
                      }}
                    >
                      Preparar
                    </button>
                  )}
                  {d.status === "READY" && (
                    <button
                      onClick={() => setConfirmModal({ dispatch_id: d.id, action: "IN_TRANSIT" })}
                      style={{
                        padding: "5px 10px", fontSize: 11, fontWeight: 600,
                        borderRadius: 6, border: "none", cursor: "pointer",
                        background: "#FEE2E2", color: "#991B1B",
                      }}
                    >
                      Enviar
                    </button>
                  )}
                  {d.status === "IN_TRANSIT" && (
                    <span style={{ color: "#94A3B8", fontSize: 11 }}>En camino...</span>
                  )}
                  {d.status === "DELIVERED" && (
                    <span style={{ color: "#16A34A", fontSize: 11 }}>✓ Entregado</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes section per dispatch if expanded — simple approach: show on last delivered */}
        {visible.some(d => d.receipt_notes) && (
          <div style={{ marginTop: 16 }}>
            {visible.filter(d => d.receipt_notes).map(d => (
              <div key={`notes-${d.id}`} style={{
                background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8,
                padding: "10px 14px", marginBottom: 8, fontSize: 13,
              }}>
                <strong style={{ color: "#166534" }}>{d.material_name}</strong>
                <span style={{ color: "#4B5563", marginLeft: 8 }}>→ {d.receipt_notes}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateDispatchModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {confirmModal && (
        <ConfirmNotes
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmAction}
        />
      )}
    </Layout>
  );
}
