import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import MaterialGroupsModal from "./MaterialGroupsModal";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtMoney(n) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }).format(n ?? 0);
}
function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

const STOCK_CFG = {
  AVAILABLE:      { label: "En stock",      bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
  PARTIAL:        { label: "Stock parcial", bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308" },
  NEEDS_PURCHASE: { label: "Comprar",       bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
};

const SUB_CFG = {
  PENDING:   { label: "Por enviar",   bg: "#F3F4F6", color: "#6B7280" },
  IN_REVIEW: { label: "En revisión",  bg: "#DBEAFE", color: "#1D4ED8" },
  APPROVED:  { label: "Aprobado",     bg: "#DCFCE7", color: "#166534" },
  PARTIAL:   { label: "Parcial",      bg: "#FEF9C3", color: "#854D0E" },
  REJECTED:  { label: "Rechazado",    bg: "#FEE2E2", color: "#991B1B" },
};

const SUB_STATUS_CFG = {
  PENDING:  { label: "Pendiente",  bg: "#FEF9C3", color: "#854D0E" },
  PARTIAL:  { label: "Revisado parcialmente", bg: "#FEF3C7", color: "#92400E" },
  APPROVED: { label: "Aprobado",   bg: "#DCFCE7", color: "#166534" },
  REJECTED: { label: "Rechazado",  bg: "#FEE2E2", color: "#991B1B" },
};

function Badge({ cfg, label }) {
  const c = cfg ?? { label, bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ background: c.bg, color: c.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}

function StockBadge({ status }) {
  const cfg = STOCK_CFG[status] ?? { label: status, bg: "#F3F4F6", color: "#374151", dot: "#9CA3AF" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cfg.bg, color: cfg.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Add material modal ─────────────────────────────────────────────────────────
function AddMaterialModal({ token, planId, onClose, onAdded }) {
  const [materials, setMaterials] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState("1");
  const [wear, setWear] = useState("100");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [proposing, setProposing] = useState(false);
  const [propName, setPropName] = useState("");
  const [propCat, setPropCat] = useState("Sin categoría");
  const [propCost, setPropCost] = useState("");
  const [propNotes, setPropNotes] = useState("");

  useEffect(() => {
    fetch(`${API}/logistics/materials`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { const m = Array.isArray(d) ? d : []; setMaterials(m); setFiltered(m); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? materials.filter(m =>
      m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) ||
      (m.category ?? "").toLowerCase().includes(q)
    ) : materials);
  }, [search, materials]);

  const submit = async () => {
    if (!selected) return setErr("Selecciona un material");
    const qtyNum = parseFloat(qty);
    if (!qtyNum || qtyNum <= 0) return setErr("Cantidad debe ser mayor a 0");
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API}/operations/plans/${planId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ material_id: selected.id, quantity: qtyNum, wear_percentage: parseFloat(wear) || 100, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error");
      onAdded();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const submitPropose = async () => {
    if (!propName.trim()) return setErr("El nombre del material es obligatorio");
    const qtyNum = parseFloat(qty);
    if (!qtyNum || qtyNum <= 0) return setErr("Cantidad debe ser mayor a 0");
    setLoading(true); setErr("");
    try {
      const propRes = await fetch(`${API}/operations/materials/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: propName.trim(), category: propCat, unit_cost: propCost ? parseFloat(propCost) : null, notes: propNotes.trim() || null }),
      });
      const propData = await propRes.json();
      if (!propRes.ok) throw new Error(propData.detail ?? "Error al proponer material");
      const addRes = await fetch(`${API}/operations/plans/${planId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ material_id: propData.id, quantity: qtyNum, wear_percentage: parseFloat(wear) || 100 }),
      });
      const addData = await addRes.json();
      if (!addRes.ok) throw new Error(addData.detail ?? "Error al añadir al plan");
      onAdded();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const inp = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box" };
  const CATS = ["Sin categoría", "EPP", "Herramienta", "Equipo", "Consumible", "Repuesto", "Material", "Instrumento", "Accesorio"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 540, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 4px", color: "#0B2E33", fontSize: 16 }}>
          {proposing ? "Proponer nuevo material" : "Agregar material al plan"}
        </h3>
        {proposing && <p style={{ margin: "0 0 14px", color: "#64748B", fontSize: 12 }}>El precio que coloques es tentativo — logística lo validará.</p>}

        {!proposing ? (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código o categoría..." style={{ ...inp, marginBottom: 10 }} autoFocus />
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 7, marginBottom: 12, maxHeight: 220 }}>
              {filtered.slice(0, 50).map(m => (
                <div key={m.id} onClick={() => setSelected(m)} style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F1F5F9", background: selected?.id === m.id ? "#EFF6FF" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#1E293B" }}>{m.name}</span>
                    <span style={{ color: "#94A3B8", marginLeft: 8, fontSize: 11 }}>{m.code}</span>
                    {m.validation_status === "PENDING" && <span style={{ marginLeft: 6, background: "#FEF9C3", color: "#854D0E", fontSize: 10, padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>propuesto</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {m.category && <span style={{ background: "#F0F9FA", color: "#4F7C82", padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{m.category}</span>}
                    {m.unit_cost != null && <span style={{ color: "#64748B", fontSize: 11 }}>{fmtMoney(m.unit_cost)}</span>}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: "18px 20px", textAlign: "center" }}>
                  <div style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 10 }}>No se encontró "{search}" en el catálogo</div>
                  <button onClick={() => { setPropName(search); setProposing(true); setErr(""); }} style={{ background: "#FEF9C3", color: "#854D0E", border: "1px solid #FDE68A", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    + Proponer este material nuevo
                  </button>
                </div>
              )}
            </div>
            {selected && (
              <div style={{ background: "#F0F9FA", borderRadius: 8, padding: "9px 13px", marginBottom: 12, fontSize: 13, color: "#0B2E33" }}>
                <strong>{selected.name}</strong>{selected.unit_cost != null ? ` — ${fmtMoney(selected.unit_cost)} c/u` : " — precio pendiente"}
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>Nombre *</label>
            <input value={propName} onChange={e => setPropName(e.target.value)} style={{ ...inp, marginBottom: 10 }} autoFocus />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>Categoría</label>
                <select value={propCat} onChange={e => setPropCat(e.target.value)} style={inp}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>Precio tentativo (S/)</label>
                <input type="number" min="0" step="any" value={propCost} onChange={e => setPropCost(e.target.value)} style={inp} placeholder="Opcional" />
              </div>
            </div>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>Descripción / motivo</label>
            <input value={propNotes} onChange={e => setPropNotes(e.target.value)} style={inp} placeholder="Ej: Para instalación eléctrica zona norte" />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>Cantidad *</label>
            <input type="number" min="0.001" step="any" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>% Desgaste / Consumo</label>
            <input type="number" min="0" max="100" step="any" value={wear} onChange={e => setWear(e.target.value)} style={inp} placeholder="100" />
          </div>
        </div>
        {!proposing && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3 }}>Notas (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observación..." style={inp} />
          </div>
        )}

        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 10px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <div>{proposing && <button onClick={() => { setProposing(false); setErr(""); }} style={{ background: "none", border: "none", color: "#4F7C82", cursor: "pointer", fontSize: 13 }}>← Volver</button>}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
            {proposing
              ? <button onClick={submitPropose} disabled={loading} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#EAB308", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{loading ? "Enviando..." : "Proponer y añadir"}</button>
              : <button onClick={submit} disabled={loading || !selected} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#4F7C82", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: selected ? 1 : 0.6 }}>{loading ? "Agregando..." : "Agregar"}</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Submit modal ───────────────────────────────────────────────────────────────
function SubmitModal({ onClose, onSubmit, pendingCount, submissionNumber }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 26, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 6px", color: "#0B2E33", fontSize: 16 }}>Enviar Requerimiento #{submissionNumber}</h3>
        <p style={{ margin: "0 0 14px", color: "#64748B", fontSize: 13 }}>
          Se enviarán <strong>{pendingCount}</strong> ítem(s) nuevos a logística como un lote numerado.
          Los ítems anteriores no se repiten.
        </p>
        <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Justificación (opcional)</label>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Ej: Materiales adicionales identificados en visita de campo..."
          style={{ width: "100%", padding: 9, borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, resize: "vertical", marginBottom: 16, boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => onSubmit(reason)} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#4F7C82", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            Enviar Req. #{submissionNumber}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline editable cell ──────────────────────────────────────────────────────
function EditableCell({ value, onSave, min, max, suffix = "" }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));
  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(local);
    if (!isNaN(parsed) && parsed !== value) onSave(parsed);
    else setLocal(String(value));
  };
  if (editing) {
    return (
      <input
        type="number" min={min} max={max} step="any" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setLocal(String(value)); } }}
        autoFocus
        style={{ width: 70, padding: "3px 6px", borderRadius: 5, border: "1.5px solid #4F7C82", fontSize: 13, textAlign: "right" }}
      />
    );
  }
  return (
    <span onClick={() => { setLocal(String(value)); setEditing(true); }} title="Clic para editar"
      style={{ cursor: "text", padding: "3px 7px", borderRadius: 5, fontSize: 13, border: "1px dashed #CBD5E1", background: "#F8FAFC", display: "inline-block", minWidth: 60, textAlign: "right" }}>
      {value}{suffix}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ProjectPlanView() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const [plan, setPlan] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, subRes] = await Promise.all([
        fetch(`${API}/operations/plans/${planId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/operations/plans/${planId}/submissions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.detail ?? "Error");
      setPlan(planData);
      const subData = await subRes.json();
      setSubmissions(Array.isArray(subData) ? subData : []);
    } catch (e) { setActionErr(e.message); }
    finally { setLoading(false); }
  }, [planId, token]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg, isErr = false) => {
    if (isErr) setActionErr(msg); else setActionMsg(msg);
    setTimeout(() => { setActionErr(""); setActionMsg(""); }, 3500);
  };

  const removeItem = async (itemId) => {
    try {
      const res = await fetch(`${API}/operations/plans/${planId}/items/${itemId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      load();
    } catch (e) { flash(e.message, true); }
  };

  const patchItem = async (itemId, body) => {
    try {
      const res = await fetch(`${API}/operations/plans/${planId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      load();
    } catch (e) { flash(e.message, true); }
  };

  const doSubmit = async (reason) => {
    setShowSubmit(false);
    try {
      const res = await fetch(`${API}/operations/plans/${planId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error");
      flash(`Requerimiento #${data.submission_number} enviado a logística (${data.items_sent} ítems)`);
      load();
    } catch (e) { flash(e.message, true); }
  };

  const palette = { deep: "#0B2E33", dark: "#4F7C82", mid: "#93B1B5", light: "#B8E3E9" };

  if (loading) return <Layout><div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Cargando plan...</div></Layout>;
  if (!plan) return <Layout><div style={{ padding: 40, color: "#DC2626" }}>{actionErr || "Plan no encontrado"}</div></Layout>;

  const items     = plan.items ?? [];
  const pending   = items.filter(i => i.submission_status === "PENDING");
  const totalCost = items.reduce((acc, i) => acc + i.quantity * i.unit_cost * (i.wear_percentage / 100), 0);
  const nextSubNum = (submissions[0]?.submission_number ?? 0) + 1;

  const byCategory = items.reduce((acc, item) => {
    const cat = item.category || "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <Layout>
      <div style={{ padding: "24px 32px", minHeight: "100vh", background: "#F0F9FA" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "#64748B" }}>
          <span onClick={() => navigate("/operations/plans")} style={{ cursor: "pointer", color: palette.dark }}>Mis proyectos</span>
          <span>›</span>
          <span style={{ color: "#1E293B" }}>{plan.title}</span>
        </div>

        {/* Banner */}
        <div style={{ background: `linear-gradient(135deg, ${palette.deep} 0%, #1A4A50 100%)`, borderRadius: 14, padding: "22px 28px", marginBottom: 22, color: "#fff", display: "grid", gridTemplateColumns: "1fr auto" }}>
          <div>
            <div style={{ fontSize: 12, color: palette.light, letterSpacing: "0.6px", fontWeight: 700 }}>PROYECTO</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{plan.project_name}</div>
            <div style={{ fontSize: 12, color: palette.mid, marginTop: 3 }}>[{plan.project_code}] · Ingeniero: {plan.engineer_name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: palette.light, letterSpacing: "0.6px", fontWeight: 700 }}>COSTO ESTIMADO TOTAL</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>{fmtMoney(totalCost)}</div>
            <div style={{ fontSize: 11, color: palette.mid, marginTop: 2 }}>
              {items.length} ítem(s) · {pending.length} por enviar · {submissions.length} req. enviado(s)
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Por enviar",   value: pending.length,                                                        color: "#64748B" },
            { label: "En revisión",  value: items.filter(i => i.submission_status === "IN_REVIEW").length,         color: "#1D4ED8" },
            { label: "Aprobados",    value: items.filter(i => ["APPROVED","PARTIAL"].includes(i.submission_status)).length, color: "#22C55E" },
            { label: "Rechazados",   value: items.filter(i => i.submission_status === "REJECTED").length,          color: "#EF4444" },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", borderRadius: 9, padding: "13px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Messages */}
        {actionMsg && <div style={{ background: "#DCFCE7", color: "#166534", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{actionMsg}</div>}
        {actionErr && <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{actionErr}</div>}

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 1fr 50px", background: palette.deep, color: palette.light, padding: "11px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px" }}>
            <span>MATERIAL</span>
            <span style={{ textAlign: "right" }}>CANTIDAD</span>
            <span style={{ textAlign: "center" }}>STOCK</span>
            <span style={{ textAlign: "right" }}>DISP.</span>
            <span style={{ textAlign: "right" }}>COSTO UNIT.</span>
            <span style={{ textAlign: "center" }}>% DESGASTE</span>
            <span style={{ textAlign: "right" }}>COSTO EFEC.</span>
            <span style={{ textAlign: "center" }}>ESTADO ENV.</span>
            <span></span>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              Aún no hay materiales. Haz clic en "Agregar material" para comenzar.
            </div>
          ) : (
            Object.entries(byCategory).map(([cat, catItems]) => (
              <div key={cat}>
                <div style={{ background: "#F8FAFC", padding: "6px 20px", borderBottom: "1px solid #E2E8F0", borderTop: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" }}>{cat.toUpperCase()}</span>
                </div>
                {catItems.map((item, idx) => {
                  const effCost = item.quantity * item.unit_cost * (item.wear_percentage / 100);
                  const canEdit = item.submission_status === "PENDING";
                  return (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 1fr 50px", padding: "12px 20px", alignItems: "center", borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFC", fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>{item.material_name}</div>
                        <div style={{ color: "#94A3B8", fontSize: 11 }}>{item.material_code}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {canEdit
                          ? <EditableCell value={item.quantity} min={0.001} onSave={v => patchItem(item.id, { quantity: v })} />
                          : <span style={{ fontSize: 13 }}>{item.quantity}</span>}
                      </div>
                      <div style={{ textAlign: "center" }}><StockBadge status={item.stock_status} /></div>
                      <div style={{ textAlign: "right", color: item.stock_available >= item.quantity ? "#16A34A" : "#EF4444", fontWeight: 600 }}>
                        {item.stock_available?.toFixed(2) ?? "—"}
                      </div>
                      <div style={{ textAlign: "right", color: "#475569" }}>{fmtMoney(item.unit_cost)}</div>
                      <div style={{ textAlign: "center" }}>
                        {canEdit
                          ? <EditableCell value={item.wear_percentage} min={0} max={100} suffix="%" onSave={v => patchItem(item.id, { wear_percentage: v })} />
                          : <span style={{ fontSize: 13 }}>{item.wear_percentage}%</span>}
                      </div>
                      <div style={{ textAlign: "right", fontWeight: 700, color: "#0B2E33" }}>{fmtMoney(effCost)}</div>
                      <div style={{ textAlign: "center" }}>
                        <Badge cfg={SUB_CFG[item.submission_status]} />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        {canEdit && (
                          <button onClick={() => removeItem(item.id)} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 16, padding: 4 }} onMouseEnter={e => e.target.style.color = "#EF4444"} onMouseLeave={e => e.target.style.color = "#CBD5E1"}>✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {items.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 1fr 50px", padding: "13px 20px", background: "#F0F9FA", borderTop: "2px solid #E2E8F0", fontWeight: 700, fontSize: 13 }}>
              <span style={{ color: "#0B2E33" }}>TOTAL ESTIMADO</span>
              <span></span><span></span><span></span><span></span><span></span>
              <span style={{ textAlign: "right", fontSize: 15, color: "#0B2E33" }}>{fmtMoney(totalCost)}</span>
              <span></span><span></span>
            </div>
          )}
        </div>

        {/* Actions — always available */}
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowAdd(true)} style={{ padding: "10px 22px", borderRadius: 8, border: `2px solid ${palette.dark}`, background: "#fff", color: palette.dark, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              + Agregar material
            </button>
            <button onClick={() => setShowGroups(true)} style={{ padding: "10px 22px", borderRadius: 8, border: `2px solid #6B7280`, background: "#fff", color: "#374151", fontWeight: 700, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
              📦 Bóvedas
            </button>
            <button onClick={() => navigate(`/operations/plans/${planId}/presupuesto`)} style={{ padding: "10px 22px", borderRadius: 8, border: `2px solid #059669`, background: "#fff", color: "#059669", fontWeight: 700, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
              📄 Presupuesto / APU
            </button>
          </div>
          {pending.length > 0 && (
            <button onClick={() => setShowSubmit(true)} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: palette.dark, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Enviar Req. #{nextSubNum} ({pending.length} ítems nuevos)
            </button>
          )}
        </div>

        {/* ── Historial de requerimientos ─────────────────────── */}
        {submissions.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.8px", marginBottom: 12 }}>HISTORIAL DE REQUERIMIENTOS</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {submissions.map(s => {
                const cfg = SUB_STATUS_CFG[s.status] ?? { label: s.status, bg: "#F3F4F6", color: "#374151" };
                const reviewed = s.approved + s.rejected + s.partial;
                return (
                  <div key={s.id} style={{ background: "#fff", borderRadius: 10, padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${cfg.bg === "#DCFCE7" ? "#22C55E" : cfg.bg === "#FEE2E2" ? "#EF4444" : "#EAB308"}` }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0B2E33" }}>
                        Requerimiento #{s.submission_number}
                        <span style={{ marginLeft: 10, background: cfg.bg, color: cfg.color, padding: "2px 9px", borderRadius: 20, fontSize: 11 }}>{cfg.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                        {fmt(s.submitted_at)} · {s.item_count} ítems · {reviewed}/{s.item_count} revisados
                        {s.reason && ` · "${s.reason}"`}
                      </div>
                      {s.logistics_notes && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, fontStyle: "italic" }}>Nota logística: {s.logistics_notes}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, textAlign: "center" }}>
                      {s.approved > 0 && <div><div style={{ fontWeight: 700, color: "#22C55E", fontSize: 16 }}>{s.approved}</div><div style={{ color: "#64748B" }}>aprobados</div></div>}
                      {s.partial  > 0 && <div><div style={{ fontWeight: 700, color: "#EAB308", fontSize: 16 }}>{s.partial}</div><div style={{ color: "#64748B" }}>parciales</div></div>}
                      {s.rejected > 0 && <div><div style={{ fontWeight: 700, color: "#EF4444", fontSize: 16 }}>{s.rejected}</div><div style={{ color: "#64748B" }}>rechazados</div></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddMaterialModal token={token} planId={planId} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
      {showSubmit && <SubmitModal pendingCount={pending.length} submissionNumber={nextSubNum} onClose={() => setShowSubmit(false)} onSubmit={doSubmit} />}
      {showGroups && (
        <MaterialGroupsModal
          token={token}
          planId={planId}
          onClose={() => setShowGroups(false)}
          onApplied={(count, groupName) => {
            setShowGroups(false);
            flash(`✓ Bóveda "${groupName}" aplicada — ${count} material(es) añadidos al plan`);
            load();
          }}
        />
      )}
    </Layout>
  );
}
