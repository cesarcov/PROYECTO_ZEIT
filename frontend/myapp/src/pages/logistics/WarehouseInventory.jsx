import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n);
}

// ── Category chip ──────────────────────────────────────────────────────────────
const CAT_CFG = {
  Herramienta: { bg: "#FEF3C7", color: "#92400E", icon: "🔧" },
  Equipo:      { bg: "#DBEAFE", color: "#1E40AF", icon: "⚡" },
  EPP:         { bg: "#D1FAE5", color: "#065F46", icon: "🦺" },
  Material:    { bg: "#F3F4F6", color: "#374151", icon: "📦" },
  Consumible:  { bg: "#FCE7F3", color: "#9D174D", icon: "🔩" },
  Repuesto:    { bg: "#EDE9FE", color: "#5B21B6", icon: "🔄" },
};

function CatChip({ category }) {
  const cfg = CAT_CFG[category] ?? { bg: "#F3F4F6", color: "#374151", icon: "📋" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: cfg.bg, color: cfg.color, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {cfg.icon} {category}
    </span>
  );
}

// ── Stock bar ──────────────────────────────────────────────────────────────────
function StockBar({ current, min }) {
  if (!min) return null;
  const pct = Math.min((current / (min * 2)) * 100, 100);
  const color = current <= 0 ? "#EF4444" : current <= min ? "#EAB308" : "#22C55E";
  return (
    <div style={{ width: 56, height: 4, background: "#E5E7EB", borderRadius: 99, overflow: "hidden", marginTop: 3 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  );
}

// ── Stock chip ─────────────────────────────────────────────────────────────────
function StockChip({ current, min }) {
  if (current <= 0)
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#FEE2E2", color: "#DC2626" }}>Sin stock</span>;
  if (min != null && current <= min)
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#FEF9C3", color: "#854D0E" }}>Stock bajo</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#DCFCE7", color: "#15803D" }}>OK</span>;
}

// ── Condition chip ─────────────────────────────────────────────────────────────
const COND_CFG = {
  NUEVO:                  { bg: "#D1FAE5", color: "#065F46", label: "Nuevo" },
  NUEVA:                  { bg: "#D1FAE5", color: "#065F46", label: "Nuevo" },
  BUENO:                  { bg: "#DCFCE7", color: "#15803D", label: "Bueno" },
  BUENA:                  { bg: "#DCFCE7", color: "#15803D", label: "Bueno" },
  REGULAR:                { bg: "#FEF9C3", color: "#854D0E", label: "Regular" },
  MALO:                   { bg: "#FEE2E2", color: "#DC2626", label: "Malo" },
  MALA:                   { bg: "#FEE2E2", color: "#DC2626", label: "Malo" },
  DAÑADO:                 { bg: "#FEE2E2", color: "#DC2626", label: "Dañado" },
  DAÑADA:                 { bg: "#FEE2E2", color: "#DC2626", label: "Dañada" },
  "REQUIERE MANTENIMIENTO": { bg: "#FEF3C7", color: "#92400E", label: "Req. mantenimiento" },
};

function ConditionChip({ cond }) {
  if (!cond) return <span style={{ fontSize: 10, color: "#D1D5DB" }}>—</span>;
  const key = cond.trim().toUpperCase();
  const cfg = COND_CFG[key] ?? { bg: "#F3F4F6", color: "#6B7280", label: cond };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── Movement type label ────────────────────────────────────────────────────────
const MV_LABELS = {
  IN: { label: "Entrada", color: "#15803D" },
  OUT: { label: "Salida", color: "#DC2626" },
  RETURN: { label: "Devolución", color: "#2563EB" },
  TRANSFER: { label: "Traslado", color: "#7C3AED" },
  ADJUST: { label: "Ajuste", color: "#D97706" },
};

// ── Location badge ─────────────────────────────────────────────────────────────
function LocationBadge({ rack, level, box }) {
  if (!rack && !level && !box) return <span style={{ fontSize: 11, color: "#D1D5DB", fontStyle: "italic" }}>Sin ubicación</span>;
  const code = [rack, level, box].filter(Boolean).join("-");
  return (
    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
      {code}
    </span>
  );
}

// ── Export Excel ───────────────────────────────────────────────────────────────
function exportToExcel(warehouse, items) {
  import("xlsx").then(({ utils, writeFile }) => {
    const wb = utils.book_new();

    // Sheet 1: Inventario completo
    const invRows = [
      ["Código", "Nombre", "Descripción", "Categoría", "Marca", "Modelo", "Unidad",
       "Stock disponible", "Stock mínimo", "Costo unitario", "Valor total",
       "Pasillo", "Estante", "Casillero", "Referencia de ubicación",
       "Último movimiento", "Fecha último mov.", "Notas último mov.",
       "Condición entrada", "Condición salida", "Notas devolución"],
      ...items.map(i => [
        i.code, i.name, i.description, i.category, i.brand || "", i.model || "",
        i.unit, i.stock_available, i.min_stock ?? "", i.unit_cost ?? "",
        i.unit_cost ? (i.unit_cost * i.stock_available).toFixed(2) : "",
        i.rack || "", i.level || "", i.box || "", i.location_ref || "",
        i.last_mv_type ? (MV_LABELS[i.last_mv_type]?.label ?? i.last_mv_type) : "",
        i.last_mv_at ? new Date(i.last_mv_at).toLocaleDateString("es-PE") : "",
        i.last_mv_notes || "",
        i.condition_in || "", i.condition_out || "", i.return_notes || "",
      ]),
    ];
    const wsInv = utils.aoa_to_sheet(invRows);
    wsInv["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 40 },
      { wch: 14 }, { wch: 18 }, { wch: 30 },
      { wch: 18 }, { wch: 18 }, { wch: 30 }];
    utils.book_append_sheet(wb, wsInv, "Inventario");

    // Sheet 2: Ubicaciones
    const locRows = [
      ["Código", "Nombre", "Categoría", "Pasillo", "Estante", "Casillero", "Referencia descriptiva"],
      ...items.filter(i => i.rack || i.level || i.box).map(i => [
        i.code, i.name, i.category, i.rack || "", i.level || "", i.box || "", i.location_ref || "",
      ]),
    ];
    utils.book_append_sheet(wb, utils.aoa_to_sheet(locRows), "Ubicaciones");

    // Sheet 3: Con daños / condición
    const condRows = [
      ["Código", "Nombre", "Categoría", "Condición entrada", "Condición salida", "Notas de devolución", "Fecha devolución"],
      ...items.filter(i => i.condition_in || i.condition_out || i.return_notes).map(i => [
        i.code, i.name, i.category,
        i.condition_in || "", i.condition_out || "", i.return_notes || "",
        i.returned_at ? new Date(i.returned_at).toLocaleDateString("es-PE") : "",
      ]),
    ];
    utils.book_append_sheet(wb, utils.aoa_to_sheet(condRows), "Condiciones");

    const date = new Date().toLocaleDateString("es-PE").replace(/\//g, "-");
    writeFile(wb, `Inventario_${warehouse.code}_${date}.xlsx`);
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
const COLS = "36px 1fr 100px 90px 120px 80px 100px 110px";

const TABS = [
  { key: "ALL",         label: "Todo",        icon: "▤" },
  { key: "LOW",         label: "Stock bajo",  icon: "⚠" },
  { key: "ZERO",        label: "Sin stock",   icon: "✕" },
  { key: "NODAMAGE",    label: "Sin daños",   icon: "✓" },
  { key: "DAMAGE",      label: "Con daños",   icon: "⚡" },
];

export default function WarehouseInventory() {
  const { warehouseId } = useParams();
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab]       = useState("ALL");
  const [catFilter, setCatFilter] = useState("");
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await apiFetch(`/logistics/warehouses/${warehouseId}/inventory`);
      setData(res);
    } catch (e) {
      setError(e.message || "Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items ?? [];
  const wh    = data?.warehouse ?? {};
  const summary = data?.summary ?? {};

  const categories = [...new Set(items.map(i => i.category))].sort();

  const isDamaged = (i) => {
    const c = (i.condition_in ?? "").trim().toUpperCase();
    return ["DAÑADO", "DAÑADA", "MALO", "MALA", "REQUIERE MANTENIMIENTO"].includes(c);
  };

  const filtered = items.filter(i => {
    if (catFilter && i.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !i.name?.toLowerCase().includes(q) &&
        !i.code?.toLowerCase().includes(q) &&
        !i.category?.toLowerCase().includes(q) &&
        !i.brand?.toLowerCase().includes(q) &&
        !i.rack?.toLowerCase().includes(q)
      ) return false;
    }
    if (tab === "ZERO")     return i.stock_available <= 0;
    if (tab === "LOW")      return i.stock_available > 0 && i.min_stock != null && i.stock_available <= i.min_stock;
    if (tab === "DAMAGE")   return isDamaged(i);
    if (tab === "NODAMAGE") return !isDamaged(i);
    return true;
  });

  const counts = {
    ALL:      items.length,
    LOW:      items.filter(i => i.stock_available > 0 && i.min_stock != null && i.stock_available <= i.min_stock).length,
    ZERO:     items.filter(i => i.stock_available <= 0).length,
    DAMAGE:   items.filter(isDamaged).length,
    NODAMAGE: items.filter(i => !isDamaged(i)).length,
  };

  if (loading) return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, color: "#9CA3AF", fontSize: 14 }}>
        Cargando inventario...
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "20px 24px", color: "#DC2626", fontSize: 14 }}>
        {error}
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Breadcrumb + Header ──────────────────────────────────────────── */}
        <div>
          <button onClick={() => navigate(-1)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 12 }}
            onMouseEnter={e => e.currentTarget.style.color = "#0B2E33"}
            onMouseLeave={e => e.currentTarget.style.color = "#6B7280"}
          >
            ← Volver a Almacenes
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              {/* Warehouse avatar */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#0B2E33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                🏭
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B2E33", margin: 0 }}>{wh.name}</h1>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, background: "#E0F2FE", color: "#0369A1", padding: "3px 8px", borderRadius: 6 }}>
                    {wh.code}
                  </span>
                </div>
                {wh.location && (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                    📍 {wh.location}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={load}
                style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                onMouseLeave={e => e.currentTarget.style.background = "white"}
              >
                ↻ Actualizar
              </button>
              <button onClick={() => exportToExcel(wh, items)}
                style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "#15803D", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#166534"}
                onMouseLeave={e => e.currentTarget.style.background = "#15803D"}
              >
                📊 Exportar Excel
              </button>
            </div>
          </div>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {[
            { label: "Total SKUs",      value: summary.total_skus,   accent: "#4F7C82", bg: "#F0F9FA",  valColor: "#0B2E33" },
            { label: "Unidades totales", value: (summary.total_units ?? 0).toLocaleString(), accent: "#0369A1", bg: "#F0F9FF", valColor: "#0369A1" },
            { label: "Disponibles OK",   value: (summary.total_skus ?? 0) - (summary.low_stock ?? 0) - (summary.zero_stock ?? 0), accent: "#15803D", bg: "#F0FDF4", valColor: "#15803D" },
            { label: "Stock bajo",       value: summary.low_stock,    accent: "#D97706", bg: "#FFFBEB",  valColor: "#B45309" },
            { label: "Con daños/obs.",   value: summary.with_damage,  accent: "#DC2626", bg: "#FEF2F2",  valColor: "#DC2626" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: "14px 16px", borderLeft: `4px solid ${k.accent}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{k.label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: k.valColor, lineHeight: 1.2, margin: "4px 0 0" }}>{k.value ?? 0}</p>
            </div>
          ))}
        </div>

        {/* ── Filtro categoría + búsqueda ───────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Categoría */}
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "white", cursor: "pointer" }}>
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c} value={c}>{CAT_CFG[c]?.icon ?? "📋"} {c}</option>
            ))}
          </select>

          {/* Search */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            background: "white", border: `2px solid ${focused ? "#4F7C82" : "#E5E7EB"}`,
            borderRadius: 10, padding: "0 12px", transition: "all 0.15s",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={focused ? "#4F7C82" : "#9CA3AF"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text" placeholder="Buscar por nombre, código, marca, rack..."
              value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, padding: "10px 0", background: "transparent", color: "#111827" }}
            />
            {search && (
              <button onClick={() => setSearch("")}
                style={{ background: "#E5E7EB", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(t => {
            const active = tab === t.key;
            const tabColors = {
              ALL:      { bg: "#0B2E33", badge: "rgba(255,255,255,0.2)" },
              LOW:      { bg: "#D97706", badge: "rgba(255,255,255,0.25)" },
              ZERO:     { bg: "#DC2626", badge: "rgba(255,255,255,0.25)" },
              DAMAGE:   { bg: "#7C2D12", badge: "rgba(255,255,255,0.25)" },
              NODAMAGE: { bg: "#15803D", badge: "rgba(255,255,255,0.25)" },
            };
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: active ? "none" : "1px solid #E5E7EB",
                  background: active ? tabColors[t.key].bg : "white",
                  color: active ? "white" : "#6B7280",
                  boxShadow: active ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                  transition: "all 0.15s",
                }}>
                <span style={{ fontSize: 11 }}>{t.icon}</span>
                {t.label}
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: active ? tabColors[t.key].badge : "#F3F4F6", color: active ? "white" : "#6B7280" }}>
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>
            {filtered.length} de {items.length} ítems
          </span>
        </div>

        {/* ── Tabla ─────────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
            <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>Sin ítems para este filtro</p>
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: COLS, background: "#0B2E33", padding: "0 4px" }}>
              {["#", "Material", "Categoría", "Cantidad", "Ubicación física", "Estado", "Condición", "Último mov."].map((h, i) => (
                <div key={h} style={{
                  padding: "11px 10px", fontSize: 10, fontWeight: 700,
                  color: "rgba(184,227,233,0.7)", textTransform: "uppercase", letterSpacing: "0.08em",
                  textAlign: i === 0 ? "center" : "left",
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {filtered.map((item, i) => {
              const isExp = expanded === item.material_id;
              const dmg = isDamaged(item);
              return (
                <div key={item.material_id}>
                  {/* Main row */}
                  <div
                    style={{
                      display: "grid", gridTemplateColumns: COLS,
                      padding: "0 4px",
                      background: dmg ? "#FFF7F7" : i % 2 === 0 ? "white" : "#FAFAFA",
                      borderBottom: isExp ? "none" : "1px solid #F3F4F6",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "background 0.12s",
                      borderLeft: dmg ? "3px solid #EF4444" : "3px solid transparent",
                    }}
                    onClick={() => setExpanded(isExp ? null : item.material_id)}
                    onMouseEnter={e => e.currentTarget.style.background = "#F0F9FA"}
                    onMouseLeave={e => e.currentTarget.style.background = dmg ? "#FFF7F7" : i % 2 === 0 ? "white" : "#FAFAFA"}
                  >
                    {/* # */}
                    <div style={{ padding: "13px 0", textAlign: "center", fontSize: 11, color: "#D1D5DB", fontWeight: 600 }}>{i + 1}</div>

                    {/* Material */}
                    <div style={{ padding: "10px 10px" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0B2E33", margin: 0, lineHeight: 1.3 }}>{item.name}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#9CA3AF", background: "#F3F4F6", padding: "1px 5px", borderRadius: 4 }}>{item.code}</span>
                        {item.brand && <span style={{ fontSize: 10, color: "#6B7280" }}>{item.brand}{item.model ? ` · ${item.model}` : ""}</span>}
                      </div>
                    </div>

                    {/* Categoría */}
                    <div style={{ padding: "10px 10px" }}>
                      <CatChip category={item.category} />
                    </div>

                    {/* Cantidad */}
                    <div style={{ padding: "10px 10px" }}>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: item.stock_available <= 0 ? "#DC2626" : "#0B2E33" }}>
                        {item.stock_available.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>{item.unit}{item.min_stock ? ` · mín: ${item.min_stock}` : ""}</div>
                      <StockBar current={item.stock_available} min={item.min_stock} />
                    </div>

                    {/* Ubicación */}
                    <div style={{ padding: "10px 10px" }}>
                      <LocationBadge rack={item.rack} level={item.level} box={item.box} />
                      {item.location_ref && (
                        <p style={{ fontSize: 10, color: "#6B7280", margin: "4px 0 0", lineHeight: 1.3 }}
                          title={item.location_ref}>
                          {item.location_ref.length > 35 ? item.location_ref.slice(0, 35) + "…" : item.location_ref}
                        </p>
                      )}
                    </div>

                    {/* Estado */}
                    <div style={{ padding: "10px 10px" }}>
                      <StockChip current={item.stock_available} min={item.min_stock} />
                      {item.unit_cost && (
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
                          {fmtMoney(item.unit_cost * item.stock_available)}
                        </div>
                      )}
                    </div>

                    {/* Condición */}
                    <div style={{ padding: "10px 10px" }}>
                      {item.condition_in ? (
                        <>
                          <ConditionChip cond={item.condition_in} />
                          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 3 }}>al regresar</div>
                        </>
                      ) : item.condition_out ? (
                        <>
                          <ConditionChip cond={item.condition_out} />
                          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 3 }}>al salir</div>
                        </>
                      ) : (
                        <span style={{ fontSize: 10, color: "#D1D5DB" }}>Sin registro</span>
                      )}
                    </div>

                    {/* Último movimiento */}
                    <div style={{ padding: "10px 10px" }}>
                      {item.last_mv_type ? (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 700, color: MV_LABELS[item.last_mv_type]?.color ?? "#374151" }}>
                            {MV_LABELS[item.last_mv_type]?.label ?? item.last_mv_type}
                          </span>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{fmt(item.last_mv_at)}</div>
                          {item.last_mv_qty != null && (
                            <div style={{ fontSize: 10, color: "#6B7280" }}>qty: {item.last_mv_qty}</div>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 10, color: "#D1D5DB" }}>—</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExp && (
                    <div style={{
                      background: "#F8FAFC", borderBottom: "1px solid #E5E7EB",
                      padding: "16px 20px 16px 56px",
                      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
                      borderLeft: dmg ? "3px solid #EF4444" : "3px solid #4F7C82",
                    }}>
                      {/* Descripción */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Descripción</div>
                        <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5 }}>{item.description || "Sin descripción"}</p>
                        {item.brand && <p style={{ fontSize: 12, color: "#6B7280", margin: "6px 0 0" }}>Marca: <strong>{item.brand}</strong>{item.model ? ` · Modelo: ${item.model}` : ""}</p>}
                      </div>

                      {/* Ubicación completa */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Ubicación física completa</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <LocationBadge rack={item.rack} level={item.level} box={item.box} />
                          {item.rack && <span style={{ fontSize: 11, color: "#6B7280" }}>Pasillo {item.rack} · Estante {item.level} · Casillero {item.box}</span>}
                        </div>
                        {item.location_ref && (
                          <p style={{ fontSize: 12, color: "#374151", margin: 0, background: "#EFF6FF", padding: "6px 10px", borderRadius: 6, lineHeight: 1.4 }}>
                            📍 {item.location_ref}
                          </p>
                        )}
                        {!item.rack && !item.level && !item.box && (
                          <p style={{ fontSize: 12, color: "#F59E0B", margin: 0, fontStyle: "italic" }}>No se ha asignado una ubicación física todavía</p>
                        )}
                      </div>

                      {/* Condición y notas */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Condición y observaciones</div>
                        {item.condition_out && <p style={{ fontSize: 12, margin: "0 0 4px" }}>Condición al salir: <strong>{item.condition_out}</strong></p>}
                        {item.condition_in  && <p style={{ fontSize: 12, margin: "0 0 4px" }}>Condición al regresar: <ConditionChip cond={item.condition_in} /></p>}
                        {item.returned_at   && <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 4px" }}>Devuelto: {fmt(item.returned_at)}</p>}
                        {item.return_notes  && (
                          <div style={{ background: dmg ? "#FEF2F2" : "#F9FAFB", border: `1px solid ${dmg ? "#FECACA" : "#E5E7EB"}`, borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 3 }}>NOTAS DE DEVOLUCIÓN</div>
                            <p style={{ fontSize: 12, color: dmg ? "#DC2626" : "#374151", margin: 0, lineHeight: 1.4 }}>{item.return_notes}</p>
                          </div>
                        )}
                        {item.last_mv_notes && (
                          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 3 }}>NOTAS ÚLTIMO MOVIMIENTO</div>
                            <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.4 }}>{item.last_mv_notes}</p>
                          </div>
                        )}
                        {!item.condition_in && !item.condition_out && !item.return_notes && !item.last_mv_notes && (
                          <p style={{ fontSize: 12, color: "#D1D5DB", fontStyle: "italic", margin: 0 }}>Sin observaciones registradas</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ padding: "12px 20px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                💡 Haz clic en una fila para ver la descripción completa, ubicación y condición detallada
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                {filtered.length} de {items.length} ítems
                {summary.total_units != null && ` · ${summary.total_units.toLocaleString()} unidades totales`}
              </span>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
