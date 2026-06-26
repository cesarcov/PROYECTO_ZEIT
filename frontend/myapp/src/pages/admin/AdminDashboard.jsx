import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { useAuth, formatUsername } from "../../hooks/useAuth";

// ── Modal de confirmación de reset total ─────────────────────────────────────
function ResetModal({ onClose, onDone }) {
  const [step, setStep] = useState(1); // 1=warn 2=confirm 3=loading 4=done
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);

  const CONFIRM_WORD = "RESETEAR";

  const doReset = async () => {
    setStep(3);
    try {
      const data = await apiFetch("/admin/reset-all", { method: "POST" });
      setResult(data);
      setStep(4);
    } catch (e) {
      setResult({ error: e.message });
      setStep(4);
    }
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const card    = { background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 25px 60px rgba(0,0,0,0.35)" };

  return (
    <div style={overlay}>
      <div style={card}>
        {step === 1 && (
          <>
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#991B1B", textAlign: "center", marginBottom: 8 }}>Reset total del ERP</h2>
            <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.6, marginBottom: 20 }}>
              Esta acción borrará <strong>todos los datos operativos</strong>:
            </p>
            <ul style={{ fontSize: 13, color: "#6B7280", lineHeight: 2, paddingLeft: 20, marginBottom: 20 }}>
              <li>Proyectos y planes de materiales</li>
              <li>Almacenes, materiales y stock</li>
              <li>Solicitudes, reservas y despachos</li>
              <li>Movimientos de stock y herramientas</li>
              <li>Requerimientos y submissions</li>
              <li>Logs de auditoría y sesiones</li>
            </ul>
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: "#991B1B", margin: 0, fontWeight: 600 }}>
                Se conservan: usuarios, roles y permisos.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
              <button onClick={() => setStep(2)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#DC2626", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Continuar →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Confirmar reset</h2>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              Escribe <strong style={{ color: "#DC2626" }}>{CONFIRM_WORD}</strong> para confirmar que entiendes que esta acción es irreversible.
            </p>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value.toUpperCase())}
              placeholder={CONFIRM_WORD}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `2px solid ${typed === CONFIRM_WORD ? "#22C55E" : "#E5E7EB"}`, fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", textAlign: "center", boxSizing: "border-box", marginBottom: 16, outline: "none" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setStep(1); setTyped(""); }} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14 }}>← Atrás</button>
              <button
                onClick={doReset}
                disabled={typed !== CONFIRM_WORD}
                style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: typed === CONFIRM_WORD ? "#DC2626" : "#FCA5A5", color: "white", fontWeight: 700, cursor: typed === CONFIRM_WORD ? "pointer" : "not-allowed", fontSize: 14, transition: "background 0.2s" }}>
                Resetear todo el ERP
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ fontWeight: 700, color: "#374151", fontSize: 16 }}>Limpiando datos...</p>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 6 }}>Esto tardará unos segundos</p>
          </div>
        )}

        {step === 4 && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{result?.error ? "❌" : "✅"}</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: result?.error ? "#991B1B" : "#166534", marginBottom: 4 }}>
                {result?.error ? "Error al resetear" : "ERP reseteado"}
              </h2>
              <p style={{ fontSize: 13, color: "#6B7280" }}>
                {result?.error ? result.error : "Todos los datos operativos han sido eliminados. El ERP está listo para pruebas."}
              </p>
            </div>
            <button
              onClick={() => { onDone(); window.location.reload(); }}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "var(--primary)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Aceptar y recargar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#eab308", "#22c55e", "#ef4444", "#003A8C", "#00D4D8"];

const TABS = [
  { key: "overview", label: "Resumen general" },
  { key: "users",    label: "Usuarios del sistema" },
  { key: "requests", label: "Solicitudes" },
];

// ── KPI banner oscuro ─────────────────────────────────────────────────────────
function KpiBanner({ items, loading }) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      style={{ background: "var(--primary)", borderRadius: 14, padding: "16px 24px" }}
    >
      {items.map((kpi) => (
        <div key={kpi.label}>
          <p style={{ color: "#C7D2E5", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            {kpi.label}
          </p>
          {loading ? (
            <div className="h-7 bg-white/10 rounded w-16 animate-pulse mt-1" />
          ) : (
            <span style={{
              fontSize: 28,
              fontWeight: 800,
              color: kpi.alert || kpi.warn ? "#FCD34D" : kpi.danger ? "#F87171" : "white",
              lineHeight: 1,
              display: "block",
            }}>
              {kpi.value ?? "—"}
            </span>
          )}
          {kpi.sub && !loading && (
            <p style={{ color: "#C7D2E5", fontSize: 11, marginTop: 3, opacity: 0.7 }}>{kpi.sub}</p>
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
    <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4, overflowX: "auto" }}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        const isHovered = hovered === t.key && !isActive;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            onMouseEnter={() => setHovered(t.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: "7px 18px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              background: isActive ? "var(--primary)" : isHovered ? "#E5E7EB" : "transparent",
              color: isActive ? "white" : isHovered ? "#374151" : "#6B7280",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
              boxShadow: isActive ? "0 2px 6px rgba(0,31,84,0.35)" : "none",
              letterSpacing: isActive ? "0.01em" : "normal",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Tooltip custom ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Quick link card ───────────────────────────────────────────────────────────
function AdminQuickLink({ to, icon, label }) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      to={to}
      style={{
        display: "block", textDecoration: "none",
        background: hov ? "var(--primary-soft)" : "#F9FAFB",
        border: `1px solid ${hov ? "#C7D2E5" : "#E5E7EB"}`,
        borderRadius: 14, padding: 16,
        boxShadow: hov ? "0 4px 12px rgba(0,58,140,0.12)" : "none",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <span style={{ fontSize: 22, display: "block", marginBottom: 8 }}>{icon}</span>
      <p style={{ fontSize: 12, fontWeight: 700, color: hov ? "var(--primary)" : "#374151" }}>{label}</p>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { canExact } = useAuth();
  const canManage = canExact("admin:users");

  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState({ users: null, roles: null, materials: null, alerts: null, requests: null });
  const [users, setUsers] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    async function load() {
      const [usersRes, rolesRes, materialsRes, alertsRes, summaryRes, monthlyRes, reqRes] =
        await Promise.allSettled([
          apiFetch("/admin/users"),
          apiFetch("/admin/roles"),
          apiFetch("/logistics/materials"),
          apiFetch("/logistics/stock/alerts/low"),
          apiFetch("/reporting/requests/kpis/material-requests/summary"),
          apiFetch("/reporting/requests/kpis/material-requests/monthly"),
          apiFetch("/requests/material-requests"),
        ]);

      setStats({
        users:     usersRes.status     === "fulfilled" ? usersRes.value.length     : null,
        roles:     rolesRes.status     === "fulfilled" ? rolesRes.value.length     : null,
        materials: materialsRes.status === "fulfilled" ? materialsRes.value.length : null,
        alerts:    alertsRes.status    === "fulfilled" ? alertsRes.value.length    : null,
        requests:  summaryRes.status   === "fulfilled" ? summaryRes.value.total_requests : null,
      });

      if (usersRes.status     === "fulfilled") setUsers(usersRes.value);
      if (summaryRes.status   === "fulfilled") setSummary(summaryRes.value);
      if (reqRes.status       === "fulfilled") setAllRequests(reqRes.value);

      if (monthlyRes.status === "fulfilled") {
        setMonthlyData(
          monthlyRes.value.slice(-6).map((d) => ({
            mes: new Date(d.month + "-01").toLocaleDateString("es-PE", { month: "short", year: "2-digit" }),
            Solicitudes: d.total_requests    || 0,
            Aprobadas:   d.approved_requests || 0,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const pieData = summary
    ? [
        { name: "Pendientes", value: summary.pending_requests  || 0 },
        { name: "Aprobadas",  value: summary.approved_requests || 0 },
        { name: "Rechazadas", value: summary.rejected_requests || 0 },
      ].filter((d) => d.value > 0)
    : [];

  const bannerItems = [
    {
      label: "Total usuarios",
      value: stats.users,
      sub: `${stats.roles ?? "—"} roles configurados`,
    },
    {
      label: "Materiales activos",
      value: stats.materials,
      sub: "en catálogo",
    },
    {
      label: "Total solicitudes",
      value: stats.requests,
      sub: summary ? `${summary.pending_requests ?? 0} pendientes` : "",
    },
    {
      label: "Alertas stock",
      value: stats.alerts,
      alert: stats.alerts > 0,
      sub: stats.alerts > 0 ? "materiales bajo mínimo" : "todo en orden",
    },
  ];

  return (
    <Layout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-sm text-gray-400 mt-0.5">Visión general del sistema ERP</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to="/admin/reporting"
              style={{ padding: "6px 14px", fontSize: 13, background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, textDecoration: "none", cursor: "pointer", fontWeight: 500 }}
            >
              Ver reportes
            </Link>
            {canManage && (
              <Link
                to="/admin/users"
                style={{ padding: "6px 14px", fontSize: 13, background: "var(--primary)", color: "white", border: "none", borderRadius: 8, textDecoration: "none", cursor: "pointer", fontWeight: 600 }}
              >
                + Nuevo usuario
              </Link>
            )}
            {canManage && (
              <button
                onClick={() => setShowReset(true)}
                style={{ padding: "6px 14px", fontSize: 13, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
              >
                ⚠ Reset ERP
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <TabNav tabs={TABS} active={tab} onChange={setTab} />

        {/* KPI Banner */}
        <KpiBanner items={bannerItems} loading={loading} />

        {/* ── TAB: Resumen ── */}
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

              {/* Bar chart solicitudes por mes */}
              <div className="xl:col-span-2" style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>Solicitudes por Mes</p>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Últimos 6 meses</span>
                </div>
                {monthlyData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                    <span className="text-4xl mb-2">📊</span>
                    <p className="text-sm">Sin datos históricos aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={monthlyData} barGap={4} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        iconType="square"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      />
                      <Bar dataKey="Solicitudes" fill="#003A8C" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="Aprobadas"   fill="#00D4D8" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pie chart distribución */}
              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", marginBottom: 16 }}>Estado de Solicitudes</p>
                {pieData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                    <span className="text-4xl mb-2">🍩</span>
                    <p className="text-sm">Sin solicitudes aún</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-3">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: PIE_COLORS[i] }}
                            />
                            <span className="text-gray-600">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  backgroundColor: PIE_COLORS[i],
                                  width: `${summary?.total_requests ? (d.value / summary.total_requests) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="font-bold text-gray-800 w-5 text-right">{d.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Métricas secundarias */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Pendientes",  value: summary?.pending_requests,  borderColor: "#EAB308", textColor: "#92400E", bg: "#FFFBEB" },
                { label: "Aprobadas",   value: summary?.approved_requests, borderColor: "#22C55E", textColor: "#166534", bg: "#F0FDF4" },
                { label: "Rechazadas",  value: summary?.rejected_requests, borderColor: "#EF4444", textColor: "#991B1B", bg: "#FEF2F2" },
                {
                  label: "Vencidas SLA",
                  value: summary?.overdue_requests,
                  borderColor: (summary?.overdue_requests ?? 0) > 0 ? "#DC2626" : "#D1D5DB",
                  textColor:   (summary?.overdue_requests ?? 0) > 0 ? "#991B1B" : "#9CA3AF",
                  bg:          (summary?.overdue_requests ?? 0) > 0 ? "#FEF2F2" : "#F9FAFB",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ background: s.bg, borderRadius: 12, padding: "12px 16px", borderLeft: `4px solid ${s.borderColor}` }}
                >
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: s.textColor }}>
                    {loading ? "—" : (s.value ?? "—")}
                  </p>
                </div>
              ))}
            </div>

            {/* Acciones rápidas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Gestión de usuarios",     icon: "👤", to: "/admin/users"              },
                { label: "Roles y permisos",         icon: "🛡", to: "/admin/roles"              },
                { label: "Registro de auditoría",    icon: "📋", to: "/admin/audit"              },
                { label: "KPIs y reportes",          icon: "📈", to: "/admin/reporting"          },
                { label: "Categorías de costo",      icon: "🏷", to: "/admin/categorias-costo"   },
              ].map((a) => (
                <AdminQuickLink key={a.label} to={a.to} icon={a.icon} label={a.label} />
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: Usuarios ── */}
        {tab === "users" && (
          <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                Usuarios registrados
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>({users.length} total)</span>
              </p>
              <Link to="/admin/users" style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
                Administrar →
              </Link>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Cargando usuarios...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Usuario</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Roles</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--primary)" }}>
                            <span className="text-white text-xs font-bold uppercase">
                              {u.username.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium text-gray-800">{formatUsername(u.username)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1 flex-wrap">
                          {(u.roles || []).filter(Boolean).map((r) => (
                            <span key={r} className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          u.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {u.is_active ? "● Activo" : "○ Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB: Solicitudes ── */}
        {tab === "requests" && (
          <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                Todas las solicitudes
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>({allRequests.length} total)</span>
              </p>
              <Link to="/logistics/requests" style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
                Panel de gestión →
              </Link>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Cargando...</div>
            ) : allRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Sin solicitudes registradas.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Material</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Solicitante</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cantidad</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allRequests.slice(0, 20).map((r) => {
                    const STATUS_MAP = {
                      PENDING:  { label: "Pendiente",  cls: "bg-yellow-100 text-yellow-700" },
                      APPROVED: { label: "Aprobado",   cls: "bg-green-100  text-green-700"  },
                      REJECTED: { label: "Rechazado",  cls: "bg-red-100    text-red-700"    },
                      ORDERED:  { label: "Ordenado",   cls: "bg-blue-100   text-blue-700"   },
                    };
                    const s = STATUS_MAP[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800">{r.material_name || "—"}</td>
                        <td className="px-5 py-3 text-gray-500">{r.requested_by || "—"}</td>
                        <td className="px-5 py-3 text-right font-mono text-gray-700">{r.quantity}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${s.cls}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showReset && (
        <ResetModal
          onClose={() => setShowReset(false)}
          onDone={() => setShowReset(false)}
        />
      )}
    </Layout>
  );
}
