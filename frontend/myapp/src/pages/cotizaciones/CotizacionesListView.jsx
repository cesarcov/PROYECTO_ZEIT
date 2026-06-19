import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY = "#0B2E33";
const ACCENT  = "#4F7C82";
const LIGHT   = "#EEF7F8";

const STATUS_CONFIG = {
  BORRADOR:  { bg: "#F3F4F6", text: "#6B7280",  label: "Borrador",  dot: "#9CA3AF" },
  ENVIADA:   { bg: "#DBEAFE", text: "#1D4ED8",  label: "Enviada",   dot: "#3B82F6" },
  APROBADA:  { bg: "#D1FAE5", text: "#065F46",  label: "Aprobada",  dot: "#10B981" },
  RECHAZADA: { bg: "#FEE2E2", text: "#991B1B",  label: "Rechazada", dot: "#EF4444" },
  EXPIRADA:  { bg: "#FEF3C7", text: "#92400E",  label: "Expirada",  dot: "#F59E0B" },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.BORRADOR;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function KpiChip({ label, count, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : "#F9FAFB",
        color: active ? "#fff" : "#374151",
        border: `2px solid ${active ? color : "#E5E7EB"}`,
        borderRadius: 10, padding: "8px 16px",
        fontWeight: 700, fontSize: 13, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 800 }}>{count}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  );
}

export default function CotizacionesListView() {
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState(null);
  const [search, setSearch]             = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [planes, setPlanes]             = useState([]);
  const [planSeleccionado, setPlanSeleccionado] = useState("");

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function loadData() {
    setLoading(true);
    try {
      const [cotsData, statsData] = await Promise.all([
        apiFetch(`/cotizaciones${filterStatus ? `?status=${filterStatus}` : ""}`),
        apiFetch("/cotizaciones/stats"),
      ]);
      setCotizaciones(cotsData);
      setStats(statsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = cotizaciones.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.numero_cotizacion || "").toLowerCase().includes(q) ||
      (c.plan_code || "").toLowerCase().includes(q) ||
      (c.plan_title || "").toLowerCase().includes(q) ||
      (c.cliente_nombre || "").toLowerCase().includes(q) ||
      (c.cliente_razon_social || "").toLowerCase().includes(q)
    );
  });

  async function openModal() {
    try {
      const data = await apiFetch("/operations/plans");
      setPlanes(data);
      setPlanSeleccionado(data[0]?.id || "");
    } catch (e) {
      console.error(e);
    }
    setShowModal(true);
  }

  function irAPresupuesto() {
    if (!planSeleccionado) return;
    setShowModal(false);
    navigate(`/operations/plans/${planSeleccionado}/presupuesto`);
  }

  const colorMap = {
    BORRADOR: "#9CA3AF", ENVIADA: "#3B82F6",
    APROBADA: "#10B981", RECHAZADA: "#EF4444", EXPIRADA: "#F59E0B",
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Cotizaciones</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
            Seguimiento de todas las cotizaciones y su ciclo comercial
          </p>
        </div>
        <button
          onClick={openModal}
          style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + Nueva Cotización
        </button>
      </div>

      {/* KPI chips */}
      {stats && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <KpiChip label="Todas" count={stats.total} color={PRIMARY} active={filterStatus === null}
            onClick={() => setFilterStatus(null)} />
          {["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "EXPIRADA"].map(s => (
            <KpiChip key={s} label={STATUS_CONFIG[s].label} count={stats[s.toLowerCase()]}
              color={colorMap[s]} active={filterStatus === s}
              onClick={() => setFilterStatus(filterStatus === s ? null : s)} />
          ))}
          {stats.total > 0 && (
            <div style={{ marginLeft: "auto", background: "#F5F3FF", borderRadius: 10, padding: "8px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#5B21B6" }}>{stats.tasa_conversion}%</span>
              <span style={{ fontSize: 11, color: "#7C3AED" }}>Tasa aprobación</span>
            </div>
          )}
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Buscar por N° cotización, plan, cliente..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 360, border: "1px solid #D1D5DB", borderRadius: 8, padding: "9px 14px", fontSize: 13 }}
        />
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: LIGHT }}>
              {["N° Cotización", "Plan", "Cliente", "Estado", "Lugar", "Enviada", "Respuesta", ""].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: "#6B7280", fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 50, textAlign: "center", color: "#9CA3AF" }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 50, textAlign: "center", color: "#9CA3AF" }}>
                {search ? "Sin resultados para esa búsqueda" : "No hay cotizaciones" + (filterStatus ? ` en estado "${STATUS_CONFIG[filterStatus]?.label}"` : "")}
              </td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: PRIMARY }}>
                  {c.numero_cotizacion || <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>Sin número</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, color: "#374151" }}>{c.plan_code}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.plan_title}</div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {c.cliente_razon_social ? (
                    <div>
                      <div style={{ fontWeight: 600, color: "#374151" }}>{c.cliente_razon_social}</div>
                      {c.cliente_ruc_reg && <div style={{ fontSize: 11, color: "#9CA3AF" }}>RUC {c.cliente_ruc_reg}</div>}
                    </div>
                  ) : (
                    <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>Sin cliente</span>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: "12px 16px", color: "#6B7280" }}>{c.lugar_trabajo || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 12 }}>
                  {c.fecha_envio ? new Date(c.fecha_envio).toLocaleDateString("es-PE") : "—"}
                </td>
                <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 12 }}>
                  {c.fecha_respuesta ? new Date(c.fecha_respuesta).toLocaleDateString("es-PE") : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button
                    onClick={() => navigate(`/operations/plans/${c.plan_id}/presupuesto`)}
                    style={{ background: LIGHT, color: PRIMARY, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #E5E7EB", fontSize: 12, color: "#6B7280" }}>
          {filtered.length} cotización{filtered.length !== 1 ? "es" : ""}
          {filterStatus && ` · filtrado por "${STATUS_CONFIG[filterStatus]?.label}"`}
        </div>
      </div>
      {/* Modal nueva cotización */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: PRIMARY, margin: "0 0 6px" }}>Nueva Cotización</h2>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>
              Selecciona el plan de proyecto al que pertenecerá esta cotización.
            </p>

            {planes.length === 0 ? (
              <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "#92400E", marginBottom: 20 }}>
                No tienes planes de proyecto. Crea uno en <strong>Mis Proyectos</strong> primero.
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Plan de proyecto</label>
                <select
                  value={planSeleccionado}
                  onChange={e => setPlanSeleccionado(e.target.value)}
                  style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
                >
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.project_code} — {p.project_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
              {planes.length > 0 && (
                <button
                  onClick={irAPresupuesto}
                  disabled={!planSeleccionado}
                  style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: planSeleccionado ? 1 : 0.5 }}
                >
                  Ir al Presupuesto →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
