import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch, BASE_URL as API } from "../../services/api";
const TOKEN = () => localStorage.getItem("access_token");

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = { deep: "var(--primary)", mid: "var(--primary)", light: "rgba(199,210,229,0.85)", bg: "var(--primary-soft)" };

const STATUS_CFG = {
  PENDIENTE:    { label: "Pendiente",    bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
  EN_EJECUCION: { label: "En Ejecución", bg: "#DBEAFE", color: "#1E40AF", border: "#93C5FD" },
  PAUSADA:      { label: "Pausada",      bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
  COMPLETADA:   { label: "Completada",   bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
  CERRADA:      { label: "Cerrada",      bg: "#F3F4F6", color: "#374151", border: "#D1D5DB" },
  CANCELADA:    { label: "Cancelada",    bg: "#F3F4F6", color: "#6B7280", border: "#D1D5DB" },
};

const TIPO_CFG = {
  CORRECTIVO: { label: "Correctivo", color: "#DC2626" },
  PREVENTIVO: { label: "Preventivo", color: "#2563EB" },
  EMERGENCIA: { label: "Emergencia", color: "#7C3AED" },
};

const PRIO_CFG = {
  URGENTE: { label: "🔴 Urgente", color: "#DC2626" },
  ALTA:    { label: "🟠 Alta",    color: "#EA580C" },
  NORMAL:  { label: "🟡 Normal",  color: "#CA8A04" },
  BAJA:    { label: "🟢 Baja",    color: "#16A34A" },
};

const TRANSITIONS = {
  PENDIENTE:    ["EN_EJECUCION", "CANCELADA"],
  EN_EJECUCION: ["PAUSADA", "COMPLETADA"],
  PAUSADA:      ["EN_EJECUCION"],
  COMPLETADA:   [],
  CERRADA:      [],
  CANCELADA:    [],
};

const TRANS_LABELS = {
  EN_EJECUCION: { label: "▶ Iniciar",    bg: "#2563EB", color: "#fff" },
  PAUSADA:      { label: "⏸ Pausar",     bg: "#EA580C", color: "#fff" },
  COMPLETADA:   { label: "✓ Completar",  bg: "#16A34A", color: "#fff" },
  CANCELADA:    { label: "✕ Cancelar",   bg: "#DC2626", color: "#fff" },
};

function fmt(dt, withTime = false) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (withTime) return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtHoras(h) {
  if (h == null) return "—";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh}h ${mm.toString().padStart(2, "0")}m`;
}

// ── Cronómetro en vivo ────────────────────────────────────────────────────────
function LiveTimer({ tiempos }) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);

  const activeTimer = tiempos?.find(t => !t.fin);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return; }
    const start = new Date(activeTimer.inicio).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    ref.current = setInterval(tick, 1000);
    return () => clearInterval(ref.current);
  }, [activeTimer?.id]);

  if (!activeTimer) return null;

  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor((elapsed % 3600) / 60);
  const ss = elapsed % 60;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: 8,
      padding: "6px 14px", fontSize: 13, color: "#1E40AF", fontWeight: 700,
    }}>
      <span style={{ fontSize: 16 }}>⏱</span>
      <span style={{ fontFamily: "monospace", fontSize: 16 }}>
        {String(hh).padStart(2,"0")}:{String(mm).padStart(2,"0")}:{String(ss).padStart(2,"0")}
      </span>
      <span style={{ fontSize: 11, fontWeight: 400 }}>en curso</span>
    </div>
  );
}

// ── Modal agregar material ─────────────────────────────────────────────────────
function AddMaterialModal({ otId, warehouses, onClose, onAdded }) {
  const [materials, setMaterials] = useState([]);
  const [search,    setSearch]    = useState("");
  const [form,      setForm]      = useState({ material_id: "", almacen_id: "", cantidad_real: "", cantidad_plan: "" });
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");

  useEffect(() => {
    apiFetch("/logistics/materials?limit=500")
      .then(d => setMaterials(Array.isArray(d.items) ? d.items : (Array.isArray(d) ? d : [])))
      .catch(() => {});
  }, []);

  const filtered = materials.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.sku ?? "").toLowerCase().includes(search.toLowerCase())
  ).slice(0, 40);

  const submit = async () => {
    if (!form.material_id) return setErr("Selecciona un material");
    if (!form.cantidad_real || parseFloat(form.cantidad_real) <= 0) return setErr("Cantidad debe ser mayor a 0");
    setLoading(true); setErr("");
    try {
      await apiFetch(`/ot/${otId}/materiales`, {
        method: "POST",
        body: JSON.stringify({
          material_id:  form.material_id,
          almacen_id:   form.almacen_id || null,
          cantidad_real: parseFloat(form.cantidad_real),
          cantidad_plan: form.cantidad_plan ? parseFloat(form.cantidad_plan) : null,
        }),
      });
      onAdded();
    } catch (e) {
      setErr(e.message ?? "Error al agregar material");
    } finally {
      setLoading(false);
    }
  };

  const inp = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box" };
  const lbl = { fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3, fontWeight: 600 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 26, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 16px", color: C.deep, fontSize: 16, fontWeight: 800 }}>Agregar material consumido</h3>

        <label style={lbl}>Buscar material</label>
        <input style={{ ...inp, marginBottom: 8 }} placeholder="Nombre o código..." autoFocus
          value={search} onChange={e => setSearch(e.target.value)} />

        <label style={lbl}>Material *</label>
        <select style={{ ...inp, marginBottom: 12 }} value={form.material_id}
          onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}>
          <option value="">— Seleccionar —</option>
          {filtered.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit ?? "und"})</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Cantidad real *</label>
            <input style={inp} type="number" min="0" step="0.001"
              value={form.cantidad_real} onChange={e => setForm(f => ({ ...f, cantidad_real: e.target.value }))}
              placeholder="0.00" />
          </div>
          <div>
            <label style={lbl}>Cantidad plan (APU)</label>
            <input style={inp} type="number" min="0" step="0.001"
              value={form.cantidad_plan} onChange={e => setForm(f => ({ ...f, cantidad_plan: e.target.value }))}
              placeholder="0.00" />
          </div>
        </div>

        <label style={lbl}>Almacén de salida</label>
        <select style={{ ...inp, marginBottom: 14 }} value={form.almacen_id}
          onChange={e => setForm(f => ({ ...f, almacen_id: e.target.value }))}>
          <option value="">Sin almacén específico</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 10px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: C.mid, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {loading ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal agregar checklist ────────────────────────────────────────────────────
function AddChecklistModal({ otId, currentCount, onClose, onAdded }) {
  const [desc,    setDesc]    = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const submit = async () => {
    if (!desc.trim()) return setErr("La descripción es obligatoria");
    setLoading(true); setErr("");
    try {
      await apiFetch(`/ot/${otId}/checklist`, {
        method: "POST",
        body: JSON.stringify({ descripcion: desc.trim(), orden: currentCount }),
      });
      onAdded();
    } catch (e) {
      setErr(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 14px", color: C.deep, fontSize: 15, fontWeight: 800 }}>Nuevo paso del checklist</h3>
        <input
          autoFocus value={desc} onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Ej: Verificar conexiones eléctricas..."
          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box", marginBottom: 12 }}
        />
        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 10px" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: C.mid, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {loading ? "..." : "Agregar paso"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sección Checklist ─────────────────────────────────────────────────────────
function ChecklistSection({ ot, onRefresh, readonly }) {
  const [showAdd, setShowAdd] = useState(false);
  const [toggling, setToggling] = useState(null);

  const toggle = async (item) => {
    setToggling(item.id);
    try {
      await apiFetch(`/ot/${ot.id}/checklist/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completado: !item.completado }),
      });
      onRefresh();
    } catch { /* silent */ }
    finally { setToggling(null); }
  };

  const remove = async (item) => {
    if (!confirm(`¿Eliminar el paso "${item.descripcion}"?`)) return;
    try {
      await apiFetch(`/ot/${ot.id}/checklist/${item.id}`, { method: "DELETE" });
      onRefresh();
    } catch { /* silent */ }
  };

  const checklist = ot.checklist ?? [];
  const done = checklist.filter(i => i.completado).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.deep }}>Checklist</h3>
          {checklist.length > 0 && (
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
              {done}/{checklist.length} completados
            </div>
          )}
        </div>
        {!readonly && (
          <button onClick={() => setShowAdd(true)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.mid}`, background: "#fff", color: C.mid, cursor: "pointer", fontWeight: 700 }}>
            + Paso
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      {checklist.length > 0 && (
        <div style={{ height: 6, background: "#E5E7EB", borderRadius: 99, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(done / checklist.length) * 100}%`, background: "#16A34A", borderRadius: 99, transition: "width 0.3s" }} />
        </div>
      )}

      {checklist.length === 0 ? (
        <div style={{ color: "#9CA3AF", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
          Sin pasos aún. {!readonly && "Agrega el primer paso del checklist."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {checklist.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: item.completado ? "#F0FDF4" : "#FAFAFA",
              border: `1px solid ${item.completado ? "#BBF7D0" : "#E5E7EB"}`,
              borderRadius: 8, padding: "10px 12px",
              transition: "all 0.15s",
            }}>
              {/* Checkbox */}
              <button
                disabled={toggling === item.id || readonly}
                onClick={() => toggle(item)}
                style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0, cursor: readonly ? "default" : "pointer",
                  border: `2px solid ${item.completado ? "#16A34A" : "#D1D5DB"}`,
                  background: item.completado ? "#16A34A" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#fff", fontWeight: 800, padding: 0,
                  transition: "all 0.15s",
                }}>
                {item.completado ? "✓" : ""}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: item.completado ? "#6B7280" : C.deep,
                  textDecoration: item.completado ? "line-through" : "none",
                }}>
                  <span style={{ color: "#9CA3AF", fontSize: 11, marginRight: 6 }}>#{i + 1}</span>
                  {item.descripcion}
                </div>
                {item.completado && item.completado_nombre && (
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                    ✓ {item.completado_nombre} · {fmt(item.completado_at, true)}
                  </div>
                )}
              </div>

              {!readonly && (
                <button onClick={() => remove(item)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 13, padding: "0 2px", lineHeight: 1 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
                  onMouseLeave={e => e.currentTarget.style.color = "#D1D5DB"}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddChecklistModal
          otId={ot.id}
          currentCount={checklist.length}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal Generar OC ──────────────────────────────────────────────────────────
function GenerarOCModal({ ot, matItem, onClose, onCreated }) {
  const navigate = useNavigate();
  const [proveedores, setProveedores]   = useState(null); // null = no cargado aún
  const [provSel, setProvSel]           = useState(null);
  const [cantidad, setCantidad]         = useState(
    Math.max(0, (matItem.cantidad_real ?? 0) - (matItem.stock_disponible ?? 0))
  );
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // Al abrir, intentar generar OC directamente (busca proveedor principal)
  const handleConfirm = async (proveedor_id_override = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/ot/${ot.id}/generar-oc`, {
        method: "POST",
        body: JSON.stringify({
          mat_item_id:       matItem.id,
          material_id:       matItem.material_id,
          cantidad_faltante: cantidad,
          almacen_id:        matItem.almacen_id ?? null,
          proveedor_id:      proveedor_id_override ?? (provSel?.id ?? null),
        }),
      });

      if (res.necesita_proveedor) {
        // Backend pidió elegir proveedor
        setProveedores(res.proveedores ?? []);
        setLoading(false);
        return;
      }

      // OC creada exitosamente
      onCreated();
      if (navigate) navigate(`/compras/oc/${res.oc_id}`);
    } catch (e) {
      setError(e.message ?? "Error al generar OC");
      setLoading(false);
    }
  };

  const stockFaltante = Math.max(0, (matItem.cantidad_real ?? 0) - (matItem.stock_disponible ?? 0));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.deep }}>⚡ Generar Orden de Compra</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{matItem.material_nombre}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>

        {/* Resumen de stock */}
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748B" }}>Stock disponible</span>
            <span style={{ fontWeight: 700, color: "#DC2626" }}>{matItem.stock_disponible ?? 0} {matItem.material_unidad ?? "und"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "#64748B" }}>Cantidad necesaria</span>
            <span style={{ fontWeight: 700, color: C.deep }}>{matItem.cantidad_real} {matItem.material_unidad ?? "und"}</span>
          </div>
          <div style={{ borderTop: "1px solid #FCA5A5", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748B", fontWeight: 600 }}>Faltante</span>
            <span style={{ fontWeight: 800, color: "#DC2626" }}>{stockFaltante} {matItem.material_unidad ?? "und"}</span>
          </div>
        </div>

        {/* Selector de cantidad */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.deep, display: "block", marginBottom: 5 }}>
            Cantidad a pedir
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={cantidad}
            onChange={e => setCantidad(parseFloat(e.target.value) || 0)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        {/* Selector de proveedor si backend lo pidió */}
        {proveedores !== null && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.deep, display: "block", marginBottom: 5 }}>
              Seleccionar proveedor
              <span style={{ fontSize: 11, color: "#EF4444", marginLeft: 4 }}>— no hay proveedor principal</span>
            </label>
            {proveedores.length === 0 ? (
              <div style={{ color: "#9CA3AF", fontSize: 13 }}>Sin proveedores disponibles para este material.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {proveedores.map(p => (
                  <label key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    border: `1px solid ${provSel?.id === p.id ? C.mid : "#E5E7EB"}`,
                    borderRadius: 8, cursor: "pointer",
                    background: provSel?.id === p.id ? "var(--primary-soft)" : "#fff",
                  }}>
                    <input type="radio" name="proveedor" checked={provSel?.id === p.id} onChange={() => setProvSel(p)} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.deep }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>S/ {p.precio_unitario?.toFixed(2)} / und</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "8px 12px", color: "#DC2626", fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 }}>
            Cancelar
          </button>
          {proveedores !== null ? (
            <button
              disabled={loading || !provSel || proveedores.length === 0 || cantidad <= 0}
              onClick={() => handleConfirm(provSel.id)}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: C.deep, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: (loading || !provSel || cantidad <= 0) ? 0.6 : 1 }}>
              {loading ? "Creando..." : "Crear OC"}
            </button>
          ) : (
            <button
              disabled={loading || cantidad <= 0}
              onClick={() => handleConfirm()}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: C.deep, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: (loading || cantidad <= 0) ? 0.6 : 1 }}>
              {loading ? "Generando..." : "⚡ Generar OC"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sección Materiales ────────────────────────────────────────────────────────
function MaterialesSection({ ot, warehouses, onRefresh, readonly }) {
  const navigate = useNavigate();
  const [showAdd,    setShowAdd]    = useState(false);
  const [genOCItem,  setGenOCItem]  = useState(null); // matItem seleccionado para generar OC

  const remove = async (matId) => {
    if (!confirm("¿Eliminar este material?")) return;
    try {
      await apiFetch(`/ot/${ot.id}/materiales/${matId}`, { method: "DELETE" });
      onRefresh();
    } catch (e) { alert(e.message ?? "Error al eliminar"); }
  };

  const materiales = ot.materiales ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.deep }}>
          Materiales consumidos
          <span style={{ fontSize: 12, fontWeight: 400, color: "#64748B", marginLeft: 8 }}>
            ({materiales.length})
          </span>
        </h3>
        {!readonly && (
          <button onClick={() => setShowAdd(true)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.mid}`, background: "#fff", color: C.mid, cursor: "pointer", fontWeight: 700 }}>
            + Material
          </button>
        )}
      </div>

      {materiales.length === 0 ? (
        <div style={{ color: "#9CA3AF", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
          Sin materiales registrados.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                {["Material", "Unidad", "Cant. Plan", "Stock Disp.", "Cant. Real", "Almacén", "Estado", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "#6B7280", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materiales.map((m, i) => {
                const stockInsuficiente = !m.stock_movement_id && m.cantidad_real > (m.stock_disponible ?? 0);
                return (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: C.deep }}>{m.material_nombre}</td>
                    <td style={{ padding: "8px 10px", color: "#64748B" }}>{m.material_unidad ?? "und"}</td>
                    <td style={{ padding: "8px 10px", color: "#9CA3AF" }}>{m.cantidad_plan != null ? m.cantidad_plan : "—"}</td>
                    <td style={{ padding: "8px 10px", color: stockInsuficiente ? "#DC2626" : "#16A34A", fontWeight: 700 }}>
                      {m.stock_disponible ?? 0}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: C.deep }}>{m.cantidad_real}</td>
                    <td style={{ padding: "8px 10px", color: "#64748B" }}>{m.almacen_nombre ?? "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {m.stock_movement_id ? (
                        <span style={{ fontSize: 11, background: "#D1FAE5", color: "#065F46", padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>
                          ✓ Descontado
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      {/* Chip stock insuficiente + botón generar OC */}
                      {stockInsuficiente && !m.oc_id && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: 20, fontWeight: 700, whiteSpace: "nowrap" }}>
                            ⚠ Sin stock
                          </span>
                          {!readonly && (
                            <button
                              onClick={() => setGenOCItem(m)}
                              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: C.deep, color: "#fff", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                              ⚡ Generar OC
                            </button>
                          )}
                        </div>
                      )}
                      {/* Link a OC existente */}
                      {m.oc_id && (
                        <button
                          onClick={() => navigate(`/compras/oc/${m.oc_id}`)}
                          style={{ fontSize: 11, color: C.mid, fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, whiteSpace: "nowrap" }}>
                          Ver OC: {m.oc_code ?? "—"}
                        </button>
                      )}
                      {/* Botón eliminar */}
                      {!readonly && !m.stock_movement_id && !m.oc_id && (
                        <button onClick={() => remove(m.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#FCA5A5", fontSize: 13, marginLeft: stockInsuficiente ? 0 : 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#DC2626"}
                          onMouseLeave={e => e.currentTarget.style.color = "#FCA5A5"}>
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddMaterialModal
          otId={ot.id}
          warehouses={warehouses}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onRefresh(); }}
        />
      )}

      {genOCItem && (
        <GenerarOCModal
          ot={ot}
          matItem={genOCItem}
          onClose={() => setGenOCItem(null)}
          onCreated={() => { setGenOCItem(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Sección Tiempos ───────────────────────────────────────────────────────────
function TiemposSection({ ot, onRefresh, readonly }) {
  const [loading, setLoading] = useState(false);
  const tiempos = ot.tiempos ?? [];
  const totalHoras = tiempos.reduce((s, t) => s + (t.horas ?? 0), 0);
  const tieneActivo = ot.tiene_tiempo_activo;

  const action = async (endpoint) => {
    setLoading(true);
    try {
      await apiFetch(`/ot/${ot.id}/tiempo/${endpoint}`, { method: "POST", body: "{}" });
      onRefresh();
    } catch (e) { alert(e.message ?? "Error"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.deep }}>
          Registro de tiempo
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LiveTimer tiempos={tiempos} />
          {!readonly && ot.status === "EN_EJECUCION" && (
            tieneActivo ? (
              <button disabled={loading} onClick={() => action("pausar")} style={{
                padding: "6px 14px", borderRadius: 7, border: "none",
                background: "#EA580C", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12,
              }}>
                ⏸ Pausar cronómetro
              </button>
            ) : (
              <button disabled={loading} onClick={() => action("iniciar")} style={{
                padding: "6px 14px", borderRadius: 7, border: "none",
                background: "#2563EB", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12,
              }}>
                ▶ Iniciar cronómetro
              </button>
            )
          )}
        </div>
      </div>

      {/* Total horas */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ background: "var(--primary-soft)", borderRadius: 8, padding: "10px 16px", border: "1px solid #D1D5DB" }}>
          <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Horas estimadas</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.mid }}>{fmtHoras(ot.horas_estimadas)}</div>
        </div>
        <div style={{ background: "var(--primary-soft)", borderRadius: 8, padding: "10px 16px", border: "1px solid #D1D5DB" }}>
          <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Horas registradas</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: totalHoras > (ot.horas_estimadas ?? 999) ? "#DC2626" : C.deep }}>
            {fmtHoras(totalHoras)}
          </div>
        </div>
        {ot.horas_estimadas && totalHoras > 0 && (
          <div style={{ background: totalHoras > ot.horas_estimadas ? "#FEE2E2" : "#D1FAE5", borderRadius: 8, padding: "10px 16px", border: `1px solid ${totalHoras > ot.horas_estimadas ? "#FCA5A5" : "#6EE7B7"}` }}>
            <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Desviación</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: totalHoras > ot.horas_estimadas ? "#DC2626" : "#16A34A" }}>
              {totalHoras > ot.horas_estimadas ? "+" : ""}{fmtHoras(totalHoras - ot.horas_estimadas)}
            </div>
          </div>
        )}
      </div>

      {tiempos.length === 0 ? (
        <div style={{ color: "#9CA3AF", fontSize: 13, padding: "12px 0", textAlign: "center" }}>Sin registros de tiempo.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                {["Técnico", "Inicio", "Fin", "Horas", "Estado"].map(h => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, color: "#6B7280", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiempos.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "7px 10px", color: C.deep }}>{t.tecnico_nombre ?? "—"}</td>
                  <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace", fontSize: 12 }}>{fmt(t.inicio, true)}</td>
                  <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace", fontSize: 12 }}>{t.fin ? fmt(t.fin, true) : "—"}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{t.horas != null ? `${t.horas.toFixed(2)}h` : "—"}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {!t.fin ? (
                      <span style={{ fontSize: 11, background: "#DBEAFE", color: "#1E40AF", padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>⏱ Activo</span>
                    ) : (
                      <span style={{ fontSize: 11, background: "#F3F4F6", color: "#6B7280", padding: "2px 7px", borderRadius: 20 }}>Cerrado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sección Comparativa ───────────────────────────────────────────────────────
function ComparativaSection({ otId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/ot/${otId}/comparativa`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [otId]);

  if (loading) return <div style={{ color: "#9CA3AF", padding: 20, textAlign: "center" }}>Cargando comparativa...</div>;
  if (!data)   return <div style={{ color: "#9CA3AF", padding: 20, textAlign: "center" }}>No disponible.</div>;

  return (
    <div>
      {/* Horas */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Horas Plan", value: fmtHoras(data.horas_plan), color: C.mid },
          { label: "Horas Real", value: fmtHoras(data.horas_real), color: C.deep },
          {
            label: "Desviación horas",
            value: data.horas_desviacion != null ? (data.horas_desviacion >= 0 ? "+" : "") + fmtHoras(data.horas_desviacion) : "—",
            color: data.horas_desviacion > 0 ? "#DC2626" : "#16A34A",
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 20px", minWidth: 140 }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Materiales */}
      <h4 style={{ margin: "0 0 10px", color: C.deep, fontSize: 14, fontWeight: 700 }}>Materiales — Plan APU vs Real</h4>
      {!data.tiene_partida && (
        <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 10 }}>
          Esta OT no tiene una partida APU asociada. Solo se muestran los materiales reales.
        </div>
      )}
      {data.materiales_plan.length === 0 ? (
        <div style={{ color: "#9CA3AF", fontSize: 13, padding: "12px 0" }}>Sin materiales registrados.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.deep, color: "#fff" }}>
                {["Material", "Und", "Plan", "Real", "Desviación"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.materiales_plan.map((m, i) => {
                const desv = m.desviacion;
                const dColor = desv > 0 ? "#DC2626" : desv < 0 ? "#16A34A" : "#64748B";
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: C.deep }}>{m.material_nombre || m.descripcion}</td>
                    <td style={{ padding: "8px 12px", color: "#64748B" }}>{m.unidad}</td>
                    <td style={{ padding: "8px 12px", color: "#64748B" }}>{m.plan_cantidad > 0 ? m.plan_cantidad.toFixed(3) : "—"}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: C.deep }}>{m.real_cantidad.toFixed(3)}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: dColor }}>
                      {desv !== 0 ? (desv > 0 ? "+" : "") + desv.toFixed(3) : "="}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Panel de acciones de estado ───────────────────────────────────────────────
function AccionesPanel({ ot, onRefresh }) {
  const [loading,  setLoading]  = useState(false);
  const [confirm,  setConfirm]  = useState(null); // status a confirmar

  const allowed = TRANSITIONS[ot.status] ?? [];

  const doTransition = async (newStatus) => {
    setLoading(true);
    try {
      await apiFetch(`/ot/${ot.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch (e) { alert(e.message ?? "Error al cambiar estado"); }
    finally { setLoading(false); setConfirm(null); }
  };

  const doClose = async () => {
    setLoading(true);
    try {
      await apiFetch(`/ot/${ot.id}/cerrar`, { method: "POST" });
      onRefresh();
    } catch (e) { alert(e.message ?? "Error al cerrar OT"); }
    finally { setLoading(false); setConfirm(null); }
  };

  const canClose = ["COMPLETADA", "EN_EJECUCION"].includes(ot.status);

  if (ot.status === "CERRADA" || ot.status === "CANCELADA") return null;

  return (
    <div style={{
      background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12,
      padding: "16px 20px",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 10 }}>
        Acciones disponibles
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {allowed.map(s => {
          const cfg = TRANS_LABELS[s];
          if (!cfg) return null;
          return (
            <button key={s} disabled={loading} onClick={() => setConfirm(s)} style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: cfg.bg, color: cfg.color, cursor: "pointer",
              fontWeight: 700, fontSize: 13, transition: "opacity 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              {cfg.label}
            </button>
          );
        })}

        {canClose && (
          <button disabled={loading} onClick={() => setConfirm("CERRAR")} style={{
            padding: "8px 18px", borderRadius: 8, border: "none",
            background: C.deep, color: "#fff", cursor: "pointer",
            fontWeight: 700, fontSize: 13,
          }}>
            🔒 Cerrar OT (descuenta stock)
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 26, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 8px", color: C.deep, fontSize: 16 }}>
              {confirm === "CERRAR" ? "Cerrar OT" : `Cambiar a: ${STATUS_CFG[confirm]?.label ?? confirm}`}
            </h3>
            {confirm === "CERRAR" ? (
              <p style={{ color: "#374151", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5 }}>
                Al cerrar la OT se registrarán automáticamente los movimientos de <strong>salida de stock</strong> por todos los materiales con cantidad real &gt; 0. Esta acción no se puede deshacer.
              </p>
            ) : (
              <p style={{ color: "#374151", fontSize: 13, margin: "0 0 16px" }}>
                ¿Confirmas el cambio de estado?
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(null)} style={{ padding: "7px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>
                Cancelar
              </button>
              <button disabled={loading}
                onClick={() => confirm === "CERRAR" ? doClose() : doTransition(confirm)}
                style={{
                  padding: "7px 18px", borderRadius: 7, border: "none",
                  background: confirm === "CERRAR" ? C.deep : (TRANS_LABELS[confirm]?.bg ?? C.mid),
                  color: "#fff", cursor: "pointer", fontWeight: 700,
                }}>
                {loading ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function OTDetailView() {
  const { otId }  = useParams();
  const navigate  = useNavigate();
  const [ot,         setOt]         = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("checklist"); // checklist | materiales | tiempos | comparativa

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/ot/${otId}`);
      setOt(data);
    } catch { setOt(null); }
    finally { setLoading(false); }
  }, [otId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch("/logistics/warehouses")
      .then(d => setWarehouses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  if (loading) return (
    <Layout>
      <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Cargando orden de trabajo...</div>
    </Layout>
  );

  if (!ot) return (
    <Layout>
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 600, color: "#374151" }}>OT no encontrada</div>
        <button onClick={() => navigate("/operaciones/ot")} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 7, border: "none", background: C.mid, color: "#fff", cursor: "pointer" }}>
          ← Volver a OTs
        </button>
      </div>
    </Layout>
  );

  const scfg    = STATUS_CFG[ot.status] ?? STATUS_CFG.PENDIENTE;
  const tipo    = TIPO_CFG[ot.tipo]     ?? { label: ot.tipo,      color: "#64748B" };
  const prio    = PRIO_CFG[ot.prioridad] ?? { label: ot.prioridad, color: "#64748B" };
  const readonly = ["CERRADA", "CANCELADA"].includes(ot.status);

  const TAB_STYLE = (active) => ({
    padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600,
    background: active ? "#fff" : "transparent",
    color: active ? C.deep : "#9CA3AF",
    borderBottom: active ? `2px solid ${C.mid}` : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <Layout>
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: C.bg }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "#64748B" }}>
          <button onClick={() => navigate("/operaciones/ot")} style={{ background: "none", border: "none", cursor: "pointer", color: C.mid, fontWeight: 600, padding: 0, fontSize: 13 }}>
            ← Órdenes de Trabajo
          </button>
          <span>›</span>
          <span style={{ fontFamily: "monospace", background: "var(--primary-soft)", color: C.mid, padding: "1px 8px", borderRadius: 4, fontWeight: 700 }}>{ot.code}</span>
        </div>

        {/* Header card */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", marginBottom: 16, overflow: "hidden" }}>
          {/* Barra de color por estado */}
          <div style={{ height: 4, background: scfg.border }} />

          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{
                    background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.border}`,
                    padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  }}>{scfg.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tipo.color, background: tipo.color + "15", padding: "2px 9px", borderRadius: 20 }}>
                    {tipo.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: prio.color }}>{prio.label}</span>
                </div>

                <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: C.deep, lineHeight: 1.3 }}>{ot.titulo}</h1>
                {ot.descripcion && <p style={{ margin: "0 0 10px", color: "#64748B", fontSize: 13 }}>{ot.descripcion}</p>}

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#64748B" }}>
                  {ot.plan_code && (
                    <span>📋 Plan: <strong style={{ color: C.mid }}>{ot.plan_code}</strong></span>
                  )}
                  {ot.lugar_trabajo && <span>📍 {ot.lugar_trabajo}</span>}
                  {ot.asignado_nombre && <span>👤 {ot.asignado_nombre}</span>}
                  <span>📅 Creado: {fmt(ot.created_at)}</span>
                </div>
              </div>

              {/* KPIs mini */}
              <div style={{ display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", textAlign: "center", border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700 }}>Checklist</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.mid }}>
                    {(ot.checklist ?? []).filter(i => i.completado).length}/{(ot.checklist ?? []).length}
                  </div>
                </div>
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", textAlign: "center", border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700 }}>Materiales</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.mid }}>{(ot.materiales ?? []).length}</div>
                </div>
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", textAlign: "center", border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700 }}>Horas reales</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.deep }}>
                    {ot.horas_reales != null ? `${ot.horas_reales.toFixed(1)}h` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de acciones */}
        {!readonly && (
          <div style={{ marginBottom: 16 }}>
            <AccionesPanel ot={ot} onRefresh={load} />
          </div>
        )}

        {readonly && (
          <div style={{
            background: scfg.bg, border: `1px solid ${scfg.border}`,
            borderRadius: 10, padding: "10px 16px", marginBottom: 16,
            fontSize: 13, color: scfg.color, fontWeight: 600,
          }}>
            {ot.status === "CERRADA"
              ? `🔒 OT cerrada el ${fmt(ot.fecha_fin_real, true)} — ${ot.horas_reales?.toFixed(2) ?? "0"} horas reales registradas`
              : "✕ OT cancelada — solo lectura"}
          </div>
        )}

        {/* Tabs */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", padding: "0 16px" }}>
            {[
              { key: "checklist",   label: `✓ Checklist (${(ot.checklist ?? []).length})` },
              { key: "materiales",  label: `📦 Materiales (${(ot.materiales ?? []).length})` },
              { key: "tiempos",     label: "⏱ Tiempos" },
              { key: "comparativa", label: "📊 Plan vs Real" },
            ].map(t => (
              <button key={t.key} style={TAB_STYLE(tab === t.key)} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: 24 }}>
            {tab === "checklist"   && <ChecklistSection  ot={ot} onRefresh={load} readonly={readonly} />}
            {tab === "materiales"  && <MaterialesSection ot={ot} warehouses={warehouses} onRefresh={load} readonly={readonly} />}
            {tab === "tiempos"     && <TiemposSection    ot={ot} onRefresh={load} readonly={readonly} />}
            {tab === "comparativa" && <ComparativaSection otId={ot.id} />}
          </div>
        </div>

      </div>
    </Layout>
  );
}
