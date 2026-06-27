import { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../../components/Layout";
import ExportExcelButton from "../../components/ExportExcelButton";
import { apiFetch } from "../../services/api";
import { formatUsername } from "../../hooks/useAuth";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function relativeTime(dt) {
  if (!dt) return "";
  const diff = Date.now() - new Date(dt).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

// ── Method config ─────────────────────────────────────────────────────────────
const FRIENDLY_METHODS = {
  GET:    { label: "Consultar", tooltip: "Consultar información / ver registros (GET)", bg: "#E0F2FE", color: "#0369A1", border: "#bae6fd" },
  POST:   { label: "Registrar", tooltip: "Crear o registrar nueva información (POST)", bg: "#DCFCE7", color: "#15803D", border: "#bbf7d0" },
  PUT:    { label: "Modificar", tooltip: "Actualizar o reemplazar registros existentes (PUT)", bg: "#FEF9C3", color: "#854D0E", border: "#fde68a" },
  PATCH:  { label: "Modificar", tooltip: "Actualizar o modificar parcialmente registros (PATCH)", bg: "#FFEDD5", color: "#9A3412", border: "#fed7aa" },
  DELETE: { label: "Eliminar",  tooltip: "Eliminar registros del sistema (DELETE)", bg: "#FEE2E2", color: "#991B1B", border: "#fecaca" },
};

// ── Module config ─────────────────────────────────────────────────────────────
const MODULE_CFG = {
  admin:      { label: "Admin",      color: "#7C3AED", bg: "#F5F3FF" },
  logistics:  { label: "Logística",  color: "#0369A1", bg: "#F0F9FF" },
  requests:   { label: "Solicitudes",color: "#059669", bg: "#F0FDF4" },
  operations: { label: "Operaciones",color: "#D97706", bg: "#FFFBEB" },
  auth:       { label: "Auth",       color: "#6B7280", bg: "#F9FAFB" },
  reporting:  { label: "Reportes",   color: "#DB2777", bg: "#FDF2F8" },
};

function MethodBadge({ action }) {
  const method = (action || "").split(" ")[0].toUpperCase();
  const s = FRIENDLY_METHODS[method] || { label: method || "—", tooltip: "Acción general", bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" };
  return (
    <span title={s.tooltip} style={{
      fontSize: 10, fontFamily: "monospace", fontWeight: 800, padding: "3px 8px",
      borderRadius: 5, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.04em", cursor: "help", display: "inline-block"
    }}>
      {s.label}
    </span>
  );
}

function ModuleBadge({ module: mod }) {
  if (!mod) return <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>;
  const s = MODULE_CFG[mod.toLowerCase()] || { label: mod, color: "#4B5563", bg: "#F3F4F6" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 18px", borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label}</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1 }}>{value ?? "—"}</p>
          {sub && <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>{sub}</p>}
        </div>
        <span style={{ fontSize: 22, opacity: 0.7 }}>{icon}</span>
      </div>
    </div>
  );
}

const METHOD_FILTER_OPTIONS = [
  { value: "Todos", label: "Todos" },
  { value: "GET", label: "Consultar (GET)" },
  { value: "POST", label: "Registrar (POST)" },
  { value: "PUT_PATCH", label: "Modificar (PUT/PATCH)" },
  { value: "DELETE", label: "Eliminar (DELETE)" },
];

const PERIOD_OPTIONS = [
  { value: "Todos", label: "Todo el tiempo" },
  { value: "Hoy", label: "Hoy" },
  { value: "Ayer", label: "Ayer" },
  { value: "Semana", label: "Últimos 7 días" },
  { value: "Mes", label: "Este mes" },
  { value: "Anio", label: "Este año" },
  { value: "Rango", label: "Rango personalizado..." },
];

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminAudit() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [limit, setLimit]     = useState(100);
  const [method, setMethod]   = useState("Todos");
  const [module, setModule]   = useState("Todos");
  
  // Nuevos estados de filtrado
  const [filtroUsuario, setFiltroUsuario] = useState("Todos");
  const [periodo, setPeriodo]             = useState("Todos");
  const [fechaInicio, setFechaInicio]     = useState("");
  const [fechaFin, setFechaFin]           = useState("");

  // Filtros de columna
  const [colFilters, setColFilters] = useState({
    fecha: "", hora: "", usuario: "", accion: "", modulo: "", endpoint: "", ip: ""
  });

  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    usuario: "Todos", modulo: "Todos", method: "Todos", fechaInicio: "", fechaFin: ""
  });

  const apiDateRange = useMemo(() => {
    const now = new Date();
    if (periodo === "Hoy") {
      const d = now.toISOString().slice(0, 10);
      return { fecha_inicio: d, fecha_fin: d };
    }
    if (periodo === "Ayer") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const d = y.toISOString().slice(0, 10);
      return { fecha_inicio: d, fecha_fin: d };
    }
    if (periodo === "Semana") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return { fecha_inicio: start.toISOString().slice(0, 10), fecha_fin: now.toISOString().slice(0, 10) };
    }
    if (periodo === "Mes") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fecha_inicio: start.toISOString().slice(0, 10), fecha_fin: now.toISOString().slice(0, 10) };
    }
    if (periodo === "Anio") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { fecha_inicio: start.toISOString().slice(0, 10), fecha_fin: now.toISOString().slice(0, 10) };
    }
    if (periodo === "Rango") {
      return { fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null };
    }
    return { fecha_inicio: null, fecha_fin: null };
  }, [periodo, fechaInicio, fechaFin]);

  const buildQuery = useCallback((opts = {}) => {
    const p = new URLSearchParams();
    p.set("limit", String(opts.limit ?? limit));
    if (filtroUsuario !== "Todos") p.set("username", filtroUsuario);
    if (module !== "Todos") p.set("module", module);
    if (method !== "Todos") p.set("method", method);
    const fi = opts.fecha_inicio ?? apiDateRange.fecha_inicio;
    const ff = opts.fecha_fin ?? apiDateRange.fecha_fin;
    if (fi) p.set("fecha_inicio", fi);
    if (ff) p.set("fecha_fin", ff);
    return p.toString();
  }, [limit, filtroUsuario, module, method, apiDateRange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/audit-logs?${buildQuery()}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  // Unique modules for filter
  const modules = useMemo(() => {
    const uniq = [...new Set(logs.map(l => l.module).filter(Boolean))];
    return ["Todos", ...uniq.sort()];
  }, [logs]);

  // Unique users for filter
  const uniqueUsers = useMemo(() => {
    const uniq = [...new Set(logs.map(l => l.username).filter(Boolean))];
    return ["Todos", ...uniq.sort()];
  }, [logs]);

  // Filtered logs
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      // 1. Texto de búsqueda general
      const matchSearch = !q ||
        l.username?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.endpoint?.toLowerCase().includes(q) ||
        l.module?.toLowerCase().includes(q) ||
        l.ip?.includes(q);

      // 2. Filtro de Método (HTTP)
      let matchMethod = true;
      if (method === "GET") matchMethod = (l.action || "").startsWith("GET");
      else if (method === "POST") matchMethod = (l.action || "").startsWith("POST");
      else if (method === "PUT_PATCH") matchMethod = (l.action || "").startsWith("PUT") || (l.action || "").startsWith("PATCH");
      else if (method === "DELETE") matchMethod = (l.action || "").startsWith("DELETE");

      // 3. Filtro de Módulo
      const matchModule = module === "Todos" || l.module === module;

      // 4. Filtros por columna (refinamiento local)
      const matchColFecha = !colFilters.fecha || fmtDate(l.created_at).toLowerCase().includes(colFilters.fecha.toLowerCase());
      const matchColHora = !colFilters.hora || fmtTime(l.created_at).toLowerCase().includes(colFilters.hora.toLowerCase());
      const matchColUsuario = !colFilters.usuario || (l.username || "").toLowerCase().includes(colFilters.usuario.toLowerCase());
      const matchColAccion = !colFilters.accion || (FRIENDLY_METHODS[(l.action || "").split(" ")[0].toUpperCase()]?.label || l.action || "").toLowerCase().includes(colFilters.accion.toLowerCase());
      const matchColModulo = !colFilters.modulo || (l.module || "").toLowerCase().includes(colFilters.modulo.toLowerCase());
      const matchColEndpoint = !colFilters.endpoint || (l.endpoint || "").toLowerCase().includes(colFilters.endpoint.toLowerCase());
      const matchColIp = !colFilters.ip || (l.ip || "").toLowerCase().includes(colFilters.ip.toLowerCase());

      return matchSearch && matchMethod && matchModule &&
             matchColFecha && matchColHora && matchColUsuario && matchColAccion && matchColModulo && matchColEndpoint && matchColIp;
    });
  }, [logs, search, method, module, colFilters]);

  // KPIs
  const today = new Date().toDateString();
  const todayCount   = logs.filter(l => l.created_at && new Date(l.created_at).toDateString() === today).length;
  const activeUsers  = new Set(logs.map(l => l.username).filter(Boolean)).size;
  const moduleCounts = logs.reduce((acc, l) => { if (l.module) acc[l.module] = (acc[l.module] || 0) + 1; return acc; }, {});
  const topModule    = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  function buildExportParams(cfg) {
    const p = new URLSearchParams();
    if (cfg.usuario && cfg.usuario !== "Todos") p.set("username", cfg.usuario);
    if (cfg.modulo && cfg.modulo !== "Todos") p.set("module", cfg.modulo);
    if (cfg.method && cfg.method !== "Todos") p.set("method", cfg.method);
    if (cfg.fechaInicio) p.set("fecha_inicio", cfg.fechaInicio);
    if (cfg.fechaFin) p.set("fecha_fin", cfg.fechaFin);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  function handleOpenExport() {
    setExportFilters({
      usuario: filtroUsuario,
      modulo: module,
      method: method,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin
    });
    setShowExportModal(true);
  }

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>Registro de Auditoría</h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Toda la actividad del sistema en tiempo real</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleOpenExport} disabled={logs.length === 0}
              style={{ padding: "8px 16px", fontSize: 13, background: "white", border: "1px solid #E5E7EB", borderRadius: 8, color: "#374151", cursor: logs.length === 0 ? "not-allowed" : "pointer", fontWeight: 600, opacity: logs.length === 0 ? 0.5 : 1, transition: "all 0.15s" }}>
              ↓ Exportar en Excel
            </button>
            <button onClick={load} disabled={loading}
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: loading ? "#E5E7EB" : "var(--primary)", color: loading ? "#9CA3AF" : "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Cargando..." : "↻ Actualizar"}
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <StatCard label="Total registros"    value={logs.length}  sub={`mostrando ${limit}`}  icon="📋" accent="var(--primary)" />
          <StatCard label="Hoy"                value={todayCount}   sub="acciones del día"      icon="📅" accent="#059669" />
          <StatCard label="Usuarios activos"   value={activeUsers}  sub="en este período"       icon="👤" accent="#7C3AED" />
          <StatCard label="Módulo más activo"  value={topModule}    sub={moduleCounts[topModule] ? `${moduleCounts[topModule]} acciones` : ""} icon="⚡" accent="#D97706" />
        </div>

        {/* Filters */}
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 18px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por palabra clave..."
            style={{ flex: "1 1 200px", minWidth: 200, border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", transition: "border-color 0.15s" }}
            onFocus={e => e.target.style.borderColor = "var(--primary)"}
            onBlur={e => e.target.style.borderColor = "#E5E7EB"}
          />

          {/* Method chips */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {METHOD_FILTER_OPTIONS.map(m => {
              const active = method === m.value;
              const cfg    = m.value === "Todos" ? null : (FRIENDLY_METHODS[m.value] || FRIENDLY_METHODS.PUT);
              return (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  title={m.value === "Todos" ? "Ver todas las peticiones" : (FRIENDLY_METHODS[m.value]?.tooltip || "Modificar registros (PUT o PATCH)")}
                  style={{
                    padding: "6px 12px", fontSize: 12, fontWeight: active ? 700 : 500, borderRadius: 7,
                    border: active ? `1.5px solid ${cfg?.color || "var(--primary)"}` : "1.5px solid #E5E7EB",
                    background: active ? (cfg?.bg || "rgba(184,227,233,0.2)") : "white",
                    color: active ? (cfg?.color || "var(--primary)") : "#6B7280",
                    cursor: "pointer", transition: "all 0.12s"
                  }}
                >
                  {m.label.split(" ")[0]}
                </button>
              );
            })}
          </div>

          {/* User filter */}
          <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}
            style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none", background: "white" }}>
            <option value="Todos">Todos los usuarios</option>
            {uniqueUsers.filter(u => u !== "Todos").map(u => (
              <option key={u} value={u}>{formatUsername(u)}</option>
            ))}
          </select>

          {/* Module filter */}
          <select value={module} onChange={e => setModule(e.target.value)}
            style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none", background: "white" }}>
            {modules.map(m => <option key={m} value={m}>{m === "Todos" ? "Todos los módulos" : m}</option>)}
          </select>

          {/* Period filter */}
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none", background: "white" }}>
            {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          {/* Custom Date Inputs */}
          {periodo === "Rango" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12 }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>al</span>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12 }} />
            </div>
          )}

          {/* Limit */}
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none", background: "white" }}>
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={500}>Últimos 500</option>
          </select>

          {/* Count */}
          <span style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>
            {filtered.length} de {logs.length}
          </span>
        </div>

        {/* Table */}
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>

          {/* Table header with filters */}
          <div style={{ background: "var(--primary)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(90px,1fr) minmax(70px,0.8fr) minmax(110px,1.2fr) minmax(90px,1fr) minmax(100px,1fr) minmax(160px,2fr) minmax(90px,1fr)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                "Fecha", "Hora", "Usuario", "Acción", "Módulo",
                "Ruta del sistema",
                "IP",
              ].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(184,227,233,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "12px 14px 4px" }}>{h}</div>
              ))}
            </div>
            
            {/* Inline search fields */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(90px,1fr) minmax(70px,0.8fr) minmax(110px,1.2fr) minmax(90px,1fr) minmax(100px,1fr) minmax(160px,2fr) minmax(90px,1fr)", padding: "0 10px 10px 10px", gap: 6 }}>
              <input
                value={colFilters.fecha} onChange={e => setColFilters(prev => ({ ...prev, fecha: e.target.value }))}
                placeholder="Filtrar fecha..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
              <input
                value={colFilters.hora} onChange={e => setColFilters(prev => ({ ...prev, hora: e.target.value }))}
                placeholder="Filtrar hora..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
              <input
                value={colFilters.usuario} onChange={e => setColFilters(prev => ({ ...prev, usuario: e.target.value }))}
                placeholder="Filtrar usuario..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
              <input
                value={colFilters.accion} onChange={e => setColFilters(prev => ({ ...prev, accion: e.target.value }))}
                placeholder="Filtrar acción..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
              <input
                value={colFilters.modulo} onChange={e => setColFilters(prev => ({ ...prev, modulo: e.target.value }))}
                placeholder="Filtrar módulo..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
              <input
                value={colFilters.endpoint} onChange={e => setColFilters(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="Filtrar ruta..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
              <input
                value={colFilters.ip} onChange={e => setColFilters(prev => ({ ...prev, ip: e.target.value }))}
                placeholder="Filtrar IP..."
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "white", outline: "none" }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>⏳</span>
              Cargando registros de auditoría...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <span style={{ fontSize: 40, display: "block", marginBottom: 10 }}>🔍</span>
              <p style={{ color: "#374151", fontWeight: 700, margin: "0 0 4px" }}>Sin resultados</p>
              <p style={{ color: "#9CA3AF", fontSize: 13, margin: 0 }}>
                Prueba ajustando los filtros generales o de columna
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
              {filtered.map((log, i) => (
                <div key={i}
                  style={{ display: "grid", gridTemplateColumns: "minmax(90px,1fr) minmax(70px,0.8fr) minmax(110px,1.2fr) minmax(90px,1fr) minmax(100px,1fr) minmax(160px,2fr) minmax(90px,1fr)", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", alignItems: "center", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--primary-soft)"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}>

                  {/* Fecha */}
                  <div style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "#111827", fontWeight: 600 }}>{fmtDate(log.created_at)}</span>
                    <p style={{ fontSize: 9, color: "#9CA3AF", margin: "1px 0 0" }}>{relativeTime(log.created_at)}</p>
                  </div>

                  {/* Hora */}
                  <div style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6B7280" }}>{fmtTime(log.created_at)}</span>
                  </div>

                  {/* Usuario (Sin avatar) */}
                  <div style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: log.username ? "#374151" : "#9CA3AF", fontStyle: log.username ? "normal" : "italic" }}>
                      {log.username ? formatUsername(log.username) : "anónimo"}
                    </span>
                  </div>

                  {/* Acción */}
                  <div style={{ padding: "10px 14px" }}>
                    <MethodBadge action={log.action} />
                  </div>

                  {/* Módulo */}
                  <div style={{ padding: "10px 14px" }}>
                    <ModuleBadge module={log.module} />
                  </div>

                  {/* Endpoint */}
                  <div style={{ padding: "10px 14px" }}>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4B5563", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={`Ruta del sistema: ${log.endpoint}\nIndica qué pantalla o función del ERP se utilizó.`}>
                      {log.endpoint || "—"}
                    </p>
                  </div>

                  {/* IP */}
                  <div style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6B7280" }}>{log.ip || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "right", margin: 0 }}>
            Mostrando <strong style={{ color: "#374151" }}>{filtered.length}</strong> de <strong style={{ color: "#374151" }}>{logs.length}</strong> registros
            {(search || method !== "Todos" || module !== "Todos" || filtroUsuario !== "Todos" || periodo !== "Todos" || fechaInicio || fechaFin || Object.values(colFilters).some(Boolean)) && (
              <button onClick={() => {
                setSearch(""); setMethod("Todos"); setModule("Todos"); setFiltroUsuario("Todos"); setPeriodo("Todos"); setFechaInicio(""); setFechaFin("");
                setColFilters({ fecha: "", hora: "", usuario: "", accion: "", modulo: "", endpoint: "", ip: "" });
              }}
                style={{ marginLeft: 10, fontSize: 12, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>
                Limpiar todos los filtros
              </button>
            )}
          </p>
        )}

        {/* ── Modal de Exportación Excel ────────────────────────────────────── */}
        {showExportModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(11, 46, 51, 0.4)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
          }}>
            <div style={{
              background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 450,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>
                Exportar Auditoría a Excel
              </h3>
              <p style={{ margin: "0 0 20px 0", fontSize: 12, color: "#6B7280" }}>
                Selecciona los filtros específicos para tu descarga. Por defecto se aplican tus filtros activos.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Usuario */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Usuario</label>
                  <select
                    value={exportFilters.usuario}
                    onChange={e => setExportFilters(prev => ({ ...prev, usuario: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "white" }}
                  >
                    <option value="Todos">Todos los usuarios</option>
                    {uniqueUsers.filter(u => u !== "Todos").map(u => (
                      <option key={u} value={u}>{formatUsername(u)}</option>
                    ))}
                  </select>
                </div>

                {/* Módulo */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Módulo del Sistema</label>
                  <select
                    value={exportFilters.modulo}
                    onChange={e => setExportFilters(prev => ({ ...prev, modulo: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "white" }}
                  >
                    {modules.map(m => <option key={m} value={m}>{m === "Todos" ? "Todos los módulos" : m}</option>)}
                  </select>
                </div>

                {/* Método / Acción */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Tipo de Acción (Método)</label>
                  <select
                    value={exportFilters.method}
                    onChange={e => setExportFilters(prev => ({ ...prev, method: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "white" }}
                  >
                    {METHOD_FILTER_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>

                {/* Rango de fechas */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Rango de Fechas</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="date"
                      value={exportFilters.fechaInicio}
                      onChange={e => setExportFilters(prev => ({ ...prev, fechaInicio: e.target.value }))}
                      style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>a</span>
                    <input
                      type="date"
                      value={exportFilters.fechaFin}
                      onChange={e => setExportFilters(prev => ({ ...prev, fechaFin: e.target.value }))}
                      style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{ border: "1px solid #D1D5DB", background: "white", color: "#374151", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <div onClick={() => setShowExportModal(false)}>
                  <ExportExcelButton
                    url="/admin/audit-logs/export"
                    filename={`auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`}
                    label="Descargar Reporte Excel"
                    params={buildExportParams(exportFilters)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
