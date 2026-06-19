import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import ExportExcelButton from "../../components/ExportExcelButton";
import { apiFetch } from "../../services/api";
import { formatUsername } from "../../hooks/useAuth";

function fmtDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ACCENT = {
  teal:   { bar: "#4F7C82", text: "#0B2E33", bg: "#EEF6F7", border: "#B8E3E9" },
  yellow: { bar: "#D97706", text: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  green:  { bar: "#16A34A", text: "#166534", bg: "#F0FDF4", border: "#BBF7D0" },
  red:    { bar: "#DC2626", text: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
  gray:   { bar: "#9CA3AF", text: "#374151", bg: "#F9FAFB", border: "#E5E7EB" },
};

function StatCard({ title, value, sub, accent = "teal" }) {
  const a = ACCENT[accent];
  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: "16px 20px",
        border: `1px solid ${a.border}`,
        borderLeft: `5px solid ${a.bar}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 6 }}>
        {title}
      </p>
      <p style={{ fontSize: 28, fontWeight: 800, color: a.text, lineHeight: 1.1, margin: 0 }}>
        {value === null || value === undefined ? "—" : value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

function SlaGauge({ rate }) {
  const pct = Math.min(Math.max(rate || 0, 0), 100);
  const color = pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
  const r = 38, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg viewBox="0 0 100 100" style={{ width: 110, height: 110 }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F3F4F6" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="50" y="55" textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: "#111827" }}>
          {pct.toFixed(0)}%
        </text>
      </svg>
      <p style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, margin: 0 }}>Cumplimiento SLA</p>
    </div>
  );
}

function MetricRow({ label, value, color = "#374151", big = false }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 2, margin: 0 }}>{label}</p>
      <p style={{ fontSize: big ? 26 : 18, fontWeight: 800, color, margin: 0 }}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function MonthlyChart({ data }) {
  if (!data?.length) return (
    <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "32px 0" }}>
      Sin datos mensuales
    </p>
  );

  const max = Math.max(...data.map((d) => d.total_requests), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.slice(-6).map((d) => {
        const label = new Date(d.month + "-01").toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
        const pct = (d.total_requests / max) * 100;
        return (
          <div key={d.month} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#6B7280", width: 45, textAlign: "right", flexShrink: 0, fontWeight: 600 }}>{label}</span>
            <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 99, height: 22, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%", background: "#4F7C82", borderRadius: 99,
                  width: `${Math.max(pct, 2)}%`,
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  paddingRight: 8, transition: "width 0.4s ease",
                }}
              >
                <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>{d.total_requests}</span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#16A34A", width: 45, flexShrink: 0, fontWeight: 700 }}>
              {d.approved_requests} ✓
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportingKPIs() {
  const [data, setData] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("weakPoints");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState({
    logistics: true, operations: true, compras: true, admin: true, weakPoints: true,
  });

  function buildPeriodQuery() {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  function buildExportParams() {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (downloadOptions.logistics) p.set("logistics", "true");
    else p.set("logistics", "false");
    if (downloadOptions.operations) p.set("operations", "true");
    else p.set("operations", "false");
    if (downloadOptions.compras) p.set("compras", "true");
    else p.set("compras", "false");
    if (downloadOptions.admin) p.set("admin", "true");
    else p.set("admin", "false");
    if (downloadOptions.weakPoints) p.set("weak_points", "true");
    else p.set("weak_points", "false");
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  async function loadData() {
    setLoading(true);
    try {
      const periodQ = buildPeriodQuery();
      const [kpisRes, monthlyRes] = await Promise.allSettled([
        apiFetch(`/reporting/requests/kpis/dashboard-kpis${periodQ}`),
        apiFetch("/reporting/requests/kpis/material-requests/monthly"),
      ]);
      if (kpisRes.status === "fulfilled") setData(kpisRes.value);
      if (monthlyRes.status === "fulfilled") setMonthly(monthlyRes.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [desde, hasta]);

  if (loading) {
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Reportes y KPIs</h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Cargando métricas operativas por área...</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ background: "#F9FAFB", height: 90, borderRadius: 12, border: "1px solid #E5E7EB" }} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div style={{ padding: 40, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0B2E33" }}>Reportes y KPIs</h1>
          <p style={{ color: "#DC2626", fontSize: 14, marginTop: 12 }}>
            No se pudieron cargar los indicadores en este momento.
          </p>
          <button onClick={loadData} style={{ marginTop: 16, background: "#0B2E33", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Title & Download */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B2E33", margin: 0, letterSpacing: "-0.02em" }}>Reportes y KPIs de la Empresa</h1>
            <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Control operativo consolidado de Logística, Operaciones y Finanzas de Juliet</p>
          </div>
          <button onClick={() => setShowDownloadModal(true)}
            style={{
              background: "#0B2E33", color: "white", padding: "8px 16px",
              fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8,
              cursor: "pointer", transition: "background 0.15s"
            }}>
            📥 Descargar Reporte (Excel)
          </button>
        </div>

        {/* Filtro de período */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 16px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Período de análisis:</span>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 10px", fontSize: 12 }} />
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 10px", fontSize: 12 }} />
          {(desde || hasta) && (
            <button onClick={() => { setDesde(""); setHasta(""); }}
              style={{ background: "none", border: "none", color: "#4F7C82", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
              Limpiar período
            </button>
          )}
        </div>

        {/* Resumen General Superior (KPIs Cruzados) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <StatCard title="SLA Logística" value={`${(data?.logistics?.sla?.sla_compliance_rate ?? 0).toFixed(0)}%`} sub="Tasa de entrega a tiempo" accent={data?.logistics?.sla?.sla_compliance_rate < 80 ? "red" : "green"} />
          <StatCard title="OTs Retrasadas" value={data?.operations?.delayed_count} sub="Fuera de plazo" accent={data?.operations?.delayed_count > 0 ? "red" : "gray"} />
          <StatCard title="Stock Bajo Mínimo" value={data?.logistics?.materiales_bajo_stock} sub="Materiales críticos" accent={data?.logistics?.materiales_bajo_stock > 0 ? "yellow" : "gray"} />
          <StatCard title="Gasto Compras" value={`S/ ${(data?.compras?.gasto_recibido ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`} sub="OCs recibidas en período" accent="teal" />
          <StatCard title="Sobrecargados" value={data?.weak_points?.overloaded_users?.length} sub=">= 5 tareas abiertas" accent={data?.weak_points?.overloaded_users?.length > 0 ? "yellow" : "gray"} />
        </div>

        {/* Tab Selector */}
        <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #E5E7EB", paddingBottom: 1 }}>
          {[
            { id: "weakPoints", label: "⚠️ Diagnóstico de Puntos Débiles", color: "#DC2626" },
            { id: "logistics", label: "📦 KPIs Logística", color: "#4F7C82" },
            { id: "operations", label: "⚙️ KPIs Operaciones", color: "#4F7C82" },
            { id: "compras", label: "🛒 KPIs Compras", color: "#4F7C82" },
            { id: "admin", label: "💼 KPIs Administración", color: "#4F7C82" },
          ].map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: "none", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 700,
                  color: active ? t.color : "#9CA3AF", borderBottom: active ? `3px solid ${t.color}` : "3px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", outline: "none"
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
          
          {/* TAB 1: WEAK POINTS / DIAGNÓSTICO */}
          {activeTab === "weakPoints" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 800, color: "#111827" }}>Diagnóstico de Puntos Críticos</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Aquí se alertan los focos débiles donde la empresa está flaqueando y requiere intervención inmediata.</p>
              </div>

              {/* SLA Alert */}
              {data.weak_points.low_sla_alert && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>🚨</span>
                  <div>
                    <h4 style={{ margin: "0 0 2px 0", fontSize: 13, fontWeight: 700, color: "#991B1B" }}>Alerta Crítica: Tasa de Cumplimiento de SLA de Logística baja ({data.logistics.sla.sla_compliance_rate.toFixed(1)}%)</h4>
                    <p style={{ margin: 0, fontSize: 11, color: "#B91C1C" }}>La tasa óptima de entrega de solicitudes de materiales debe ser superior al 80%. Se deben optimizar los tiempos de aprobación y despacho.</p>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Overloaded Users */}
                <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "#374151" }}>👤 Personal Sobrecargado (Con 5 o más ítems)</h4>
                  {data.weak_points.overloaded_users.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0", margin: 0 }}>No hay colaboradores sobrecargados hoy. ¡Todo balanceado!</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.weak_points.overloaded_users.map(u => (
                        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid #F3F4F6" }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{formatUsername(u.username)}</span>
                            <p style={{ margin: "1px 0 0 0", fontSize: 10, color: "#9CA3AF" }}>
                              {u.active_plan} Planificación · {u.active_ots} OTs
                            </p>
                          </div>
                          <span style={{ background: "#FEE2E2", color: "#DC2626", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12 }}>
                            {u.total_active} Abiertas
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delayed Planning Tasks */}
                <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "#374151" }}>📅 Tareas Semanales Retrasadas</h4>
                  {data.weak_points.delayed_planning.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0", margin: 0 }}>Sin actividades semanales retrasadas en el plan.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.weak_points.delayed_planning.map(t => (
                        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "8px 12px", borderRadius: 8, border: "1px solid #F3F4F6" }}>
                          <div style={{ maxWidth: "70%" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.tarea}>
                              {t.tarea}
                            </span>
                            <span style={{ fontSize: 10, color: "#9CA3AF" }}>Cliente: {t.cliente || "—"}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ background: "#FEE2E2", color: "#DC2626", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>
                              Vencida
                            </span>
                            <p style={{ margin: "2px 0 0 0", fontSize: 9, color: "#6B7280", fontFamily: "monospace" }}>{fmtDate(t.fecha_limite)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Delayed OTs */}
              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 800, color: "#374151" }}>⚙️ Órdenes de Trabajo Retrasadas (Fase de Operación)</h4>
                {data.weak_points.delayed_ots.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "24px 0", margin: 0 }}>No hay Órdenes de Trabajo retrasadas actualmente.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {data.weak_points.delayed_ots.map(ot => (
                      <div key={ot.id} style={{ background: "white", padding: 12, borderRadius: 8, border: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: 12, color: "#0B2E33" }}>{ot.code}</strong>
                          <span style={{ fontSize: 12, color: "#374151", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: 220 }} title={ot.titulo}>
                            {ot.titulo}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ background: "#FEF2F2", color: "#EF4444", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                            {ot.status}
                          </span>
                          <span style={{ display: "block", fontSize: 9, color: "#9CA3AF", fontFamily: "monospace", marginTop: 2 }}>
                            Límite: {fmtDate(ot.fecha_fin_plan)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LOGÍSTICA */}
          {activeTab === "logistics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 800, color: "#111827" }}>Indicadores de Logística</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Rendimiento y eficiencia en el despacho e inventarios del ERP.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Gauge & Metrics */}
                <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB", display: "flex", gap: 32, alignItems: "center" }}>
                  <SlaGauge rate={data.logistics.sla?.sla_compliance_rate ?? 0} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <MetricRow label="Dentro de SLA" value={data.logistics.sla?.within_sla} color="#16A34A" big />
                    <MetricRow label="Fuera de SLA" value={data.logistics.sla?.overdue} color="#DC2626" />
                    <MetricRow label="Tiempo Prom. Decisión" value={data.logistics.sla?.avg_decision_time_hours != null ? `${Number(data.logistics.sla.avg_decision_time_hours).toFixed(1)} h` : "—"} color="#4F7C82" />
                  </div>
                </div>

                {/* Lead Times */}
                <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB" }}>
                  <h4 style={{ margin: "0 0 14px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>Tiempos de Respuesta de Materiales (Decisión)</h4>
                  {!data.logistics.lead_time || data.logistics.lead_time.avg_lead_time_hours === 0 ? (
                    <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Sin decisiones registradas.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Promedio", value: `${Number(data.logistics.lead_time.avg_lead_time_hours).toFixed(1)}h`, color: "#4F7C82" },
                        { label: "Percentil 95", value: `${Number(data.logistics.lead_time.p95_lead_time_hours).toFixed(1)}h`, color: "#D97706" },
                        { label: "Mínimo", value: `${Number(data.logistics.lead_time.min_lead_time_hours).toFixed(1)}h`, color: "#16A34A" },
                        { label: "Máximo", value: `${Number(data.logistics.lead_time.max_lead_time_hours).toFixed(1)}h`, color: "#DC2626" },
                      ].map(item => (
                        <div key={item.label} style={{ background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid #F3F4F6" }}>
                          <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>{item.label}</span>
                          <p style={{ fontSize: 20, fontWeight: 800, color: item.color, margin: "2px 0 0 0" }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#FEF2F2", borderRadius: 10, padding: 16, border: "1px solid #FCA5A5", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 700 }}>MATERIALES BAJO STOCK</span>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "#DC2626", margin: "4px 0 0 0" }}>{data.logistics.materiales_bajo_stock || 0}</p>
                </div>
                <div style={{ background: "#FFFBEB", borderRadius: 10, padding: 16, border: "1px solid #FDE68A", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "#D97706", fontWeight: 700 }}>DESPACHOS PENDIENTES</span>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "#92400E", margin: "4px 0 0 0" }}>{data.logistics.despachos_pendientes || 0}</p>
                </div>
              </div>

              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB" }}>
                <h4 style={{ margin: "0 0 14px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>Tendencia de Solicitudes por Mes</h4>
                <MonthlyChart data={monthly} />
              </div>
            </div>
          )}

          {/* TAB 3: OPERACIONES */}
          {activeTab === "operations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 800, color: "#111827" }}>Órdenes de Trabajo (Operaciones)</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Estado y avance de las tareas operativas de taller y campo (SAP PM style).</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16, border: "1px solid #E5E7EB", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>TOTAL OTs</span>
                    <p style={{ fontSize: 32, fontWeight: 800, color: "#0B2E33", margin: "4px 0 0 0" }}>{data.operations.total_ots || 0}</p>
                  </div>
                  <div style={{ background: "#FEF2F2", borderRadius: 10, padding: 16, border: "1px solid #FCA5A5", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 700 }}>RETRASADAS</span>
                    <p style={{ fontSize: 32, fontWeight: 800, color: "#DC2626", margin: "4px 0 0 0" }}>{data.operations.delayed_count || 0}</p>
                  </div>
                </div>

                {/* Status List */}
                <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>Órdenes por Estado</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.entries(data.operations.status_counts).map(([status, count]) => (
                      <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "white", padding: "6px 12px", borderRadius: 6, border: "1px solid #F3F4F6" }}>
                        <span style={{ fontWeight: 600, color: "#4B5563" }}>{status}</span>
                        <strong style={{ color: "#111827" }}>{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>Cotizaciones por Estado</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(data.operations.cotizaciones_status || {}).map(([status, count]) => (
                    <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "white", padding: "6px 12px", borderRadius: 6, border: "1px solid #F3F4F6" }}>
                      <span style={{ fontWeight: 600, color: "#4B5563" }}>{status}</span>
                      <strong style={{ color: "#111827" }}>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: COMPRAS */}
          {activeTab === "compras" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 800, color: "#111827" }}>Órdenes de Compra</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Estado de abastecimiento y gasto en el período seleccionado.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16, border: "1px solid #E5E7EB", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>TOTAL OCs</span>
                  <p style={{ fontSize: 32, fontWeight: 800, color: "#0B2E33", margin: "4px 0 0 0" }}>{data.compras?.total_ocs || 0}</p>
                </div>
                <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 16, border: "1px solid #86EFAC", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>GASTO RECIBIDO</span>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "#15803D", margin: "4px 0 0 0" }}>
                    S/ {(data.compras?.gasto_recibido ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>OCs por Estado</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(data.compras?.status_counts || {}).map(([status, count]) => (
                    <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "white", padding: "6px 12px", borderRadius: 6, border: "1px solid #F3F4F6" }}>
                      <span style={{ fontWeight: 600, color: "#4B5563" }}>{status}</span>
                      <strong style={{ color: "#111827" }}>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADMINISTRACIÓN */}
          {activeTab === "admin" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 800, color: "#111827" }}>Costos de Requerimientos de Servicios</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Estadísticas de cotización en hospedaje, alimentación, seguros, exámenes médicos, etc.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Active and spent cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16, border: "1px solid #E5E7EB" }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>SERVICIOS DE CLIENTE ACTIVOS</span>
                    <p style={{ fontSize: 28, fontWeight: 800, color: "#0B2E33", margin: "4px 0 0 0" }}>{data.admin.active_requirements_count || 0}</p>
                  </div>
                  <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 16, border: "1px solid #86EFAC" }}>
                    <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>COSTO TOTAL COTIZADO</span>
                    <p style={{ fontSize: 28, fontWeight: 800, color: "#15803D", margin: "4px 0 0 0" }}>
                      S/ {data.admin.total_requirements_cost.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Categories Breakdown */}
                <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>Costos por Categoría</h4>
                  {data.admin.costos_por_categoria.length === 0 ? (
                    <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", padding: "20px 0", margin: 0 }}>No hay costos registrados.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {data.admin.costos_por_categoria.map(c => (
                        <div key={c.categoria} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "white", padding: "8px 12px", borderRadius: 6, border: "1px solid #F3F4F6" }}>
                          <span style={{ fontWeight: 600, color: "#4B5563" }}>{c.categoria}</span>
                          <strong style={{ color: "#111827" }}>S/ {c.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>Productividad por Persona (período)</h4>
                {(data.admin.productividad_por_persona || []).length === 0 ? (
                  <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", padding: "16px 0", margin: 0 }}>Sin registros de productividad en el período.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.admin.productividad_por_persona.map(p => (
                      <div key={p.username} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "white", padding: "8px 12px", borderRadius: 6, border: "1px solid #F3F4F6" }}>
                        <span style={{ fontWeight: 600, color: "#374151" }}>{formatUsername(p.username)}</span>
                        <strong style={{ color: "#0B2E33" }}>{p.horas_totales} h · {p.registros} reg.</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal de Opciones de Descarga */}
        {showDownloadModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(11, 46, 51, 0.4)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
          }}>
            <div style={{
              background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 800, color: "#0B2E33" }}>
                Descargar Reporte de KPIs
              </h3>
              <p style={{ margin: "0 0 20px 0", fontSize: 12, color: "#6B7280" }}>
                Selecciona qué bloques de información deseas incluir en tu archivo Excel consolidado:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { id: "logistics", label: "Incluir KPIs de Logística" },
                  { id: "operations", label: "Incluir KPIs de Operaciones y Cotizaciones" },
                  { id: "compras", label: "Incluir KPIs de Compras" },
                  { id: "admin", label: "Incluir KPIs de Administración y Productividad" },
                  { id: "weakPoints", label: "Incluir Diagnóstico de Puntos Críticos" },
                ].map(opt => (
                  <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={downloadOptions[opt.id]}
                      onChange={e => setDownloadOptions(prev => ({ ...prev, [opt.id]: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  style={{ border: "1px solid #D1D5DB", background: "white", color: "#374151", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <div onClick={() => Object.values(downloadOptions).some(Boolean) && setShowDownloadModal(false)}>
                  <ExportExcelButton
                    url="/reporting/requests/kpis/dashboard-export"
                    filename={`reporte_kpis_${new Date().toISOString().slice(0, 10)}.xlsx`}
                    label="Generar Excel"
                    params={buildExportParams()}
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
