import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#EAB308", "#22C55E", "#EF4444", "#4F7C82"];

const TABS = [
  { key: "control",     label: "Centro de Control 360°" },
  { key: "performance", label: "Rendimiento y Alertas" },
];

// ── KPI Banner ────────────────────────────────────────────────────────────────
function KpiBanner({ items, loading }) {
  return (
    <div style={{ background: "#0B2E33", borderRadius: 14, padding: "16px 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
      {items.map((kpi) => (
        <div key={kpi.label}>
          <p style={{ color: "#93B1B5", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            {kpi.label}
          </p>
          {loading ? (
            <div style={{ height: 28, background: "rgba(255,255,255,0.1)", borderRadius: 6, width: 64, marginTop: 4 }} />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 800, color: kpi.warn ? "#FCD34D" : kpi.danger ? "#F87171" : "white", lineHeight: 1, display: "block" }}>
              {kpi.value ?? "—"}
            </span>
          )}
          {kpi.sub && !loading && (
            <p style={{ color: "#93B1B5", fontSize: 11, marginTop: 3, opacity: 0.7 }}>{kpi.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4 }}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        const isHov    = hovered === t.key && !isActive;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            onMouseEnter={() => setHovered(t.key)} onMouseLeave={() => setHovered(null)}
            style={{ padding: "7px 20px", borderRadius: 7, fontSize: 13, fontWeight: isActive ? 700 : 500, border: "none", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", background: isActive ? "#0B2E33" : isHov ? "#E5E7EB" : "transparent", color: isActive ? "white" : isHov ? "#374151" : "#6B7280", boxShadow: isActive ? "0 2px 6px rgba(11,46,51,0.35)" : "none" }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <p style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.fill, flexShrink: 0 }} />
          <span style={{ color: "#9CA3AF" }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: "#1F2937" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Modal: devolver herramienta ───────────────────────────────────────────────
function ToolReturnModal({ tool, onClose, onSuccess }) {
  const [condition, setCondition] = useState("BUENO");
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/logistics/tools/return", {
        method: "POST",
        body: JSON.stringify({ assignment_id: tool.id, condition_in: condition, return_notes: notes }),
      });
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al registrar la devolución");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Registrar devolución</h3>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
          <strong>{tool.material_name || "Herramienta"}</strong> devuelta por <strong>{tool.assigned_to}</strong>
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Estado al devolver</label>
        <select value={condition} onChange={e => setCondition(e.target.value)}
          style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14, boxSizing: "border-box", outline: "none" }}>
          <option value="NUEVO">Nuevo — sin uso aparente</option>
          <option value="BUENO">Bueno — buen estado general</option>
          <option value="REGULAR">Regular — uso visible</option>
          <option value="DAÑADO">Dañado — requiere revisión</option>
        </select>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Notas (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Ej: devuelto sin accesorios, necesita limpieza..."
          rows={2}
          style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 16, resize: "none", boxSizing: "border-box", outline: "none" }} />

        {error && (
          <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", padding: "8px 12px", borderRadius: 8 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: loading ? "#93B1B5" : "#4F7C82", color: "white", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13 }}>
            {loading ? "Procesando..." : "Confirmar devolución"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LogisticsDashboard() {
  const [tab, setTab]             = useState("control");
  const [loading, setLoading]     = useState(true);

  const [materialsList, setMaterialsList] = useState([]);
  const [warehouses, setWarehouses]       = useState([]);
  const [stockData, setStockData]         = useState([]);
  const [requests, setRequests]           = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [assignedTools, setAssignedTools] = useState([]);
  const [monthly, setMonthly]             = useState([]);

  // Block A — predictive material search
  const [matSearch, setMatSearch]     = useState("");
  const [matSearchId, setMatSearchId] = useState("");
  const [matDropdown, setMatDropdown] = useState(false);
  const [locations, setLocations]     = useState([]);
  const [loadingLoc, setLoadingLoc]   = useState(false);
  const searchRef = useRef(null);

  // Block B — tools
  const [toolSearch, setToolSearch] = useState("");
  const [returnModal, setReturnModal] = useState(null);

  // Block C — approve in-flight tracking
  const [approving, setApproving] = useState(new Set());

  useEffect(() => {
    async function load() {
      const [matRes, alertRes, reqRes, stockRes, whRes, monthRes, toolsRes] =
        await Promise.allSettled([
          apiFetch("/logistics/materials"),
          apiFetch("/logistics/stock/alerts/low"),
          apiFetch("/requests/material-requests"),
          apiFetch("/logistics/stock/availability"),
          apiFetch("/logistics/warehouses"),
          apiFetch("/reporting/requests/kpis/material-requests/monthly"),
          apiFetch("/logistics/tools/assigned"),
        ]);

      setMaterialsList(matRes.status   === "fulfilled" ? matRes.value   : []);
      setAlerts(alertRes.status        === "fulfilled" ? alertRes.value : []);
      setRequests(reqRes.status        === "fulfilled" ? reqRes.value   : []);
      setStockData(stockRes.status     === "fulfilled" ? stockRes.value : []);
      setWarehouses(whRes.status       === "fulfilled" ? whRes.value    : []);
      setAssignedTools(toolsRes.status === "fulfilled" ? toolsRes.value : []);

      if (monthRes.status === "fulfilled") {
        setMonthly(
          monthRes.value.slice(-6).map((d) => ({
            mes:         new Date(d.month + "-01").toLocaleDateString("es-PE", { month: "short", year: "2-digit" }),
            Solicitudes: d.total_requests    || 0,
            Aprobadas:   d.approved_requests || 0,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  // Fetch physical locations when material selected
  useEffect(() => {
    if (!matSearchId) { setLocations([]); return; }
    setLoadingLoc(true);
    apiFetch(`/logistics/stock-locations?material_id=${matSearchId}`)
      .then(data => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLocations([]))
      .finally(() => setLoadingLoc(false));
  }, [matSearchId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setMatDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pendingReqs  = requests.filter(r => r.status === "PENDING");
  const toolsInField = assignedTools.length;

  const bannerItems = [
    { label: "Materiales activos",      value: materialsList.length, sub: "en catálogo" },
    { label: "Almacenes",               value: warehouses.length,    sub: "operativos" },
    { label: "Pendientes por procesar", value: pendingReqs.length,   warn: pendingReqs.length > 0,  sub: pendingReqs.length > 0 ? "requieren acción" : "al día" },
    { label: "Activos en campo",        value: toolsInField,          warn: toolsInField > 0, sub: toolsInField > 0 ? "herramientas fuera" : "todo en almacén" },
  ];

  const filteredMaterials = matSearch.length > 1
    ? materialsList.filter(m =>
        m.name.toLowerCase().includes(matSearch.toLowerCase()) ||
        (m.code || "").toLowerCase().includes(matSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const filteredTools = assignedTools.filter(t =>
    !toolSearch || t.assigned_to.toLowerCase().includes(toolSearch.toLowerCase())
  );

  const reqPie = [
    { name: "Pendientes", value: requests.filter(r => r.status === "PENDING").length },
    { name: "Aprobadas",  value: requests.filter(r => r.status === "APPROVED").length },
    { name: "Rechazadas", value: requests.filter(r => r.status === "REJECTED").length },
  ].filter(d => d.value > 0);

  const approveRequest = async (requestId) => {
    setApproving(prev => new Set(prev).add(requestId));
    try {
      await apiFetch(`/requests/material-requests/${requestId}/approve`, { method: "POST" });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "APPROVED" } : r));
    } catch (e) {
      console.error("Error aprobando solicitud:", e);
    } finally {
      setApproving(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const tblH = { fontSize: 10, fontWeight: 700, color: "rgba(184,227,233,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px" };
  const tblC = { padding: "10px 14px", fontSize: 13 };
  const empty = (icon, msg) => (
    <div style={{ padding: "36px 20px", textAlign: "center" }}>
      <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>{icon}</span>
      <p style={{ color: "#9CA3AF", fontSize: 12, margin: 0 }}>{msg}</p>
    </div>
  );

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Panel de Logística
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Centro de operaciones · Trazabilidad · Accionabilidad en 1 clic
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/logistics/requests"
              style={{ padding: "7px 14px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              Ver solicitudes
            </Link>
            <Link to="/logistics/movements"
              style={{ padding: "7px 14px", background: "#4F7C82", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              + Movimiento
            </Link>
          </div>
        </div>

        <TabNav tabs={TABS} active={tab} onChange={setTab} />
        <KpiBanner items={bannerItems} loading={loading} />

        {/* ── TAB 1: Centro de Control 360° ────────────────────────────────── */}
        {tab === "control" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Row 1: Block A (ubicaciones) + Block B (herramientas) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* ▸ BLOCK A — Ubicación física exacta */}
              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", margin: 0 }}>📍 Ubicación Física Exacta</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Busca un material — ve coordenadas Rack · Nivel · Bin en cada almacén</p>
                </div>

                {/* Predictive search */}
                <div ref={searchRef} style={{ position: "relative" }}>
                  <input
                    value={matSearch}
                    onChange={e => { setMatSearch(e.target.value); setMatSearchId(""); setLocations([]); setMatDropdown(true); }}
                    onFocus={() => setMatDropdown(true)}
                    placeholder="Nombre o código del material..."
                    style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "white", boxSizing: "border-box" }}
                  />
                  {matDropdown && filteredMaterials.length > 0 && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden" }}>
                      {filteredMaterials.map(m => (
                        <div key={m.id}
                          onMouseDown={() => { setMatSearch(`${m.code} — ${m.name}`); setMatSearchId(m.id); setMatDropdown(false); }}
                          style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#F0F9FA"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{m.name}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#4F7C82", fontFamily: "monospace" }}>{m.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Results table */}
                <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", flex: 1, minHeight: 190, maxHeight: 260, overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.8fr 0.8fr", background: "#0B2E33", position: "sticky", top: 0 }}>
                    {["Almacén / Sede", "Rack · Nivel · Bin", "Cant."].map(h => <div key={h} style={tblH}>{h}</div>)}
                  </div>
                  {!matSearchId
                    ? empty("📦", "Escribe el nombre o código del material")
                    : loadingLoc
                    ? <div style={{ padding: 36, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>Buscando coordenadas...</div>
                    : locations.length === 0
                    ? empty("⚠️", "Sin existencias físicas registradas en ningún almacén")
                    : locations.map((loc, i) => {
                        const wh = warehouses.find(w => w.id === loc.warehouse_id) || {};
                        return (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.8fr 0.8fr", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}>
                            <div style={{ ...tblC, fontWeight: 600, color: "#111827", fontSize: 12 }}>
                              {wh.name || "—"}
                              <span style={{ display: "block", fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" }}>{wh.code || ""}</span>
                            </div>
                            <div style={{ ...tblC, fontFamily: "monospace", fontSize: 12, color: "#374151" }}>
                              {loc.rack || "—"} · {loc.level || "—"} · {loc.box || "—"}
                            </div>
                            <div style={{ ...tblC, fontWeight: 800, color: "#0B2E33" }}>{loc.quantity}</div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>

              {/* ▸ BLOCK B — Herramientas en campo */}
              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", margin: 0 }}>🔧 Herramientas en Campo</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Activos fuera de almacén · registra devolución en 1 clic</p>
                </div>

                <input
                  value={toolSearch}
                  onChange={e => setToolSearch(e.target.value)}
                  placeholder="Filtrar por responsable..."
                  style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "white", boxSizing: "border-box" }}
                />

                <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", flex: 1, minHeight: 190, maxHeight: 260, overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.1fr 1fr 88px", background: "#0B2E33", position: "sticky", top: 0 }}>
                    {["Equipo / Código", "Responsable", "Retorno", ""].map((h, i) => <div key={i} style={tblH}>{h}</div>)}
                  </div>
                  {filteredTools.length === 0
                    ? empty("✅", toolSearch ? "Sin coincidencias" : "Ninguna herramienta fuera del almacén")
                    : filteredTools.map((t, i) => {
                        const isLate = t.expected_return && new Date(t.expected_return) < new Date();
                        return (
                          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.1fr 1fr 88px", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}>
                            <div style={{ ...tblC, fontWeight: 600, color: "#111827", fontSize: 12 }}>
                              {t.material_name || "Herramienta"}
                              <span style={{ display: "block", fontSize: 10, color: "#9CA3AF", fontFamily: "monospace", marginTop: 1 }}>{t.material_code || ""}</span>
                            </div>
                            <div style={{ ...tblC, color: "#374151", fontSize: 12 }}>{t.assigned_to}</div>
                            <div style={{ ...tblC, fontSize: 12, color: isLate ? "#DC2626" : "#6B7280", fontWeight: isLate ? 700 : 400 }}>
                              {t.expected_return
                                ? new Date(t.expected_return).toLocaleDateString("es-PE")
                                : "Sin límite"}
                              {isLate && (
                                <span style={{ fontSize: 9, background: "#FEE2E2", color: "#991B1B", padding: "1px 5px", borderRadius: 4, marginLeft: 4 }}>
                                  Vencido
                                </span>
                              )}
                            </div>
                            <div style={{ ...tblC }}>
                              <button onClick={() => setReturnModal(t)}
                                style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "none", background: "#DCFCE7", color: "#166534", cursor: "pointer", whiteSpace: "nowrap", width: "100%" }}>
                                Devolver
                              </button>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            </div>

            {/* Row 2: Block C — solicitudes + acciones directas */}
            <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>
                    📋 Solicitudes Pendientes — Balance de Stock y Acciones Directas
                  </p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    Comparativa demanda vs disponibilidad · aprueba con stock disponible en 1 clic
                  </p>
                </div>
                <Link to="/logistics/requests"
                  style={{ fontSize: 11, color: "#4F7C82", textDecoration: "none", fontWeight: 600, flexShrink: 0 }}>
                  Panel completo →
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.6fr 0.6fr 0.6fr 1.1fr", background: "#0B2E33" }}>
                {["Material", "Solicitante", "Pedido", "En stock", "Déficit", "Acción"].map(h =>
                  <div key={h} style={tblH}>{h}</div>
                )}
              </div>

              {loading
                ? <div style={{ padding: 36, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
                : pendingReqs.length === 0
                ? empty("✅", "No hay solicitudes pendientes")
                : pendingReqs.map((r, i) => {
                    const available   = stockData
                      .filter(s => s.material_id === r.material_id)
                      .reduce((sum, s) => sum + (s.stock_available || 0), 0);
                    const deficit     = r.quantity - available;
                    const hasStock    = deficit <= 0;
                    const isApproving = approving.has(r.id);

                    return (
                      <div key={r.id}
                        style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.6fr 0.6fr 0.6fr 1.1fr", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F0F9FA"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}>

                        <div style={{ ...tblC, fontWeight: 600, color: "#111827" }}>
                          {r.material_name || "—"}
                          <span style={{ display: "block", fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{r.project_name || "Sin proyecto"}</span>
                        </div>
                        <div style={{ ...tblC, color: "#6B7280", fontSize: 12 }}>{r.requested_by || "—"}</div>
                        <div style={{ ...tblC, fontFamily: "monospace", fontWeight: 700, color: "#374151" }}>{r.quantity}</div>
                        <div style={{ ...tblC, fontFamily: "monospace", fontWeight: 700, color: available > 0 ? "#16A34A" : "#DC2626" }}>
                          {available}
                        </div>
                        <div style={{ ...tblC, fontFamily: "monospace", fontWeight: 700, color: deficit > 0 ? "#DC2626" : "#16A34A" }}>
                          {deficit > 0 ? `-${deficit}` : "OK"}
                        </div>
                        <div style={{ ...tblC }}>
                          {hasStock ? (
                            <button onClick={() => approveRequest(r.id)} disabled={isApproving}
                              style={{ fontSize: 11, fontWeight: 700, padding: "5px 13px", borderRadius: 7, border: "none", background: isApproving ? "#BBF7D0" : "#22C55E", color: "white", cursor: isApproving ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                              {isApproving ? "Aprobando..." : "✓ Aprobar"}
                            </button>
                          ) : (
                            <Link to="/logistics/requests"
                              style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, background: "#FEF9C3", color: "#854D0E", textDecoration: "none", display: "inline-block", whiteSpace: "nowrap" }}>
                              ⚠ Ver déficit
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
              }
            </div>

          </div>
        )}

        {/* ── TAB 2: Rendimiento y Alertas ─────────────────────────────────── */}
        {tab === "performance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(240px, 300px)", gap: 16 }}>

              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", margin: 0 }}>Solicitudes por Mes</p>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Últimos 6 meses</span>
                </div>
                {monthly.length === 0
                  ? <div style={{ padding: "48px 20px", textAlign: "center" }}><span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>📊</span><p style={{ color: "#9CA3AF", fontSize: 12, margin: 0 }}>Sin datos históricos aún</p></div>
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthly} barGap={4} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="Solicitudes" fill="#4F7C82" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="Aprobadas"   fill="#B8E3E9" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </div>

              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", marginBottom: 16 }}>Estado de Solicitudes</p>
                {reqPie.length === 0
                  ? <div style={{ padding: "48px 20px", textAlign: "center" }}><span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>🍩</span><p style={{ color: "#9CA3AF", fontSize: 12, margin: 0 }}>Sin solicitudes aún</p></div>
                  : (
                    <>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={reqPie} cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={3} dataKey="value">
                            {reqPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {reqPie.map((d, i) => (
                          <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i], flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#6B7280" }}>{d.name}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#1F2937" }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                }
              </div>
            </div>

            {/* Critical stock */}
            <div style={{ background: "white", border: `1px solid ${alerts.length > 0 ? "#FECACA" : "#E5E7EB"}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${alerts.length > 0 ? "#FECACA" : "#E5E7EB"}`, background: alerts.length > 0 ? "#FEF2F2" : "#F9FAFB", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{alerts.length > 0 ? "⚠" : "✅"}</span>
                <p style={{ fontSize: 13, fontWeight: 700, color: alerts.length > 0 ? "#DC2626" : "#374151", margin: 0 }}>
                  {alerts.length > 0
                    ? `${alerts.length} material${alerts.length !== 1 ? "es" : ""} con stock bajo o agotado`
                    : "Sin alertas de stock — todo en orden"}
                </p>
                {alerts.length > 0 && (
                  <Link to="/logistics/movements"
                    style={{ marginLeft: "auto", fontSize: 11, color: "#DC2626", textDecoration: "none", fontWeight: 600 }}>
                    Registrar entradas →
                  </Link>
                )}
              </div>

              {alerts.length > 0 && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1.8fr 100px 80px 110px 130px", background: "#0B2E33" }}>
                    {["Material", "Stock actual", "Mínimo", "Nivel", "Acción"].map(h => <div key={h} style={tblH}>{h}</div>)}
                  </div>
                  {alerts.map((item, i) => {
                    const current = item.current_stock ?? item.quantity ?? 0;
                    const min     = item.min_stock ?? item.minimum_stock ?? 0;
                    const pct     = min > 0 ? Math.min((current / (min * 2)) * 100, 100) : 50;
                    const isZero  = current <= 0;
                    return (
                      <div key={i}
                        style={{ display: "grid", gridTemplateColumns: "1.8fr 100px 80px 110px 130px", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#FFF7F7"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}>
                        <div style={{ ...tblC, fontWeight: 600, color: "#111827" }}>{item.material_name || item.name || "—"}</div>
                        <div style={{ ...tblC, fontFamily: "monospace", fontWeight: 700, textAlign: "right", color: isZero ? "#DC2626" : "#D97706" }}>{current}</div>
                        <div style={{ ...tblC, fontFamily: "monospace", textAlign: "right", color: "#9CA3AF" }}>{min || "—"}</div>
                        <div style={{ ...tblC, display: "flex", alignItems: "center" }}>
                          <div style={{ width: 72, height: 7, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: isZero ? "#EF4444" : "#EAB308", borderRadius: 99 }} />
                          </div>
                        </div>
                        <div style={tblC}>
                          <Link to="/logistics/movements"
                            style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 7, background: "#FEF9C3", color: "#854D0E", textDecoration: "none", display: "inline-block" }}>
                            + Reabastecer
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Quick links */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Solicitudes",       icon: "📋", to: "/logistics/requests"   },
                { label: "Stock y Almacenes", icon: "📦", to: "/logistics/stock"      },
                { label: "Movimientos",       icon: "↔",  to: "/logistics/movements"  },
                { label: "Almacenes",         icon: "🏭", to: "/logistics/warehouses" },
              ].map(a => {
                const [hov, setHov] = [false, () => {}];
                return (
                  <Link key={a.label} to={a.to}
                    style={{ textDecoration: "none", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#EEF6F7"; e.currentTarget.style.borderColor = "#93B1B5"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: 0 }}>{a.label}</p>
                  </Link>
                );
              })}
            </div>

          </div>
        )}

        {/* Modal: devolver herramienta */}
        {returnModal && (
          <ToolReturnModal
            tool={returnModal}
            onClose={() => setReturnModal(null)}
            onSuccess={() => {
              setAssignedTools(prev => prev.filter(t => t.id !== returnModal.id));
              setReturnModal(null);
            }}
          />
        )}

      </div>
    </Layout>
  );
}
