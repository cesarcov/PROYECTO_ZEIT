import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  PENDING:   { label: "Pendiente",   bg: "#FEF9C3", color: "#854D0E", next: "ORDERED" },
  ORDERED:   { label: "Ordenado",    bg: "#DBEAFE", color: "#1E40AF", next: "RECEIVED" },
  RECEIVED:  { label: "Recibido",    bg: "#DCFCE7", color: "#166534", next: null },
  CANCELLED: { label: "Cancelado",   bg: "#F3F4F6", color: "#6B7280", next: null },
};

const PRIORITY_CFG = {
  LOW:    { label: "Baja",    bg: "#F3F4F6", color: "#6B7280" },
  NORMAL: { label: "Normal",  bg: "#DBEAFE", color: "#1E40AF" },
  HIGH:   { label: "Alta",    bg: "#FEF9C3", color: "#92400E" },
  URGENT: { label: "Urgente", bg: "#FEE2E2", color: "#DC2626" },
};

const SOURCE_CFG = {
  MANUAL:   { label: "Manual",    icon: "✏️" },
  AUTO_GAP: { label: "Brecha",    icon: "📊" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: "#F3F4F6", color: "#6B7280" };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] ?? { label: priority, bg: "#F3F4F6", color: "#6B7280" };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}

// ── New item modal ─────────────────────────────────────────────────────────────
function NewItemModal({ projects, materials, onClose, onCreated }) {
  const [form, setForm] = useState({
    material_id: "", material_name_free: "", qty_needed: "", unit: "",
    project_id: "", reason: "", priority: "NORMAL", supplier_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.qty_needed || Number(form.qty_needed) <= 0)
      return setErr("La cantidad es obligatoria y debe ser mayor a 0");
    if (!form.material_id && !form.material_name_free.trim())
      return setErr("Selecciona un material del catálogo o escribe un nombre libre");
    setSaving(true); setErr("");
    try {
      await apiFetch("/logistics/purchases", {
        method: "POST",
        body: JSON.stringify({
          material_id:       form.material_id || null,
          material_name_free:form.material_name_free.trim() || null,
          qty_needed:        Number(form.qty_needed),
          unit:              form.unit.trim() || null,
          project_id:        form.project_id || null,
          reason:            form.reason.trim() || null,
          priority:          form.priority,
          supplier_notes:    form.supplier_notes.trim() || null,
        }),
      });
      onCreated();
    } catch (e) { setErr(e.message || "Error al guardar"); }
    finally { setSaving(false); }
  };

  const inp = { width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0B2E33" }}>Agregar a lista de compras</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#9CA3AF", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Material del catálogo</label>
            <select value={form.material_id} onChange={set("material_id")} style={inp}
              onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"}>
              <option value="">— Seleccionar del catálogo —</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>O nombre libre (si no está en catálogo)</label>
            <input type="text" placeholder="Ej: Cable submarino 1/0 AWG..." value={form.material_name_free}
              onChange={set("material_name_free")} style={inp}
              onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Cantidad *</label>
              <input type="number" min="0.01" step="0.01" placeholder="Ej: 50" value={form.qty_needed}
                onChange={set("qty_needed")} style={inp}
                onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={lbl}>Unidad</label>
              <input type="text" placeholder="und / m / kg" value={form.unit}
                onChange={set("unit")} style={inp}
                onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Proyecto (opcional)</label>
              <select value={form.project_id} onChange={set("project_id")} style={inp}
                onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"}>
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Prioridad</label>
              <select value={form.priority} onChange={set("priority")} style={inp}
                onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"}>
                {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Motivo / Justificación</label>
            <textarea rows={2} placeholder="¿Por qué se necesita comprar este ítem?" value={form.reason}
              onChange={set("reason")} style={{ ...inp, resize: "none", fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
          </div>
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: "9px 20px", fontSize: 13, color: "#6B7280", background: "transparent", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ padding: "9px 24px", fontSize: 13, fontWeight: 700, background: "#0B2E33", color: "white", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Guardando..." : "Agregar a lista"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const STATUS_TABS = ["ALL", "PENDING", "ORDERED", "RECEIVED", "CANCELLED"];
const COLS = "36px 1fr 80px 80px 90px 80px 80px 120px";

export default function PurchaseListView() {
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch]   = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemRes, projRes, matRes] = await Promise.allSettled([
      apiFetch("/logistics/purchases"),
      apiFetch("/logistics/projects"),
      apiFetch("/logistics/materials"),
    ]);
    if (itemRes.status === "fulfilled") setItems(Array.isArray(itemRes.value) ? itemRes.value : []);
    if (projRes.status === "fulfilled") setProjects(Array.isArray(projRes.value) ? projRes.value : []);
    if (matRes.status  === "fulfilled") setMaterials(Array.isArray(matRes.value) ? matRes.value : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchStatus = async (id, status) => {
    await apiFetch(`/logistics/purchases/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const removeItem = async (id) => {
    if (!confirm("¿Eliminar este ítem de la lista de compras?")) return;
    await apiFetch(`/logistics/purchases/${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString("es-PE");

    const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const STATUS_ORDER   = { PENDING: 0, ORDERED: 1, RECEIVED: 2, CANCELLED: 3 };

    const sorted = [...filtered].sort((a, b) => {
      const sd = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (sd !== 0) return sd;
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    });

    // Hoja 1: lista completa
    const headers = ["#", "Material", "Código", "Cantidad", "Unidad", "Prioridad", "Origen", "Estado", "Proyecto", "Motivo / Justificación", "Notas Proveedor", "Fecha Agregado"];
    const rows = sorted.map((item, idx) => [
      idx + 1,
      item.material_name || item.material_name_free || "—",
      item.material_code  || "(fuera de catálogo)",
      item.qty_needed,
      item.unit           || "—",
      PRIORITY_CFG[item.priority]?.label || item.priority,
      SOURCE_CFG[item.source]?.label     || item.source,
      STATUS_CFG[item.status]?.label     || item.status,
      item.project_name   ? `${item.project_code} — ${item.project_name}` : "Sin proyecto",
      item.reason         || "",
      item.supplier_notes || "",
      item.created_at     ? new Date(item.created_at).toLocaleDateString("es-PE") : "—",
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws1["!cols"] = [
      { wch: 5 }, { wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 28 },
      { wch: 38 }, { wch: 24 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Lista de Compras");

    // Hoja 2: resumen por estado y por proyecto
    const byProject = {};
    items.forEach(it => {
      const key = it.project_name ? `${it.project_code} — ${it.project_name}` : "Sin proyecto";
      byProject[key] = (byProject[key] || 0) + 1;
    });

    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Resumen por Estado", "Ítems"],
      ...STATUS_TABS.filter(s => s !== "ALL").map(s => [
        STATUS_CFG[s]?.label || s,
        items.filter(i => i.status === s).length,
      ]),
      ["TOTAL", items.length],
      [],
      ["Resumen por Proyecto", "Ítems"],
      ...Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]),
    ]);
    ws2["!cols"] = [{ wch: 36 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

    XLSX.writeFile(wb, `lista_compras_${today.replace(/\//g, "-")}.xlsx`);
  };

  const filtered = items.filter(i => {
    if (tab !== "ALL" && i.status !== tab) return false;
    if (projectFilter && i.project_id !== projectFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.material_name?.toLowerCase().includes(q) &&
          !i.material_code?.toLowerCase().includes(q) &&
          !i.project_name?.toLowerCase().includes(q) &&
          !i.reason?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    ALL:       items.length,
    PENDING:   items.filter(i => i.status === "PENDING").length,
    ORDERED:   items.filter(i => i.status === "ORDERED").length,
    RECEIVED:  items.filter(i => i.status === "RECEIVED").length,
    CANCELLED: items.filter(i => i.status === "CANCELLED").length,
  };

  const urgentCount = items.filter(i => i.status === "PENDING" && i.priority === "URGENT").length;
  const pendingValue = items.filter(i => i.status === "PENDING").length;

  return (
    <Layout>
      {showNew && (
        <NewItemModal
          projects={projects} materials={materials}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B2E33", margin: 0 }}>Lista de Compras</h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Materiales y equipos pendientes de adquirir — general y por proyecto
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={load}
              style={{ padding: "9px 16px", fontSize: 13, fontWeight: 500, background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 9, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}>
              ↻ Actualizar
            </button>
            {items.length > 0 && (
              <button onClick={exportExcel}
                style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", borderRadius: 9, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#DCFCE7"}
                onMouseLeave={e => e.currentTarget.style.background = "#F0FDF4"}>
                ↓ Excel
              </button>
            )}
            <button onClick={() => setShowNew(true)}
              style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#0B2E33", color: "white", border: "none", borderRadius: 9, cursor: "pointer" }}>
              + Agregar ítem
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total en lista",   value: counts.ALL,      accent: "#4F7C82", bg: "#F0F9FA",  valColor: "#0B2E33" },
            { label: "Pendientes",       value: pendingValue,    accent: "#D97706", bg: "#FFFBEB",  valColor: "#B45309" },
            { label: "Urgentes",         value: urgentCount,     accent: "#DC2626", bg: "#FEF2F2",  valColor: "#DC2626" },
            { label: "Ordenados",        value: counts.ORDERED,  accent: "#1D4ED8", bg: "#EFF6FF",  valColor: "#1D4ED8" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: "14px 18px", borderLeft: `4px solid ${k.accent}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{k.label}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: k.valColor, lineHeight: 1.2, margin: "4px 0 0" }}>{loading ? "—" : k.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "white", cursor: "pointer" }}>
            <option value="">Todos los proyectos</option>
            <option value="__none__">Sin proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          {projectFilter && projectFilter !== "__none__" && (
            <button onClick={() => navigate(`/logistics/projects/${projectFilter}`)}
              style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", background: "#0B2E33", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Ver proyecto 360° →
            </button>
          )}
          <input type="text" placeholder="Buscar material, proyecto, motivo..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}
            onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_TABS.map(s => {
            const active = tab === s;
            const cfg = s === "ALL"
              ? { label: "Todos", bg: "#0B2E33" }
              : { ...STATUS_CFG[s], bg: STATUS_CFG[s]?.color };
            return (
              <button key={s} onClick={() => setTab(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: active ? "none" : "1px solid #E5E7EB",
                  background: active ? (s === "ALL" ? "#0B2E33" : STATUS_CFG[s]?.color ?? "#0B2E33") : "white",
                  color: active ? "white" : "#6B7280",
                  boxShadow: active ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}>
                {s === "ALL" ? "Todos" : STATUS_CFG[s]?.label}
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: active ? "rgba(255,255,255,0.2)" : "#F3F4F6", color: active ? "white" : "#6B7280" }}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>
            {filtered.length} de {items.length}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF" }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛒</div>
            <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>
              {items.length === 0 ? "La lista de compras está vacía" : "Sin ítems para este filtro"}
            </p>
            {items.length === 0 && (
              <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 6 }}>
                Los ítems se agregan manualmente o automáticamente desde el análisis de brecha de proyectos
              </p>
            )}
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: COLS, background: "#0B2E33", padding: "0 4px" }}>
              {["#", "Material", "Cantidad", "Unidad", "Prioridad", "Origen", "Estado", "Proyecto / Acciones"].map((h, i) => (
                <div key={h} style={{ padding: "11px 10px", fontSize: 10, fontWeight: 700, color: "rgba(184,227,233,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i === 0 ? "center" : "left" }}>
                  {h}
                </div>
              ))}
            </div>

            {filtered.map((item, i) => {
              const isUrgent = item.priority === "URGENT" && item.status === "PENDING";
              return (
                <div key={item.id}
                  style={{
                    display: "grid", gridTemplateColumns: COLS, padding: "0 4px",
                    background: isUrgent ? "#FFF7F7" : i % 2 === 0 ? "white" : "#FAFAFA",
                    borderBottom: "1px solid #F3F4F6", alignItems: "center",
                    borderLeft: isUrgent ? "3px solid #EF4444" : "3px solid transparent",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F0F9FA"}
                  onMouseLeave={e => e.currentTarget.style.background = isUrgent ? "#FFF7F7" : i % 2 === 0 ? "white" : "#FAFAFA"}
                >
                  <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: "#D1D5DB", fontWeight: 600 }}>{i + 1}</div>

                  {/* Material */}
                  <div style={{ padding: "10px 10px" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0B2E33", margin: 0 }}>
                      {item.material_name || item.material_name_free || "—"}
                    </p>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                      {item.material_code && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#9CA3AF", background: "#F3F4F6", padding: "1px 5px", borderRadius: 4 }}>{item.material_code}</span>}
                      {!item.material_id && <span style={{ fontSize: 10, color: "#D97706", fontStyle: "italic" }}>fuera de catálogo</span>}
                    </div>
                    {item.reason && <p style={{ fontSize: 11, color: "#6B7280", margin: "3px 0 0", lineHeight: 1.3 }}>{item.reason.length > 50 ? item.reason.slice(0, 50) + "…" : item.reason}</p>}
                  </div>

                  {/* Qty */}
                  <div style={{ padding: "10px 10px", fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: "#0B2E33" }}>
                    {item.qty_needed.toLocaleString()}
                  </div>

                  {/* Unit */}
                  <div style={{ padding: "10px 10px", fontSize: 12, color: "#6B7280" }}>{item.unit || "—"}</div>

                  {/* Priority */}
                  <div style={{ padding: "10px 10px" }}><PriorityBadge priority={item.priority} /></div>

                  {/* Source */}
                  <div style={{ padding: "10px 10px" }}>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>
                      {SOURCE_CFG[item.source]?.icon} {SOURCE_CFG[item.source]?.label ?? item.source}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{ padding: "10px 10px" }}><StatusBadge status={item.status} /></div>

                  {/* Project + Actions */}
                  <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
                    {item.project_id ? (
                      <button onClick={() => navigate(`/logistics/projects/${item.project_id}`)}
                        style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4", cursor: "pointer", textAlign: "left" }}>
                        {item.project_code} →
                      </button>
                    ) : <span style={{ fontSize: 10, color: "#D1D5DB" }}>Sin proyecto</span>}

                    <div style={{ display: "flex", gap: 4 }}>
                      {STATUS_CFG[item.status]?.next && (
                        <button onClick={() => patchStatus(item.id, STATUS_CFG[item.status].next)}
                          style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", cursor: "pointer" }}>
                          {item.status === "PENDING" ? "✓ Ordenar" : "✓ Recibir"}
                        </button>
                      )}
                      {item.status !== "CANCELLED" && item.status !== "RECEIVED" && (
                        <button onClick={() => patchStatus(item.id, "CANCELLED")}
                          style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB", cursor: "pointer" }}>
                          ✕
                        </button>
                      )}
                      <button onClick={() => removeItem(item.id)}
                        style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", cursor: "pointer" }}>
                        🗑
                      </button>
                    </div>
                    <div style={{ fontSize: 9, color: "#D1D5DB" }}>{fmt(item.created_at)}</div>
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ padding: "10px 20px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                💡 Los ítems con origen <strong>Brecha</strong> se generan automáticamente desde el análisis de requerimientos de proyecto
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{filtered.length} ítems</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
