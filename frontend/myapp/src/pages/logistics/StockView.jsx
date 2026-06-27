import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import ExportExcelButton from "../../components/ExportExcelButton";

// ── Barra de nivel de stock ────────────────────────────────────────────────────
function StockBar({ current, min }) {
  if (min == null || min === 0) return null;
  const pct = Math.min((current / (min * 2)) * 100, 100);
  const barColor = current <= 0 ? "#EF4444" : current <= min ? "#EAB308" : "#22C55E";
  return (
    <div style={{ width: 60, height: 5, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.3s" }} />
    </div>
  );
}

// ── Chip de estado ─────────────────────────────────────────────────────────────
function StockChip({ current, min }) {
  if (current <= 0)
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#FEE2E2", color: "#DC2626" }}>Sin stock</span>;
  if (min != null && current <= min)
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#FEF9C3", color: "#854D0E" }}>Stock bajo</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#DCFCE7", color: "#15803D" }}>OK</span>;
}

// ── Location badge ─────────────────────────────────────────────────────────────
function LocationBadge({ rack, level, box }) {
  if (!rack && !level && !box) return <span style={{ color: "#D1D5DB", fontSize: 11 }}>—</span>;
  const code = [rack, level, box].filter(Boolean).join("-");
  return (
    <span style={{
      fontFamily: "monospace", fontSize: 12, fontWeight: 800,
      padding: "3px 8px", borderRadius: 6,
      background: "#EFF6FF", color: "#1D4ED8",
      border: "1px solid #BFDBFE", letterSpacing: "0.5px",
    }}>
      {code}
    </span>
  );
}

// ── Modal para editar ubicación ────────────────────────────────────────────────
function LocationModal({ row, onClose, onSaved }) {
  const [rack, setRack]     = useState(row.rack     ?? "");
  const [level, setLevel]   = useState(row.level    ?? "");
  const [box, setBox]       = useState(row.box      ?? "");
  const [ref, setRef]       = useState(row.location_ref ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const previewCode = [rack, level, box].filter(Boolean).join("-") || "A-1-1";

  const save = async () => {
    if (!rack.trim()) return setErr("El código de pasillo (rack) es obligatorio");
    setSaving(true); setErr("");
    try {
      await apiFetch("/logistics/stock/location-meta", {
        method: "PUT",
        body: JSON.stringify({
          material_id:  row.material_id,
          warehouse_id: row.warehouse_id,
          rack:  rack.trim().toUpperCase(),
          level: level.trim(),
          box:   box.trim(),
          position: ref.trim(),
        }),
      });
      onSaved({ ...row, rack: rack.trim().toUpperCase(), level: level.trim(), box: box.trim(), location_ref: ref.trim() });
    } catch (e) {
      setErr(e.message || "Error al guardar ubicación");
    } finally {
      setSaving(false);
    }
  };

  const inp = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1.5px solid #D1D5DB", fontSize: 13,
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>Codificación de ubicación</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
              {row.material_name} · {row.warehouse_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#9CA3AF", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Preview del código */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📍</span>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 2 }}>CÓDIGO DE UBICACIÓN</div>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: "#1D4ED8" }}>{previewCode}</div>
          </div>
        </div>

        {/* Campos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>
              Pasillo / Rack *
            </label>
            <input value={rack} onChange={e => setRack(e.target.value.toUpperCase())}
              placeholder="Ej: A" style={inp} maxLength={10} autoFocus />
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>Letra o código del pasillo</span>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>
              Estante / Nivel
            </label>
            <input value={level} onChange={e => setLevel(e.target.value)}
              placeholder="Ej: 3" style={inp} maxLength={10} />
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>Número del estante</span>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>
              Casillero / Bin
            </label>
            <input value={box} onChange={e => setBox(e.target.value)}
              placeholder="Ej: 2" style={inp} maxLength={10} />
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>Posición en el estante</span>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>
            Referencia descriptiva
          </label>
          <textarea value={ref} onChange={e => setRef(e.target.value)} rows={2}
            placeholder="Ej: Estante metálico junto a la puerta norte, segundo nivel, bin derecho"
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>Descripción libre para orientar al almacenero</span>
        </div>

        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 12px", background: "#FEE2E2", padding: "8px 12px", borderRadius: 8 }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            {saving ? "Guardando..." : "Guardar ubicación"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TAB_COLORS = {
  ALL:  { active: { bg: "var(--primary)", color: "white" },   badge: { bg: "rgba(255,255,255,0.2)", color: "white" } },
  ZERO: { active: { bg: "#DC2626", color: "white" },   badge: { bg: "rgba(255,255,255,0.25)", color: "white" } },
  LOW:  { active: { bg: "#D97706", color: "white" },   badge: { bg: "rgba(255,255,255,0.25)", color: "white" } },
  OK:   { active: { bg: "#15803D", color: "white" },   badge: { bg: "rgba(255,255,255,0.25)", color: "white" } },
};

const COLS = "36px 1fr 120px 100px 56px 56px 100px 38px";

export default function StockView() {
  const navigate = useNavigate();
  const [rows, setRows]         = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  const [focused, setFocused]   = useState(false);
  const [editRow, setEditRow]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stockData, projData] = await Promise.allSettled([
        apiFetch("/logistics/stock/availability"),
        apiFetch("/logistics/projects"),
      ]);
      if (stockData.status === "fulfilled") setRows(Array.isArray(stockData.value) ? stockData.value : []);
      if (projData.status  === "fulfilled") setProjects(Array.isArray(projData.value) ? projData.value : []);
    } catch (e) {
      setError(e.message || "Error al cargar stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLocationSaved = (updatedRow) => {
    setRows(prev => prev.map(r =>
      r.material_id === updatedRow.material_id && r.warehouse_id === updatedRow.warehouse_id
        ? updatedRow : r
    ));
    setEditRow(null);
  };

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.material_name?.toLowerCase().includes(q) &&
          !r.material_code?.toLowerCase().includes(q) &&
          !r.warehouse_name?.toLowerCase().includes(q) &&
          !r.rack?.toLowerCase().includes(q)) return false;
    }
    if (filter === "ZERO") return r.stock_available <= 0;
    if (filter === "LOW")  return r.stock_available > 0 && r.min_stock != null && r.stock_available <= r.min_stock;
    if (filter === "OK")   return r.min_stock == null || r.stock_available > r.min_stock;
    return true;
  }).filter(r => !projectFilter || r.project_id === projectFilter);

  const counts = {
    ALL:  rows.length,
    ZERO: rows.filter((r) => r.stock_available <= 0).length,
    LOW:  rows.filter((r) => r.stock_available > 0 && r.min_stock != null && r.stock_available <= r.min_stock).length,
    OK:   rows.filter((r) => r.min_stock == null || r.stock_available > r.min_stock).length,
  };

  const tabs = [
    { key: "ALL",  label: "Todos",      icon: "▤" },
    { key: "ZERO", label: "Sin stock",  icon: "✕" },
    { key: "LOW",  label: "Stock bajo", icon: "⚠" },
    { key: "OK",   label: "Disponible", icon: "✓" },
  ];

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Encabezado ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", margin: 0, letterSpacing: "-0.02em" }}>
              Stock disponible
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Disponibilidad por material y almacén · Codificación de ubicación física
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ExportExcelButton url="/logistics/stock/export" filename="stock.xlsx" />
            <button
              onClick={load}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"}
              onMouseLeave={(e) => e.currentTarget.style.background = "white"}
            >
              <span style={{ fontSize: 15 }}>↻</span> Actualizar
            </button>
          </div>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total registros",  value: counts.ALL,  accent: "var(--primary)", bg: "var(--primary-soft)", valColor: "var(--primary)" },
            { label: "Disponibles OK",   value: counts.OK,   accent: "#15803D", bg: "#F0FDF4", valColor: "#15803D" },
            { label: "Stock bajo",       value: counts.LOW,  accent: "#D97706", bg: "#FFFBEB", valColor: "#B45309" },
            { label: "Sin stock",        value: counts.ZERO, accent: "#EF4444", bg: "#FEF2F2", valColor: "#DC2626" },
          ].map((k) => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: "14px 18px", borderLeft: `4px solid ${k.accent}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                {k.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, color: k.valColor, lineHeight: 1.2, margin: "4px 0 0" }}>
                {loading ? "—" : k.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Aviso codificación ────────────────────────────────────────────── */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8" }}>Codificación de ubicación física</span>
            <span style={{ fontSize: 12, color: "#3B82F6", marginLeft: 8 }}>
              El almacenero puede editar la ubicación de cada ítem haciendo clic en el ícono ✏ de cada fila.
              Formato: <strong>Pasillo-Estante-Casillero</strong> (ej: A-3-2)
            </span>
          </div>
        </div>

        {/* ── Filtro por proyecto ───────────────────────────────────────────── */}
        {projects.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Proyecto:</span>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "white", cursor: "pointer" }}>
              <option value="">Todos los proyectos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
            {projectFilter && (
              <button onClick={() => navigate(`/logistics/projects/${projectFilter}`)}
                style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", background: "var(--primary)", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Ver proyecto 360° →
              </button>
            )}
          </div>
        )}

        {/* ── Buscador + Filtros ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "white", border: `2px solid ${focused ? "var(--primary)" : "#E5E7EB"}`,
            borderRadius: 12, padding: "0 14px",
            boxShadow: focused ? "0 0 0 3px rgba(0,58,140,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
            transition: "all 0.15s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused ? "var(--primary)" : "#9CA3AF"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar por material, código, almacén o rack..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent", padding: "11px 0" }}
            />
            {search && (
              <button onClick={() => setSearch("")}
                style={{ background: "#E5E7EB", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 12, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {tabs.map((t) => {
              const isActive = filter === t.key;
              const colors = TAB_COLORS[t.key];
              return (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                    border: isActive ? "none" : "1px solid #E5E7EB",
                    background: isActive ? colors.active.bg : "white",
                    color: isActive ? colors.active.color : "#6B7280",
                    cursor: "pointer", transition: "all 0.15s",
                    boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#D1D5DB"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#E5E7EB"; } }}
                >
                  <span style={{ fontSize: 11 }}>{t.icon}</span>
                  {t.label}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                    background: isActive ? colors.badge.bg : "#F3F4F6",
                    color: isActive ? colors.badge.color : "#6B7280",
                  }}>
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tabla ─────────────────────────────────────────────────────────── */}
        {error ? (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "20px 24px", color: "#DC2626", fontSize: 13, textAlign: "center" }}>
            {error}
          </div>
        ) : loading ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 56, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Cargando stock...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 56, textAlign: "center" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 10 }}>📦</span>
            <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>
              {search ? "Sin resultados para esa búsqueda" : "No hay datos con ese filtro"}
            </p>
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: COLS, background: "var(--primary)", padding: "0 4px" }}>
              {["#", "Material", "Almacén", "Ubicación", "Mín.", "Nivel", "Disponible / Estado", ""].map((h, i) => (
                <div key={i} style={{
                  padding: "11px 10px",
                  fontSize: 10, fontWeight: 700, color: "rgba(199,210,229,0.7)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  textAlign: i === 0 || i === 7 ? "center" : i >= 4 ? "right" : "left",
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Filas */}
            <div>
              {filtered.map((r, i) => {
                const isZero = r.stock_available <= 0;
                const isLow  = !isZero && r.min_stock != null && r.stock_available <= r.min_stock;
                const hasLoc = r.rack || r.level || r.box;
                return (
                  <div key={`${r.material_id}-${r.warehouse_id}`}
                    style={{
                      display: "grid", gridTemplateColumns: COLS,
                      padding: "0 4px",
                      background: i % 2 === 0 ? "white" : "#FAFAFA",
                      borderBottom: "1px solid #F3F4F6",
                      alignItems: "center",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-soft)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}
                  >
                    {/* # */}
                    <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: "#D1D5DB", fontWeight: 600 }}>
                      {i + 1}
                    </div>

                    {/* Material */}
                    <div style={{ padding: "10px 10px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.3 }}>
                        {r.material_name}
                      </p>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: "#9CA3AF", background: "#F3F4F6", padding: "1px 5px", borderRadius: 4 }}>
                        {r.material_code || "—"}
                      </span>
                    </div>

                    {/* Almacén */}
                    <div style={{ padding: "10px 10px" }}>
                      <p style={{ fontSize: 12, color: "#374151", margin: 0, fontWeight: 500 }}>{r.warehouse_name}</p>
                      <p style={{ fontSize: 10, color: "#9CA3AF", margin: "2px 0 0" }}>{r.warehouse_code}</p>
                    </div>

                    {/* Ubicación */}
                    <div style={{ padding: "10px 10px" }}>
                      <LocationBadge rack={r.rack} level={r.level} box={r.box} />
                      {r.location_ref && (
                        <p style={{ fontSize: 10, color: "#6B7280", margin: "4px 0 0", lineHeight: 1.3 }}
                          title={r.location_ref}>
                          {r.location_ref.length > 38 ? r.location_ref.slice(0, 38) + "…" : r.location_ref}
                        </p>
                      )}
                      {!hasLoc && (
                        <p style={{ fontSize: 10, color: "#F59E0B", margin: "4px 0 0", fontStyle: "italic" }}>
                          Sin ubicación asignada
                        </p>
                      )}
                    </div>

                    {/* Mínimo */}
                    <div style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#9CA3AF" }}>
                      {r.min_stock ?? "—"}
                    </div>

                    {/* Barra de nivel */}
                    <div style={{ padding: "10px 10px", display: "flex", justifyContent: "flex-end" }}>
                      <StockBar current={r.stock_available} min={r.min_stock} />
                    </div>

                    {/* Disponible + Estado */}
                    <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{
                        fontFamily: "monospace", fontSize: 15, fontWeight: 700,
                        color: isZero ? "#DC2626" : isLow ? "#D97706" : "#111827",
                      }}>
                        {r.stock_available.toLocaleString()}
                      </span>
                      <StockChip current={r.stock_available} min={r.min_stock} />
                    </div>

                    {/* Botón editar ubicación */}
                    <div style={{ padding: "10px 4px", textAlign: "center" }}>
                      <button
                        onClick={() => setEditRow(r)}
                        title="Editar codificación de ubicación"
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "1px solid #E5E7EB",
                          background: hasLoc ? "#EFF6FF" : "#FFFBEB",
                          color: hasLoc ? "#1D4ED8" : "#D97706",
                          cursor: "pointer", fontSize: 13, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = hasLoc ? "#EFF6FF" : "#FFFBEB"; e.currentTarget.style.color = hasLoc ? "#1D4ED8" : "#D97706"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
                      >
                        ✏
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 20px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                💡 Haz clic en ✏ para asignar o editar la codificación física de un ítem
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                {filtered.length} de {rows.length} registros
              </span>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal de ubicación ─────────────────────────────────────────────── */}
      {editRow && (
        <LocationModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={handleLocationSaved}
        />
      )}

    </Layout>
  );
}
