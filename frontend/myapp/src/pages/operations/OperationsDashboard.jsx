import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const PIE_COLORS = ["#EAB308", "#22C55E", "#EF4444", "#4F7C82"];

const STATUS_CFG = {
  PENDING:  { label: "Pendiente",  bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308" },
  APPROVED: { label: "Aprobado",   bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
  REJECTED: { label: "Rechazado",  bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  ORDERED:  { label: "Ordenado",   bg: "#CCFBF1", color: "#0F766E", dot: "#14B8A6" },
};

const RESERVE_CFG = {
  BLOCKED:   { label: "Bloqueado",  bg: "#FEF9C3", color: "#854D0E" },
  CONFIRMED: { label: "Confirmado", bg: "#DCFCE7", color: "#166534" },
  RELEASED:  { label: "Liberado",   bg: "#F3F4F6", color: "#6B7280" },
  EXPIRED:   { label: "Vencido",    bg: "#FEE2E2", color: "#991B1B" },
};

const TABS = [
  { key: "overview",  label: "Mi Resumen" },
  { key: "requests",  label: "Mis Solicitudes" },
  { key: "reserves",  label: "Mis Reservas" },
];

function StatusBadge({ status, cfg }) {
  const s = cfg[status] || { label: status, bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>
      {s.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />}
      {s.label}
    </span>
  );
}

function TabNav({ tabs, active, onChange }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4, overflowX: "auto" }}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        const isHov = hovered === t.key && !isActive;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            onMouseEnter={() => setHovered(t.key)} onMouseLeave={() => setHovered(null)}
            style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13, fontWeight: isActive ? 700 : 500, border: "none", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", background: isActive ? "#0B2E33" : isHov ? "#E5E7EB" : "transparent", color: isActive ? "white" : isHov ? "#374151" : "#6B7280", boxShadow: isActive ? "0 2px 6px rgba(11,46,51,0.35)" : "none" }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <p style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.fill || p.stroke, flexShrink: 0 }} />
          <span style={{ color: "#9CA3AF" }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: "#1F2937" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

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

// ── Quick access cards ────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { to: "/operations/requisition", icon: "🛒", label: "Nueva Requisición", desc: "Pide materiales por proyecto o servicio", accent: "#4F7C82" },
  { to: "/requests/my",            icon: "📋", label: "Mis Solicitudes",   desc: "Ver y crear solicitudes de material",    accent: "#4F7C82" },
  { to: "/reservations/my",        icon: "🔒", label: "Mis Reservas",      desc: "Ver el stock reservado para ti",         accent: "#4F7C82" },
];

function QuickCard({ to, icon, label, desc, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <Link to={to} style={{ display: "block", textDecoration: "none" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ background: hov ? "#EEF6F7" : "#F9FAFB", border: `1.5px solid ${hov ? "#93B1B5" : "#E5E7EB"}`, borderRadius: 14, padding: "16px 18px", boxShadow: hov ? "0 4px 14px rgba(79,124,130,0.14)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: hov ? "#0B2E33" : "#EEF6F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, transition: "background 0.15s" }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: hov ? "#0B2E33" : "#374151", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>{desc}</p>
        </div>
      </div>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function OperationsDashboard() {
  const [tab, setTab]           = useState("overview");
  const [requests, setRequests] = useState([]);
  const [reserves, setReserves] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const [reqRes, resRes] = await Promise.allSettled([
        apiFetch("/requests/material-requests/my"),
        apiFetch("/requests/reservations/my"),
      ]);
      if (reqRes.status === "fulfilled") setRequests(reqRes.value);
      if (resRes.status === "fulfilled") setReserves(resRes.value);
      setLoading(false);
    }
    load();
  }, []);

  const pending  = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const rejected = requests.filter((r) => r.status === "REJECTED").length;

  const pieData = [
    { name: "Pendiente",  value: pending  },
    { name: "Aprobado",   value: approved },
    { name: "Rechazado",  value: rejected },
  ].filter((d) => d.value > 0);

  const byMaterial = Object.values(
    requests.reduce((acc, r) => {
      const key = r.material_name || "Sin nombre";
      if (!acc[key]) acc[key] = { name: key.length > 14 ? key.slice(0, 14) + "…" : key, Solicitudes: 0 };
      acc[key].Solicitudes += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.Solicitudes - a.Solicitudes).slice(0, 6);

  const activeReserves = reserves.filter((r) => r.status === "BLOCKED" || r.status === "CONFIRMED");

  const bannerItems = [
    { label: "Total solicitudes",  value: requests.length, sub: "enviadas" },
    { label: "Pendientes",         value: pending, warn: pending > 0, sub: "en espera de respuesta" },
    { label: "Aprobadas",          value: approved, sub: "listas para despacho" },
    { label: "Reservas activas",   value: activeReserves.length, sub: "stock reservado" },
  ];

  const tblHeader = { fontSize: 10, fontWeight: 700, color: "rgba(184,227,233,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "11px 14px" };
  const tblCell   = { padding: "11px 14px", fontSize: 13 };

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Panel de Operaciones
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Solicitudes de material y reservas activas
            </p>
          </div>
          <Link to="/operations/requisition"
            style={{ padding: "8px 18px", background: "#0B2E33", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            🛒 Nueva Requisición
          </Link>
        </div>

        {/* Quick Access */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {QUICK_LINKS.map((l) => <QuickCard key={l.to} {...l} />)}
        </div>

        {/* Tabs */}
        <TabNav tabs={TABS} active={tab} onChange={setTab} />

        {/* Banner */}
        <KpiBanner items={bannerItems} loading={loading} />

        {/* ── TAB: Resumen ── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(240px,340px)", gap: 16 }}>

              {/* Bar: por material */}
              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", margin: 0 }}>Solicitudes por Material</p>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Top {byMaterial.length}</span>
                </div>
                {byMaterial.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 176, color: "#D1D5DB" }}>
                    <span style={{ fontSize: 40, marginBottom: 8 }}>📊</span>
                    <p style={{ fontSize: 13 }}>Aún no hay solicitudes</p>
                    <Link to="/operations/requisition" style={{ fontSize: 11, marginTop: 8, color: "#4F7C82", textDecoration: "none" }}>
                      Nueva requisición →
                    </Link>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byMaterial} layout="vertical" barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="Solicitudes" fill="#4F7C82" radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pie: por estado */}
              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", marginBottom: 16 }}>Estado de Solicitudes</p>
                {pieData.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 192, color: "#D1D5DB" }}>
                    <span style={{ fontSize: 40, marginBottom: 8 }}>🍩</span>
                    <p style={{ fontSize: 13 }}>Sin solicitudes</p>
                    <Link to="/operations/requisition" style={{ fontSize: 11, marginTop: 8, color: "#4F7C82", textDecoration: "none" }}>
                      Crear requisición →
                    </Link>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={175}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {pieData.map((d, i) => (
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
                )}
              </div>
            </div>

            {/* Solicitudes recientes */}
            <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>Solicitudes recientes</p>
                <Link to="/requests/my" style={{ fontSize: 11, color: "#4F7C82", textDecoration: "none", fontWeight: 600 }}>Ver todas →</Link>
              </div>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
              ) : requests.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>📋</span>
                  <p style={{ color: "#6B7280", fontWeight: 600, margin: 0 }}>No tienes solicitudes aún.</p>
                  <Link to="/operations/requisition" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#4F7C82", textDecoration: "none" }}>
                    Crear primera requisición →
                  </Link>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 100px", background: "#0B2E33" }}>
                    {["Material", "Cantidad", "Estado", "Fecha"].map((h) => (
                      <div key={h} style={tblHeader}>{h}</div>
                    ))}
                  </div>
                  {requests.slice(0, 8).map((r, i) => (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 100px", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F0F9FA"}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}>
                      <div style={{ ...tblCell, fontWeight: 600, color: "#111827" }}>{r.material_name || "—"}</div>
                      <div style={{ ...tblCell, fontFamily: "monospace", color: "#374151" }}>{r.quantity}</div>
                      <div style={tblCell}><StatusBadge status={r.status} cfg={STATUS_CFG} /></div>
                      <div style={{ ...tblCell, fontSize: 11, color: "#9CA3AF" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—"}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Solicitudes ── */}
        {tab === "requests" && (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>
                Mis solicitudes
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>({requests.length} total)</span>
              </p>
              <Link to="/operations/requisition" style={{ fontSize: 11, color: "#4F7C82", textDecoration: "none", fontWeight: 600 }}>
                Nueva requisición →
              </Link>
            </div>
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
            ) : requests.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Sin solicitudes.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 110px 1fr 100px", background: "#0B2E33" }}>
                  {["Material", "Cant.", "Estado", "Motivo", "Fecha"].map((h) => (
                    <div key={h} style={tblHeader}>{h}</div>
                  ))}
                </div>
                {requests.map((r, i) => (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 110px 1fr 100px", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F0F9FA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}>
                    <div style={{ ...tblCell, fontWeight: 600, color: "#111827" }}>{r.material_name || "—"}</div>
                    <div style={{ ...tblCell, fontFamily: "monospace", color: "#374151" }}>{r.quantity}</div>
                    <div style={tblCell}><StatusBadge status={r.status} cfg={STATUS_CFG} /></div>
                    <div style={{ ...tblCell, fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.reason || "—"}</div>
                    <div style={{ ...tblCell, fontSize: 11, color: "#9CA3AF" }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—"}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Reservas ── */}
        {tab === "reserves" && (
          <>
            {loading ? (
              <div style={{ background: "#F9FAFB", borderRadius: 14, border: "1px solid #E5E7EB", padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                Cargando...
              </div>
            ) : reserves.length === 0 ? (
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 48, textAlign: "center" }}>
                <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>🔒</span>
                <p style={{ fontWeight: 700, color: "#374151", margin: 0 }}>Sin reservas activas</p>
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>
                  Las reservas aparecen cuando logística aprueba y bloquea stock
                </p>
                <Link to="/reservations/my" style={{ display: "inline-block", marginTop: 12, fontSize: 11, color: "#4F7C82", textDecoration: "none" }}>
                  Ver historial de reservas →
                </Link>
              </div>
            ) : (
              <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>
                    Mis reservas
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>({reserves.length} total)</span>
                  </p>
                  <Link to="/reservations/my" style={{ fontSize: 11, color: "#4F7C82", textDecoration: "none", fontWeight: 600 }}>Ver todas →</Link>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 120px", background: "#0B2E33" }}>
                  {["Material", "Almacén", "Cantidad", "Estado"].map((h) => (
                    <div key={h} style={tblHeader}>{h}</div>
                  ))}
                </div>
                {reserves.map((r, i) => (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 120px", background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F0F9FA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA"}>
                    <div style={{ ...tblCell, fontWeight: 600, color: "#111827" }}>{r.material_name || "—"}</div>
                    <div style={{ ...tblCell, color: "#6B7280" }}>{r.warehouse_name || "—"}</div>
                    <div style={{ ...tblCell, fontFamily: "monospace", fontWeight: 700, color: "#374151" }}>{r.quantity}</div>
                    <div style={tblCell}><StatusBadge status={r.status} cfg={RESERVE_CFG} /></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
