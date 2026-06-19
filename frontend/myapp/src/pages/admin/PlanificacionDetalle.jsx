import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { formatUsername } from "../../hooks/useAuth";

// Página dedicada de Detalle de Actividad (reemplaza al modal flotante).
// Ruta: /admin/planificacion/:id  ·  Guarda directo a BD vía el endpoint bulk (probado).

const PRIORIDADES = ["Alta", "Media", "Baja"];
const ESTADOS = ["En Progreso", "En espera", "Retraso", "Completado", "Cancelado"];
const ETAPAS = [
  "COTIZACIÓN", "COORDINACIÓN (OP)", "COORDINACIÓN (AD)",
  "EJECUCIÓN", "CIERRE", "FACTURACIÓN",
];

const FIELD = {
  border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px",
  fontSize: 13, color: "#192A2C", background: "#fff", width: "100%",
  boxSizing: "border-box", outline: "none",
};
const LABEL = { fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 };

function ProgressBar({ pct }) {
  const p = Math.min(pct || 0, 100);
  return (
    <div style={{ background: "#E5E7EB", borderRadius: 99, height: 6 }}>
      <div style={{ width: `${p}%`, height: "100%", borderRadius: 99, background: p >= 100 ? "#22C55E" : "#4F7C82", transition: "width 0.4s" }} />
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 3000,
      background: isErr ? "#FEE2E2" : "#DCFCE7", color: isErr ? "#DC2626" : "#15803D",
      border: `1px solid ${isErr ? "#FCA5A5" : "#86EFAC"}`, borderRadius: 12,
      padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
    }}>
      {isErr ? "✗ " : "✓ "}{toast.msg}
    </div>
  );
}

// MultiSelect de usuarios (checkbox dropdown) — versión local de la página.
function MultiSelectUser({ selectedIds, users, onChange, placeholder = "Seleccionar..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  const selectedList = useMemo(
    () => (selectedIds ? selectedIds.split(",").map(s => s.trim()).filter(Boolean) : []),
    [selectedIds]
  );
  const toggle = (uid) => {
    const next = selectedList.includes(uid) ? selectedList.filter(x => x !== uid) : [...selectedList, uid];
    onChange(next.join(","));
  };
  const text = useMemo(() => {
    if (!selectedList.length) return placeholder;
    const names = selectedList.map(uid => { const u = users.find(x => x.id === uid); return u ? formatUsername(u.username) : ""; }).filter(Boolean);
    return names.length <= 2 ? names.join(", ") : `${names.length} asignados`;
  }, [selectedList, users, placeholder]);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div onClick={() => setOpen(!open)} style={{ ...FIELD, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selectedList.length ? "#111827" : "#9CA3AF" }}>{text}</span>
        <span style={{ fontSize: 9, color: "#6B7280" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid #D1D5DB", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto", marginTop: 4, padding: "4px 0" }}>
          {users.map(u => {
            const checked = selectedList.includes(u.id);
            return (
              <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                <span style={{ color: "#374151", fontWeight: checked ? 700 : 400 }}>{formatUsername(u.username)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlanificacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [act, setAct] = useState(null);
  const [users, setUsers] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const subInputRef = useRef();

  function showToast(msg, type = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  async function load() {
    setLoading(true);
    try {
      const [a, u, c] = await Promise.all([
        apiFetch(`/planificacion/actividades/${id}`),
        apiFetch(`/planificacion/users`),
        apiFetch(`/clientes`),
      ]);
      setAct(a);
      setUsers(Array.isArray(u) ? u : []);
      setClientes(Array.isArray(c) ? c : []);
      try { const h = await apiFetch(`/planificacion/actividades/${id}/historial`); setHistorial(Array.isArray(h) ? h : []); } catch { setHistorial([]); }
      setDirty(false);
    } catch (e) { console.error(e); setAct(null); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  function upd(field, value) { setAct(prev => ({ ...prev, [field]: value })); setDirty(true); }

  function recompute(subs) {
    const pct = subs.length ? Math.round(subs.filter(s => s.culminado).length / subs.length * 100) : 0;
    setAct(prev => ({ ...prev, progreso_pct: pct }));
  }

  async function save() {
    if (!act.tarea?.trim()) { showToast("La descripción de la tarea es obligatoria", "error"); return; }
    setSaving(true);
    try {
      await apiFetch(`/planificacion/actividades/bulk`, {
        method: "POST",
        body: JSON.stringify({
          upsert: [{
            id: act.id,
            prioridad: act.prioridad || "Media",
            tarea: act.tarea.trim(),
            cliente: act.cliente || null,
            contacto: act.contacto || null,
            fecha_solicitud: act.fecha_solicitud || null,
            etapa: act.etapa || null,
            estado: act.estado || "En Progreso",
            fecha_limite: act.fecha_limite || null,
            responsable_id: act.responsable_id || null,
            seguimiento_id: act.seguimiento_id || null,
            responsables_ids: act.responsables_ids || null,
            seguimientos_ids: act.seguimientos_ids || null,
            contactos_ids: act.contactos_ids || null,
            notas: act.notas || null,
          }],
          delete: [],
        }),
      });
      showToast("Cambios guardados");
      load();
    } catch (e) { showToast("Error al guardar los cambios", "error"); }
    finally { setSaving(false); }
  }

  async function addSub(desc) {
    if (!desc.trim()) return;
    try {
      const s = await apiFetch(`/planificacion/actividades/${id}/subtareas`, { method: "POST", body: JSON.stringify({ descripcion: desc.trim() }) });
      const subs = [...(act.subtareas || []), s];
      setAct(prev => ({ ...prev, subtareas: subs })); recompute(subs);
    } catch { showToast("Error al agregar subtarea", "error"); }
  }
  async function toggleSub(subId) {
    try {
      const updated = await apiFetch(`/planificacion/actividades/${id}/subtareas/${subId}/toggle`, { method: "PATCH" });
      const subs = act.subtareas.map(s => s.id === subId ? updated : s);
      setAct(prev => ({ ...prev, subtareas: subs })); recompute(subs);
    } catch { showToast("Error al cambiar subtarea", "error"); }
  }
  async function assignSub(subId, userId) {
    try {
      const updated = await apiFetch(`/planificacion/actividades/${id}/subtareas/${subId}/assign`, { method: "PATCH", body: JSON.stringify({ responsable_id: userId || null }) });
      setAct(prev => ({ ...prev, subtareas: prev.subtareas.map(s => s.id === subId ? updated : s) }));
    } catch { showToast("Error al asignar subtarea", "error"); }
  }
  async function deleteSub(subId) {
    try {
      await apiFetch(`/planificacion/actividades/${id}/subtareas/${subId}`, { method: "DELETE" });
      const subs = act.subtareas.filter(s => s.id !== subId);
      setAct(prev => ({ ...prev, subtareas: subs })); recompute(subs);
    } catch { showToast("Error al eliminar subtarea", "error"); }
  }

  function goClient() {
    if (!act.cliente) return;
    const m = clientes.find(c => c.razon_social?.trim().toLowerCase() === act.cliente.trim().toLowerCase());
    if (m) navigate(`/clientes?id=${m.id}`);
    else if (window.confirm(`El cliente "${act.cliente}" no está registrado.\n¿Ir al módulo comercial?`)) navigate("/clientes");
  }

  function back() {
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Salir de todas formas?")) return;
    navigate("/admin/planificacion");
  }

  if (loading) return <Layout><div style={{ padding: 48, textAlign: "center", color: "#9CA3AF" }}>Cargando actividad...</div></Layout>;
  if (!act) return (
    <Layout>
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ color: "#DC2626", fontWeight: 700 }}>No se encontró la actividad.</p>
        <button onClick={() => navigate("/admin/planificacion")} style={{ marginTop: 12, background: "#0B2E33", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Volver a Planificación</button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Header / Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <button onClick={back} style={{ background: "none", border: "none", color: "#4F7C82", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              ← Planificación Semanal
            </button>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "#0B2E33", margin: "4px 0 0" }}>Detalle y Gestión de Actividad</h1>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>ID: {act.id}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {dirty && <span style={{ color: "#EAB308", fontWeight: 700, fontSize: 12 }}>● Cambios sin guardar</span>}
            <button onClick={save} disabled={saving || !dirty}
              style={{ background: dirty ? "#0B2E33" : "#9CA3AF", color: "white", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: dirty && !saving ? "pointer" : "default", boxShadow: dirty ? "0 0 0 3px rgba(11,46,51,0.18)" : "none" }}>
              {saving ? "Guardando..." : "💾 Guardar Cambios"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>

          {/* Columna izquierda: Datos */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0B2E33" }}>📝 Detalles de la Actividad</h4>

            <div>
              <label style={LABEL}>Descripción de Tarea ✱</label>
              <textarea value={act.tarea || ""} onChange={e => upd("tarea", e.target.value)} rows={2} style={{ ...FIELD, resize: "none" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={LABEL}>Prioridad</label>
                <select value={act.prioridad || ""} onChange={e => upd("prioridad", e.target.value)} style={FIELD}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Estado</label>
                <select value={act.estado || ""} onChange={e => upd("estado", e.target.value)} style={FIELD}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={LABEL}>Cliente</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={act.cliente || ""} onChange={e => upd("cliente", e.target.value)} style={FIELD} />
                  {act.cliente && (
                    <button onClick={goClient} title="Ver ficha del cliente"
                      style={{ background: "#EEF7F8", color: "#0B2E33", border: "1px solid #B8E3E9", borderRadius: 8, padding: "0 10px", fontSize: 12, cursor: "pointer" }}>🏢</button>
                  )}
                </div>
              </div>
              <div>
                <label style={LABEL}>Contacto</label>
                <input value={act.contacto || ""} onChange={e => upd("contacto", e.target.value)} style={FIELD} />
              </div>
            </div>

            <div>
              <label style={LABEL}>Responsables (múltiples)</label>
              <MultiSelectUser selectedIds={act.responsables_ids} users={users} onChange={v => upd("responsables_ids", v)} placeholder="Selecciona responsables..." />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={LABEL}>F. Solicitud</label>
                <input type="date" value={act.fecha_solicitud || ""} onChange={e => upd("fecha_solicitud", e.target.value)} style={FIELD} />
              </div>
              <div>
                <label style={LABEL}>F. Límite</label>
                <input type="date" value={act.fecha_limite || ""} onChange={e => upd("fecha_limite", e.target.value)} style={FIELD} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={LABEL}>Etapa</label>
                <select value={act.etapa || ""} onChange={e => upd("etapa", e.target.value)} style={FIELD}>
                  <option value="">— Sin etapa —</option>
                  {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Seguimiento (múltiples)</label>
                <MultiSelectUser selectedIds={act.seguimientos_ids} users={users} onChange={v => upd("seguimientos_ids", v)} placeholder="Selecciona seguimiento..." />
              </div>
            </div>

            <div>
              <label style={LABEL}>Notas</label>
              <input value={act.notas || ""} onChange={e => upd("notas", e.target.value)} placeholder="Notas adicionales..." style={FIELD} />
            </div>
          </div>

          {/* Columna derecha: Subtareas + Historial */}
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0B2E33" }}>📋 Checklist y Subtareas</h4>
              <span style={{ background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>⚡ Tiempo real</span>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                <span>Progreso de Subtareas</span>
                <span>{Math.round(act.progreso_pct || 0)}%</span>
              </div>
              <ProgressBar pct={act.progreso_pct} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, background: "white" }}>
              {(!act.subtareas || act.subtareas.length === 0) ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0", margin: 0 }}>No hay subtareas registradas.</p>
              ) : (
                act.subtareas.map(sub => (
                  <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#F9FAFB", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                    <input type="checkbox" checked={!!sub.culminado} onChange={() => toggleSub(sub.id)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 12, flex: 1, textDecoration: sub.culminado ? "line-through" : "none", color: sub.culminado ? "#9CA3AF" : "#111827", fontWeight: sub.culminado ? 400 : 600 }}>{sub.descripcion}</span>
                    <select value={sub.responsable_id || ""} onChange={e => assignSub(sub.id, e.target.value)} style={{ border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11, padding: "2px 4px", background: "white" }}>
                      <option value="">Responsable...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{formatUsername(u.username)}</option>)}
                    </select>
                    <button onClick={() => deleteSub(sub.id)} title="Borrar subtarea" style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444", fontSize: 13 }}>🗑</button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input ref={subInputRef} placeholder="Escribe una nueva subtarea..." style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
                onKeyDown={e => { if (e.key === "Enter") { addSub(e.target.value); e.target.value = ""; } }} />
              <button onClick={() => { const v = subInputRef.current?.value; if (v && v.trim()) { addSub(v); subInputRef.current.value = ""; } }}
                style={{ background: "#0B2E33", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Añadir</button>
            </div>

            {historial.length > 0 && (
              <div style={{ marginTop: 4, background: "white", borderRadius: 10, border: "1px solid #E5E7EB", padding: 12 }}>
                <h5 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>📜 Historial de versiones</h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                  {historial.map(h => (
                    <div key={h.id} style={{ fontSize: 11, color: "#6B7280", borderBottom: "1px solid #F3F4F6", paddingBottom: 4 }}>
                      <strong style={{ color: "#0B2E33" }}>{new Date(h.created_at).toLocaleString("es-PE")}</strong>
                      {" · "}{h.guardado_por || "sistema"}
                      {" — "}{h.snapshot?.tarea || "—"} ({h.snapshot?.estado || "—"})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </Layout>
  );
}
