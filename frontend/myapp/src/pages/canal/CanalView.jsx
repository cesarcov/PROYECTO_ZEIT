import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { useAuth, formatUsername } from "../../hooks/useAuth";

import { BASE_URL as API } from "../../services/api";

// ── Constantes de dominio ─────────────────────────────────────────────────────

const MODULE_LABELS = {
  operations:     "Operaciones",
  logistics:      "Logística",
  administracion: "Administración",
  admin:          "Admin. Maestro",
};

const PRIORITY_CFG = {
  URGENTE: { bg: "#FEE2E2", color: "#DC2626", label: "Urgente" },
  ALTA:    { bg: "#FEF3C7", color: "#D97706", label: "Alta" },
  NORMAL:  { bg: "#DBEAFE", color: "#2563EB", label: "Normal" },
  BAJA:    { bg: "#F1F5F9", color: "#64748B", label: "Baja" },
};

const STATUS_CFG = {
  PENDIENTE:   { bg: "#FEF3C7", color: "#D97706", label: "Pendiente" },
  EN_REVISION: { bg: "#DBEAFE", color: "#2563EB", label: "En revisión" },
  RESUELTO:    { bg: "#DCFCE7", color: "#16A34A", label: "Resuelto" },
  RECHAZADO:   { bg: "#FEE2E2", color: "#DC2626", label: "Rechazado" },
  CANCELADO:   { bg: "#F1F5F9", color: "#64748B", label: "Cancelado" },
};

const TO_MODULE_OPTIONS = [
  { value: "operations",     label: "Operaciones" },
  { value: "logistics",      label: "Logística" },
  { value: "administracion", label: "Administración" },
  { value: "admin",          label: "Admin. Maestro" },
];

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function Badge({ cfg }) {
  if (!cfg) return null;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: "2px 9px", borderRadius: 20,
      fontSize: 11, fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function btn(bg = "#4F7C82", color = "#fff") {
  return {
    padding: "7px 16px", borderRadius: 8, border: "none",
    background: bg, color, cursor: "pointer", fontWeight: 600,
    fontSize: 13,
  };
}

const inpStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 7,
  border: "1px solid #D1D5DB", fontSize: 13,
  boxSizing: "border-box",
};

// ── Modal: Nueva Solicitud ────────────────────────────────────────────────────

function NuevaSolicitudModal({ token, myModule, onClose, onCreated }) {
  const [toModule, setToModule]     = useState("");
  const [subject,  setSubject]      = useState("");
  const [desc,     setDesc]         = useState("");
  const [priority, setPriority]     = useState("NORMAL");
  const [loading,  setLoading]      = useState(false);
  const [err,      setErr]          = useState("");

  const availableTargets = TO_MODULE_OPTIONS.filter(o => o.value !== myModule);

  const submit = async () => {
    if (!toModule) return setErr("Selecciona un módulo destino");
    if (!subject.trim()) return setErr("El asunto es obligatorio");
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${API}/canal/solicitudes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to_module: toModule, subject: subject.trim(), description: desc.trim() || null, priority }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Error al crear");
      onCreated(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0B2E33, #1a4a52)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#B8E3E9", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>CANAL INTER-MÓDULO</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginTop: 2 }}>Nueva solicitud</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#B8E3E9", cursor: "pointer", padding: "5px 11px", fontSize: 18 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Módulo destino *</label>
              <select value={toModule} onChange={e => setToModule(e.target.value)} style={inpStyle}>
                <option value="">Seleccionar...</option>
                {availableTargets.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Prioridad</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={inpStyle}>
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Asunto *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Solicitud de compra de EPPs para proyecto X"
              style={inpStyle}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Descripción (opcional)</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Detalla la solicitud, urgencia, cantidades, etc."
              rows={4}
              style={{ ...inpStyle, resize: "vertical" }}
            />
          </div>

          {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 12px" }}>{err}</p>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={btn("#F1F5F9", "#374151")}>Cancelar</button>
            <button onClick={submit} disabled={loading} style={btn("#0B2E33")}>
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel de Detalle ──────────────────────────────────────────────────────────

function SolicitudDetail({ solicitud: init, token, myModule, username, onClose, onUpdated }) {
  const [sol,      setSol]      = useState(init);
  const [mensaje,  setMensaje]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [companyUsers, setCompanyUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/canal/solicitudes/${init.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setSol(await r.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [init.id, token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API}/planificacion/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(setCompanyUsers)
      .catch(console.error);
  }, [token]);

  const sendMensaje = async () => {
    if (!mensaje.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/canal/solicitudes/${sol.id}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensaje: mensaje.trim() }),
      });
      if (r.ok) {
        setMensaje("");
        await load();
        onUpdated();
      }
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const changeStatus = async (status) => {
    try {
      const r = await fetch(`${API}/canal/solicitudes/${sol.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (r.ok) { await load(); onUpdated(); }
    } catch { /* silent */ }
  };

  const assignRequest = async (assignedTo) => {
    try {
      const r = await fetch(`${API}/canal/solicitudes/${sol.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assigned_to: assignedTo }),
      });
      if (r.ok) {
        await load();
        onUpdated();
      }
    } catch { /* silent */ }
  };

  const CANAL_GROUP_MEMBERS = {
    administracion: ["juliet_alvis", "yasmyn_machuca"],
    operations:     ["wilfredo_flores", "cesar_huamani", "felipe_choque", "lagartija_segura"],
    logistics:      ["cesar_huamani", "tiburoncito_junior"],
    gerente:        ["frank_sonco"],
    admin:          ["admin"],
  };

  const isBoss = (sol.to_module === "administracion" && username === "juliet_alvis") ||
                 (sol.to_module === "operations" && username === "wilfredo_flores") ||
                 (sol.to_module === "logistics" && username === "cesar_huamani") ||
                 (sol.to_module === "gerente" && username === "frank_sonco") ||
                 myModule === "admin";

  const isSender = sol.created_by_username === username;
  const isAssignee = sol.assigned_to_username === username;

  const canReply = isSender || isBoss || isAssignee;
  const canAct = (isBoss || isAssignee) && !["RESUELTO", "RECHAZADO", "CANCELADO"].includes(sol.status);
  const canCancel = sol.from_module === myModule && sol.status === "PENDIENTE";

  const sc  = STATUS_CFG[sol.status]   ?? STATUS_CFG.PENDIENTE;
  const pc  = PRIORITY_CFG[sol.priority] ?? PRIORITY_CFG.NORMAL;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>

      <div style={{ background: "#fff", borderRadius: 16, width: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0B2E33, #1a4a52)", padding: "18px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#B8E3E9", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>{sol.code}</div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, marginTop: 3, maxWidth: 500 }}>{sol.subject}</div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#B8E3E9", cursor: "pointer", padding: "5px 11px", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Badge cfg={sc} />
            <Badge cfg={pc} />
            <span style={{ color: "#93B1B5", fontSize: 12 }}>
              {MODULE_LABELS[sol.from_module] || sol.from_module} → {MODULE_LABELS[sol.to_module] || sol.to_module}
            </span>
            <span style={{ color: "#93B1B5", fontSize: 11 }}>· {fmtDate(sol.created_at)}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Asignación */}
          <div style={{ padding: "12px 24px", background: "#EEF7F8", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0B2E33" }}>Responsable del Caso:</span>
              {isBoss ? (
                <select
                  value={sol.assigned_to || ""}
                  onChange={(e) => assignRequest(e.target.value || null)}
                  style={{
                    border: "1px solid #B8E3E9", borderRadius: 8, padding: "3px 8px",
                    fontSize: 12, background: "white", outline: "none", color: "#0B2E33",
                    fontWeight: 600
                  }}
                >
                  <option value="">— Sin asignar —</option>
                  {companyUsers
                    .filter(u => CANAL_GROUP_MEMBERS[sol.to_module]?.includes(u.username))
                    .map(u => (
                      <option key={u.id} value={u.id}>{formatUsername(u.username)}</option>
                    ))
                  }
                </select>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {sol.assigned_to_username ? `👤 ${formatUsername(sol.assigned_to_username)}` : "⚠️ Sin asignar"}
                </span>
              )}
            </div>
            {sol.assigned_to_username && (
              <span style={{ fontSize: 11, color: "#6B7280" }}>
                Asignado para resolución
              </span>
            )}
          </div>

          {/* Descripción */}
          {sol.description && (
            <div style={{ padding: "16px 24px", background: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Descripción</div>
              <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sol.description}</p>
            </div>
          )}

          {/* Acciones de estado */}
          {(canAct || canCancel) && (
            <div style={{ padding: "12px 24px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#94A3B8", alignSelf: "center", marginRight: 4 }}>Cambiar estado:</span>
              {canAct && sol.status !== "EN_REVISION" && (
                <button onClick={() => changeStatus("EN_REVISION")} style={{ ...btn("#DBEAFE", "#1E40AF"), fontSize: 12 }}>En revisión</button>
              )}
              {canAct && (
                <button onClick={() => changeStatus("RESUELTO")} style={{ ...btn("#DCFCE7", "#15803D"), fontSize: 12 }}>Marcar resuelto</button>
              )}
              {canAct && (
                <button onClick={() => changeStatus("RECHAZADO")} style={{ ...btn("#FEE2E2", "#DC2626"), fontSize: 12 }}>Rechazar</button>
              )}
              {canCancel && (
                <button onClick={() => changeStatus("CANCELADO")} style={{ ...btn("#F1F5F9", "#64748B"), fontSize: 12 }}>Cancelar solicitud</button>
              )}
            </div>
          )}

          {/* Hilo de mensajes */}
          <div style={{ flex: 1, padding: "16px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              Conversación {loading ? "" : `(${sol.mensajes?.length ?? 0} mensajes)`}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#9CA3AF", padding: 24 }}>Cargando...</div>
            ) : (sol.mensajes ?? []).length === 0 ? (
              <div style={{ textAlign: "center", color: "#9CA3AF", padding: 24, background: "#F9FAFB", borderRadius: 10 }}>
                Sin mensajes aún. Sé el primero en responder.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(sol.mensajes ?? []).map(m => (
                  <div key={m.id} style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px", borderLeft: "3px solid #4F7C82" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0B2E33" }}>{formatUsername(m.username) || "Usuario"}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{fmtDate(m.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.mensaje}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Responder */}
          {canReply && !["RESUELTO", "RECHAZADO", "CANCELADO"].includes(sol.status) && (
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E5E7EB", flexShrink: 0, background: "#fff" }}>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                placeholder="Escribe una respuesta o comentario..."
                rows={3}
                style={{ ...inpStyle, resize: "none", marginBottom: 8 }}
                onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) sendMensaje(); }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={sendMensaje} disabled={sending || !mensaje.trim()} style={{ ...btn("#4F7C82"), opacity: mensaje.trim() ? 1 : 0.5 }}>
                  {sending ? "Enviando..." : "Responder"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Tarjeta de solicitud ──────────────────────────────────────────────────────

function SolicitudCard({ sol, myModule, onClick }) {
  const sc = STATUS_CFG[sol.status]    ?? STATUS_CFG.PENDIENTE;
  const pc = PRIORITY_CFG[sol.priority] ?? PRIORITY_CFG.NORMAL;
  const isIncoming = sol.to_module === myModule;

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
        padding: "14px 18px", cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        borderLeft: `4px solid ${pc.color}`,
        transition: "box-shadow 0.15s, transform 0.1s",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>{sol.code}</span>
            <span style={{ fontSize: 10, background: isIncoming ? "#EFF6FF" : "#F0FDF4", color: isIncoming ? "#3B82F6" : "#16A34A", padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>
              {isIncoming ? `← De: ${MODULE_LABELS[sol.from_module] || sol.from_module}` : `→ Para: ${MODULE_LABELS[sol.to_module] || sol.to_module}`}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0B2E33", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sol.subject}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            Por: {formatUsername(sol.created_by_username) || "—"} · {fmtDate(sol.updated_at)}
            {sol.message_count > 0 && <span style={{ marginLeft: 8, background: "#F0F9FA", color: "#4F7C82", padding: "1px 7px", borderRadius: 20, fontWeight: 600 }}>💬 {sol.message_count}</span>}
            {sol.assigned_to_username && <span style={{ marginLeft: 8, background: "#EEF7F8", color: "#0B2E33", padding: "1px 7px", borderRadius: 20, fontWeight: 600 }}>👤 {formatUsername(sol.assigned_to_username)}</span>}
          </div>

        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignItems: "flex-end" }}>
          <Badge cfg={sc} />
          <Badge cfg={pc} />
        </div>
      </div>
    </div>
  );
}

// ── Vista principal ────────────────────────────────────────────────────────────

export default function CanalView() {
  const auth  = useAuth();
  const token = localStorage.getItem("access_token");
  const myModule = auth.role;

  const [solicitudes,  setSolicitudes]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState("recibidas");
  const [selected,     setSelected]     = useState(null);
  const [showNew,      setShowNew]      = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/canal/solicitudes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setSolicitudes(await r.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const recibidas = solicitudes.filter(s => (s.to_module === myModule || myModule === "admin") && s.status === "PENDIENTE");
    setPendingCount(recibidas.length);
  }, [solicitudes, myModule]);

  const recibidas = solicitudes.filter(s => s.to_module === myModule || (myModule === "admin" && s.to_module !== s.from_module));
  const enviadas  = solicitudes.filter(s => s.from_module === myModule);

  const displayed = tab === "recibidas" ? recibidas : enviadas;

  const pendRecibidas = recibidas.filter(s => s.status === "PENDIENTE").length;
  const pendEnviadas  = enviadas.filter(s => s.status === "PENDIENTE").length;

  return (
    <Layout>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
            {MODULE_LABELS[myModule] || myModule}
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0B2E33" }}>Canal Inter-Módulo</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
            Solicitudes y comunicación entre Operaciones, Logística y Administración
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ ...btn("#0B2E33"), display: "flex", alignItems: "center", gap: 6, paddingLeft: 14, paddingRight: 14 }}
        >
          <span style={{ fontSize: 16 }}>+</span> Nueva solicitud
        </button>
      </div>

      {/* ── KPI chips ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total recibidas",  value: recibidas.length,  color: "#3B82F6" },
          { label: "Pendientes tuyas", value: pendRecibidas,      color: "#D97706" },
          { label: "Enviadas",         value: enviadas.length,   color: "#4F7C82" },
          { label: "Resueltas",        value: solicitudes.filter(s => s.status === "RESUELTO").length, color: "#16A34A" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#F1F5F9", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[
          { key: "recibidas", label: "Recibidas", count: pendRecibidas },
          { key: "enviadas",  label: "Enviadas",  count: pendEnviadas  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? "#0B2E33" : "#64748B",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ background: "#EF4444", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Lista ──────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>Cargando solicitudes...</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "#F9FAFB", borderRadius: 12, border: "1px dashed #E5E7EB" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>
            {tab === "recibidas" ? "Sin solicitudes recibidas" : "No has enviado solicitudes aún"}
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            {tab === "recibidas"
              ? "Cuando otros módulos te envíen solicitudes aparecerán aquí."
              : "Usa «Nueva solicitud» para comunicarte con otro módulo."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {displayed.map(sol => (
            <SolicitudCard
              key={sol.id}
              sol={sol}
              myModule={myModule}
              onClick={() => setSelected(sol)}
            />
          ))}
        </div>
      )}

      {/* ── Modales ────────────────────────────────────────────── */}
      {showNew && (
        <NuevaSolicitudModal
          token={token}
          myModule={myModule}
          onClose={() => setShowNew(false)}
          onCreated={(newSol) => {
            setSolicitudes(prev => [newSol, ...prev]);
            setShowNew(false);
            setTab("enviadas");
          }}
        />
      )}

      {selected && (
        <SolicitudDetail
          solicitud={selected}
          token={token}
          myModule={myModule}
          username={auth.username}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}

    </Layout>
  );
}
