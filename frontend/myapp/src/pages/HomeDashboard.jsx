import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { useAuth, formatUsername } from "../hooks/useAuth";
import { apiFetch } from "../services/api";

const PRIORIDAD_COLOR = { Alta: "#EF4444", Media: "#EAB308", Baja: "#22C55E" };
const ESTADO_COLOR    = { "Completado": "#22C55E", "Retraso": "#EF4444", "En espera": "#EAB308", "En Progreso": "#003A8C" };

const CANAL_MODULE_LABELS = {
  operations:     "Operaciones",
  logistics:      "Logística",
  administracion: "Administración",
  admin:          "Admin. Maestro",
};

const CANAL_PRIORITY_CFG = {
  URGENTE: { bg: "#FEE2E2", color: "#DC2626", label: "Urgente" },
  ALTA:    { bg: "#FEF3C7", color: "#D97706", label: "Alta" },
  NORMAL:  { bg: "#DBEAFE", color: "var(--primary)", label: "Normal" },
  BAJA:    { bg: "#F1F5F9", color: "#64748B", label: "Baja" },
};

const CANAL_STATUS_CFG = {
  PENDIENTE:   { bg: "#FEF3C7", color: "#D97706", label: "Pendiente" },
  EN_REVISION: { bg: "#DBEAFE", color: "var(--primary)", label: "En revisión" },
  RESUELTO:    { bg: "#DCFCE7", color: "#16A34A", label: "Resuelto" },
  RECHAZADO:   { bg: "#FEE2E2", color: "#DC2626", label: "Rechazado" },
  CANCELADO:   { bg: "#F1F5F9", color: "#64748B", label: "Cancelado" },
};

function ProgressBar({ pct, color = "var(--primary)", height = 6 }) {
  return (
    <div style={{ width: "100%", background: "#E5E7EB", borderRadius: 99, height, overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 99,
        background: color,
        transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

// ── Modal: Nueva Solicitud ────────────────────────────────────────────────────
function NuevaSolicitudModal({ onClose, onCreated, myModule }) {
  const [toModule, setToModule]     = useState("");
  const [subject,  setSubject]      = useState("");
  const [desc,     setDesc]         = useState("");
  const [priority, setPriority]     = useState("NORMAL");
  const [loading,  setLoading]      = useState(false);
  const [err,      setErr]          = useState("");

  const TO_MODULE_OPTIONS = [
    { value: "operations",     label: "Operaciones" },
    { value: "logistics",      label: "Logística" },
    { value: "administracion", label: "Administración" },
    { value: "admin",          label: "Admin. Maestro" },
  ];

  const availableTargets = TO_MODULE_OPTIONS.filter(o => o.value !== myModule);

  const submit = async () => {
    if (!toModule) return setErr("Selecciona un módulo destino");
    if (!subject.trim()) return setErr("El asunto es obligatorio");
    setLoading(true); setErr("");
    try {
      const d = await apiFetch("/canal/solicitudes", {
        method: "POST",
        body: JSON.stringify({
          to_module: toModule,
          subject: subject.trim(),
          description: desc.trim() || null,
          priority
        }),
      });
      onCreated(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const btnStyle = (bg = "var(--primary)", color = "#fff") => ({
    padding: "7px 16px", borderRadius: 8, border: "none",
    background: bg, color, cursor: "pointer", fontWeight: 600,
    fontSize: 13,
  });

  const inpStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid #D1D5DB", fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-dark))", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#C7D2E5", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>CANAL INTER-MÓDULO</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginTop: 2 }}>Nueva solicitud</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#C7D2E5", cursor: "pointer", padding: "5px 11px", fontSize: 18 }}>✕</button>
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
            <button onClick={onClose} style={btnStyle("#F1F5F9", "#374151")}>Cancelar</button>
            <button onClick={submit} disabled={loading} style={btnStyle("var(--primary)")}>
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Detalle de Solicitud ──────────────────────────────────────────────
function SolicitudDetailModal({ solicitud: init, myModule, username, onClose, onUpdated }) {
  const [sol,      setSol]      = useState(init);
  const [mensaje,  setMensaje]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [companyUsers, setCompanyUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/canal/solicitudes/${init.id}`);
      setSol(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [init.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch("/planificacion/users")
      .then(setCompanyUsers)
      .catch(console.error);
  }, []);

  const sendMensaje = async () => {
    if (!mensaje.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/canal/solicitudes/${sol.id}/mensajes`, {
        method: "POST",
        body: JSON.stringify({ mensaje: mensaje.trim() }),
      });
      setMensaje("");
      await load();
      onUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      await apiFetch(`/canal/solicitudes/${sol.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      onUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const assignRequest = async (assignedTo) => {
    try {
      await apiFetch(`/canal/solicitudes/${sol.id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to: assignedTo }),
      });
      await load();
      onUpdated();
    } catch (e) {
      console.error(e);
    }
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

  const sc  = CANAL_STATUS_CFG[sol.status]   ?? CANAL_STATUS_CFG.PENDIENTE;
  const pc  = CANAL_PRIORITY_CFG[sol.priority] ?? CANAL_PRIORITY_CFG.NORMAL;

  const btnStyle = (bg = "var(--primary)", color = "#fff") => ({

    padding: "7px 16px", borderRadius: 8, border: "none",
    background: bg, color, cursor: "pointer", fontWeight: 600,
    fontSize: 13,
  });

  const inpStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid #D1D5DB", fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-dark))", padding: "18px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#C7D2E5", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>{sol.code}</div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, marginTop: 3, maxWidth: 500 }}>{sol.subject}</div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#C7D2E5", cursor: "pointer", padding: "5px 11px", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: sc.bg, color: sc.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
            <span style={{ background: pc.bg, color: pc.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{pc.label}</span>
            <span style={{ color: "#A7B6D0", fontSize: 12 }}>
              {CANAL_MODULE_LABELS[sol.from_module] || sol.from_module} → {CANAL_MODULE_LABELS[sol.to_module] || sol.to_module}
            </span>
            <span style={{ color: "#A7B6D0", fontSize: 11 }}>· {new Date(sol.created_at).toLocaleString("es-PE")}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Asignación */}
          <div style={{ padding: "12px 24px", background: "var(--primary-soft)", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>Responsable del Caso:</span>
              {isBoss ? (
                <select
                  value={sol.assigned_to || ""}
                  onChange={(e) => assignRequest(e.target.value || null)}
                  style={{
                    border: "1px solid #C7D2E5", borderRadius: 8, padding: "3px 8px",
                    fontSize: 12, background: "white", outline: "none", color: "var(--primary)",
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
                <button onClick={() => changeStatus("EN_REVISION")} style={{ ...btnStyle("#DBEAFE", "var(--primary)"), fontSize: 12 }}>En revisión</button>
              )}
              {canAct && (
                <button onClick={() => changeStatus("RESUELTO")} style={{ ...btnStyle("#DCFCE7", "#15803D"), fontSize: 12 }}>Marcar resuelto</button>
              )}
              {canAct && (
                <button onClick={() => changeStatus("RECHAZADO")} style={{ ...btnStyle("#FEE2E2", "#DC2626"), fontSize: 12 }}>Rechazar</button>
              )}
              {canCancel && (
                <button onClick={() => changeStatus("CANCELADO")} style={{ ...btnStyle("#F1F5F9", "#64748B"), fontSize: 12 }}>Cancelar solicitud</button>
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
                  <div key={m.id} style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px", borderLeft: "3px solid var(--primary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{formatUsername(m.username) || "Usuario"}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{new Date(m.created_at).toLocaleString("es-PE")}</span>
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
                <button onClick={sendMensaje} disabled={sending || !mensaje.trim()} style={{ ...btnStyle("var(--primary)"), opacity: mensaje.trim() ? 1 : 0.5 }}>
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

const USER_INFO_MAP = {
  admin:              { name: "TI - CeShark",       roles: ["Administrador Maestro"] },
  frank_sonco:        { name: "Frank Sonco",        roles: ["Gerente General"] },
  juliet_alvis:       { name: "Juliet Alvis",       roles: ["Administradora"] },
  yasmyn_machuca:     { name: "Yasmyn Machuca",     roles: ["Asistente de Administración"] },
  wilfredo_flores:    { name: "Wilfredo Flores",    roles: ["Jefe de Operaciones", "Ingeniero de Servicios"] },
  cesar_huamani:      { name: "Cesar Huamani",      roles: ["Jefe de Logística", "Ingeniero de Servicios Junior"] },
  felipe_choque:      { name: "Felipe Choque",      roles: ["Técnico de Servicios"] },
  lagartija_segura:   { name: "Lagartija Segura",   roles: ["Ingeniero de Seguridad"] },
  tiburoncito_junior: { name: "Tiburoncito Junior", roles: ["Asistente de Logística"] },
};

// ── Dashboard Principal ──────────────────────────────────────────────────────
export default function HomeDashboard() {
  const { username, role, userId } = useAuth();
  const userInfo = USER_INFO_MAP[username] || { name: formatUsername(username), roles: [role || "Usuario"] };
  const [actividades, setActividades]         = useState([]);
  const [actSeguimiento, setActSeguimiento]   = useState([]);
  const [loadingAct, setLoadingAct]           = useState(true);
  const [newSubtareas, setNewSubtareas]       = useState({});
  const [companyUsers, setCompanyUsers]       = useState([]);

  // Canal State
  const [solicitudes, setSolicitudes]     = useState([]);
  const [loadingCanal, setLoadingCanal]   = useState(true);
  const [canalTab, setCanalTab]           = useState("recibidas");
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [showNewSolicitud, setShowNewSolicitud]   = useState(false);

  const today = new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  async function loadAll() {
    setLoadingAct(true);
    setLoadingCanal(true);
    try {
      const [acts, actSeg, usrs, sols] = await Promise.all([
        apiFetch("/planificacion/actividades?solo_mias=true"),
        apiFetch("/planificacion/actividades?solo_seguimiento=true"),
        apiFetch("/planificacion/users"),
        apiFetch("/canal/solicitudes"),
      ]);
      setActividades(acts);
      setActSeguimiento(actSeg);
      setCompanyUsers(usrs);
      setSolicitudes(sols);
    } catch (e) {
      console.error("Error cargando inicio:", e);
    } finally {
      setLoadingAct(false);
      setLoadingCanal(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function toggleSubtarea(actId, subId) {
    try {
      const updatedSub = await apiFetch(`/planificacion/actividades/${actId}/subtareas/${subId}/toggle`, { method: "PATCH" });
      setActividades(prev => prev.map(a => {
        if (a.id !== actId) return a;
        const updatedSubs = a.subtareas.map(s => s.id === subId ? updatedSub : s);
        const done = updatedSubs.filter(s => s.culminado).length;
        const pct  = updatedSubs.length ? round2(done / updatedSubs.length * 100) : 0;
        return { ...a, subtareas: updatedSubs, progreso_pct: pct };
      }));
    } catch (e) { console.error(e); }
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  async function addSubtarea(actId) {
    const desc = (newSubtareas[actId] || "").trim();
    if (!desc) return;
    try {
      const sub = await apiFetch(`/planificacion/actividades/${actId}/subtareas`, {
        method: "POST", body: JSON.stringify({ descripcion: desc }),
      });
      setActividades(prev => prev.map(a => a.id !== actId ? a : { ...a, subtareas: [...a.subtareas, sub] }));
      setNewSubtareas(p => ({ ...p, [actId]: "" }));
    } catch (e) { console.error(e); }
  }

  async function assignSubtarea(actId, subId, responsableId) {
    try {
      const updatedSub = await apiFetch(`/planificacion/actividades/${actId}/subtareas/${subId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ responsable_id: responsableId }),
      });
      setActividades(prev => prev.map(a => {
        if (a.id !== actId) return a;
        return {
          ...a,
          subtareas: a.subtareas.map(s => s.id === subId ? updatedSub : s)
        };
      }));
    } catch (e) {
      console.error("Error asignando responsable a subtarea:", e);
    }
  }

  const greetHour = new Date().getHours();
  const greet = greetHour < 12 ? "Buenos días" : greetHour < 18 ? "Buenas tardes" : "Buenas noches";

  const canManageAct = (act) => {
    return role === "admin" || act.responsable_id === userId;
  };

  const canToggleSub = (act, sub) => {
    return role === "admin" || act.responsable_id === userId || sub.responsable_id === userId;
  };

  const recibidas = solicitudes.filter(s => s.to_module === role || (role === "admin" && s.to_module !== s.from_module));
  const enviadas  = solicitudes.filter(s => s.from_module === role);
  const displayedCanal = canalTab === "recibidas" ? recibidas : enviadas;

  const pendRecibidas = recibidas.filter(s => s.status === "PENDIENTE").length;
  const pendEnviadas  = enviadas.filter(s => s.status === "PENDIENTE").length;

  return (
    <Layout>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Cabecera ── */}
        <div style={{
          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
          borderRadius: 16, padding: "24px 32px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 4px 20px rgba(0,31,84,0.25)",
        }}>
          <div>
            <div style={{ color: "#C7D2E5", fontSize: 13, marginBottom: 4 }}>{today}</div>
            <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
              {greet}, <span style={{ color: "#C7D2E5" }}>{userInfo.name}</span>
            </h1>
            <div style={{ color: "rgba(199,210,229,0.75)", fontSize: 11, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              💼 {userInfo.roles.join(" / ")}
            </div>
            <p style={{ color: "rgba(199,210,229,0.6)", margin: "6px 0 0", fontSize: 13 }}>
              Aquí tienes tu resumen del día
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

          {/* ── Panel de Planificación ── */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)", margin: "0 0 14px" }}>
              Mi Planificación Semanal
            </h2>

            {loadingAct ? (
              <div style={{ color: "#9CA3AF", padding: "32px 0", textAlign: "center" }}>Cargando tareas...</div>
            ) : actividades.length === 0 ? (
              <div style={{ color: "#9CA3AF", padding: "32px 0", textAlign: "center", background: "#F9FAFB", borderRadius: 12, border: "1px dashed #E5E7EB" }}>
                No tienes tareas asignadas esta semana.
              </div>
            ) : actividades.map(act => (
              <div key={act.id} style={{
                background: "white", borderRadius: 14, padding: "18px 20px", marginBottom: 16,
                border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}>
                {/* Header tarjeta */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      {act.prioridad && (
                        <span style={{ background: PRIORIDAD_COLOR[act.prioridad] + "18", color: PRIORIDAD_COLOR[act.prioridad], padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                          {act.prioridad}
                        </span>
                      )}
                      <span style={{ background: (ESTADO_COLOR[act.estado] || "#003A8C") + "18", color: ESTADO_COLOR[act.estado] || "#003A8C", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                        {act.estado}
                      </span>
                      {act.etapa && (
                        <span style={{ background: "var(--primary-soft)", color: "var(--primary)", padding: "2px 8px", borderRadius: 99, fontSize: 11 }}>
                          {act.etapa}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", lineHeight: 1.3 }}>{act.tarea}</div>
                    {act.cliente && <div style={{ color: "#6B7280", fontSize: 12, marginTop: 3 }}>Cliente: {act.cliente}</div>}
                  </div>
                  {act.fecha_limite && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>Límite</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: new Date(act.fecha_limite) < new Date() && act.estado !== "Completado" ? "#EF4444" : "#374151" }}>
                        {new Date(act.fecha_limite + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Barra de progreso */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>Progreso</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{act.progreso_pct}%</span>
                  </div>
                  <ProgressBar pct={act.progreso_pct} color={act.progreso_pct >= 100 ? "#22C55E" : "var(--primary)"} height={7} />
                </div>

                {/* Subtareas */}
                {act.subtareas.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {act.subtareas.map(sub => (
                      <div key={sub.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 0", borderBottom: "1px solid #F3F4F6",
                      }}>
                        <input type="checkbox" checked={sub.culminado} onChange={() => toggleSubtarea(act.id, sub.id)}
                          disabled={!canToggleSub(act, sub)}
                          style={{ accentColor: "var(--primary)", width: 15, height: 15, cursor: canToggleSub(act, sub) ? "pointer" : "not-allowed" }}
                          title={!canToggleSub(act, sub) ? "Solo el responsable de la subtarea o el encargado de la actividad puede marcarla" : ""}
                        />
                        <span style={{ fontSize: 13, color: sub.culminado ? "#9CA3AF" : "#374151", textDecoration: sub.culminado ? "line-through" : "none", flex: 1 }}>
                          {sub.descripcion}
                        </span>

                        {/* Selector/Badge de Responsable */}
                        {canManageAct(act) ? (
                          <select
                            value={sub.responsable_id || ""}
                            onChange={(e) => assignSubtarea(act.id, sub.id, e.target.value || null)}
                            style={{
                              border: "1px solid #E5E7EB", borderRadius: 6, padding: "2px 6px",
                              fontSize: 11, color: "#374151", background: "white", outline: "none",
                              maxWidth: 140
                            }}
                          >
                            <option value="">👤 {formatUsername(act.responsable)} (General)</option>
                            {companyUsers.map(u => (
                              <option key={u.id} value={u.id}>{formatUsername(u.username)}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            background: "var(--primary-soft)", color: "var(--primary)",
                            padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            whiteSpace: "nowrap"
                          }}>
                            👤 {formatUsername(sub.responsable_username || act.responsable)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Nueva subtarea */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="+ Nueva subtarea..."
                    value={newSubtareas[act.id] || ""}
                    onChange={e => setNewSubtareas(p => ({ ...p, [act.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addSubtarea(act.id)}
                    style={{
                      flex: 1, border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px",
                      fontSize: 12, color: "#374151", outline: "none", background: "#F9FAFB",
                    }}
                  />
                  <button onClick={() => addSubtarea(act.id)} style={{
                    background: "var(--primary)", color: "white", border: "none", borderRadius: 8,
                    padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Panel de Seguimiento ── */}
          {actSeguimiento.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
                Tareas en Seguimiento
                <span style={{ background: "var(--primary-soft)", color: "var(--primary)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                  {actSeguimiento.length}
                </span>
              </h2>
              {actSeguimiento.map(act => (
                <div key={act.id} style={{
                  background: "white", borderRadius: 14, padding: "14px 18px", marginBottom: 10,
                  border: "1px solid #D1FAE5", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  borderLeft: "4px solid #10B981",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                        {act.prioridad && (
                          <span style={{ background: PRIORIDAD_COLOR[act.prioridad] + "18", color: PRIORIDAD_COLOR[act.prioridad], padding: "1px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
                            {act.prioridad}
                          </span>
                        )}
                        <span style={{ background: (ESTADO_COLOR[act.estado] || "#003A8C") + "18", color: ESTADO_COLOR[act.estado] || "#003A8C", padding: "1px 7px", borderRadius: 99, fontSize: 10, fontWeight: 600 }}>
                          {act.estado}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", lineHeight: 1.3 }}>{act.tarea}</div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>
                        {act.cliente && <span>Cliente: {act.cliente} · </span>}
                        <span style={{ color: "#10B981", fontWeight: 600 }}>Responsable: {formatUsername(act.responsable) || "—"}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {act.fecha_limite && (
                        <>
                          <div style={{ fontSize: 10, color: "#9CA3AF" }}>Límite</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: new Date(act.fecha_limite) < new Date() && act.estado !== "Completado" ? "#EF4444" : "#374151" }}>
                            {new Date(act.fecha_limite + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                          </div>
                        </>
                      )}
                      <div style={{ marginTop: 4 }}>
                        <ProgressBar pct={act.progreso_pct} color={act.progreso_pct >= 100 ? "#22C55E" : "#10B981"} height={5} />
                        <div style={{ fontSize: 10, color: "#9CA3AF", textAlign: "right", marginTop: 2 }}>{act.progreso_pct}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Panel de Canal Inter-Módulo ── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)", margin: 0 }}>
                Canal Inter-Módulo
              </h2>
              <button
                onClick={() => setShowNewSolicitud(true)}
                style={{
                  background: "var(--primary)", color: "white", border: "none", borderRadius: 8,
                  padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                + Nueva
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#F1F5F9", borderRadius: 8, padding: 3 }}>
              {[
                { key: "recibidas", label: "Recibidas", count: pendRecibidas },
                { key: "enviadas",  label: "Enviadas",  count: pendEnviadas  },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setCanalTab(t.key)}
                  style={{
                    flex: 1, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    background: canalTab === t.key ? "#fff" : "transparent",
                    color: canalTab === t.key ? "var(--primary)" : "#64748B",
                    boxShadow: canalTab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span style={{ background: "#EF4444", color: "#fff", borderRadius: 20, fontSize: 9, fontWeight: 700, padding: "1px 5px" }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* List of Solicitudes */}
            <div style={{ background: "white", borderRadius: 14, padding: "16px 14px", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", minHeight: 380, maxHeight: 600, overflowY: "auto" }}>
              {loadingCanal ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 13 }}>Cargando canal...</div>
              ) : displayedCanal.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 13 }}>
                  No tienes solicitudes en esta sección.
                </div>
              ) : (
                displayedCanal.map(sol => {
                  const sc = CANAL_STATUS_CFG[sol.status]    ?? CANAL_STATUS_CFG.PENDIENTE;
                  const pc = CANAL_PRIORITY_CFG[sol.priority] ?? CANAL_PRIORITY_CFG.NORMAL;
                  const isIncoming = sol.to_module === role;
                  return (
                    <div
                      key={sol.id}
                      onClick={() => setSelectedSolicitud(sol)}
                      style={{
                        background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB",
                        padding: "10px 12px", cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        borderLeft: `3px solid ${pc.color}`,
                        transition: "all 0.15s",
                        marginBottom: 8
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 5, marginBottom: 3, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}>{sol.code}</span>
                            <span style={{ fontSize: 9, background: isIncoming ? "#EFF6FF" : "#F0FDF4", color: isIncoming ? "var(--primary)" : "#16A34A", padding: "1px 5px", borderRadius: 20, fontWeight: 700 }}>
                              {isIncoming ? `De: ${CANAL_MODULE_LABELS[sol.from_module] || sol.from_module}` : `Para: ${CANAL_MODULE_LABELS[sol.to_module] || sol.to_module}`}
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {sol.subject}
                          </div>
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                            {new Date(sol.updated_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                            {sol.message_count > 0 && <span style={{ marginLeft: 6 }}>💬 {sol.message_count}</span>}
                            {sol.assigned_to_username && (
                              <span style={{ marginLeft: 6, background: "var(--primary-soft)", color: "var(--primary)", padding: "1px 5px", borderRadius: 20, fontWeight: 600 }}>
                                👤 {formatUsername(sol.assigned_to_username)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, alignItems: "flex-end" }}>
                          <span style={{ background: sc.bg, color: sc.color, padding: "1px 6px", borderRadius: 20, fontSize: 9, fontWeight: 700 }}>{sc.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modals */}
      {showNewSolicitud && (
        <NuevaSolicitudModal
          myModule={role}
          onClose={() => setShowNewSolicitud(false)}
          onCreated={(newSol) => {
            setSolicitudes(prev => [newSol, ...prev]);
            setShowNewSolicitud(false);
            setCanalTab("enviadas");
          }}
        />
      )}

      {selectedSolicitud && (
        <SolicitudDetailModal
          solicitud={selectedSolicitud}
          myModule={role}
          username={username}
          onClose={() => setSelectedSolicitud(null)}
          onUpdated={loadAll}
        />
      )}
    </Layout>
  );
}
