import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

export default function ClientesDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const data = await apiFetch("/planificacion/kpis");
      setKpis(data);
    } catch (e) {
      console.error("Error al cargar KPIs de clientes:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const getEtapaColor = (et) => {
    const stage = et.toUpperCase();
    if (stage.includes("COTIZACIÓN") || stage.includes("COTIZACION")) {
      return { bg: "#FEF9C3", text: "#CA8A04", border: "#FDE047" };
    }
    if (stage.includes("COORDINACIÓN") || stage.includes("COORDINACION")) {
      return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };
    }
    if (stage.includes("EJECUCIÓN") || stage.includes("EJECUCION")) {
      return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
    }
    if (stage.includes("LOGÍSTICA") || stage.includes("LOGISTICA")) {
      return { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" };
    }
    if (stage.includes("CIERRE") || stage.includes("FACTURACIÓN") || stage.includes("FACTURACION")) {
      return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
    }
    return { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB" };
  };

  // Compute summary stats
  const getSummaryStats = () => {
    if (!kpis?.pendientes_por_cliente || kpis.pendientes_por_cliente.length === 0) {
      return { totalClientes: 0, totalTareas: 0, etapaCritica: "Ninguna", promedioTareas: 0 };
    }
    
    const totalClientes = kpis.pendientes_por_cliente.length;
    let totalTareas = 0;
    const stageCounts = {};

    kpis.pendientes_por_cliente.forEach(item => {
      Object.entries(item.pendientes_por_etapa).forEach(([etapa, count]) => {
        totalTareas += count;
        stageCounts[etapa] = (stageCounts[etapa] || 0) + count;
      });
    });

    let etapaCritica = "Ninguna";
    let maxCount = 0;
    Object.entries(stageCounts).forEach(([etapa, count]) => {
      if (count > maxCount) {
        maxCount = count;
        etapaCritica = etapa;
      }
    });

    const promedioTareas = (totalTareas / totalClientes).toFixed(1);

    return { totalClientes, totalTareas, etapaCritica, promedioTareas };
  };

  const stats = getSummaryStats();

  return (
    <Layout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B2E33", margin: 0 }}>Dashboard de Clientes</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
            Visualización gráfica de tareas pendientes organizadas por etapas comerciales
          </p>
        </div>

        {/* Stats Row */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#9CA3AF" }}>Cargando resumen...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Clientes con Pendientes", value: stats.totalClientes, color: "#4F7C82", sub: "activos con tareas" },
              { label: "Tareas Pendientes Totales", value: stats.totalTareas, color: "#0B2E33", sub: "en todas las etapas" },
              { label: "Promedio Tareas/Cliente", value: stats.promedioTareas, color: "#7C3AED", sub: "intensidad de carga" },
              { 
                label: "Etapa Más Crítica", 
                value: stats.etapaCritica.length > 18 ? stats.etapaCritica.slice(0, 16) + "..." : stats.etapaCritica, 
                color: "#DC2626", 
                sub: "mayor volumen acumulado" 
              },
            ].map((stat, i) => (
              <div key={i} style={{
                background: "white", borderRadius: 14, padding: "20px 22px",
                border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}>
                <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{stat.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 6 }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main Section */}
        {loading ? (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 50, textAlign: "center", color: "#9CA3AF" }}>
            Cargando datos de clientes...
          </div>
        ) : !kpis?.pendientes_por_cliente || kpis.pendientes_por_cliente.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 50, textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💼</div>
            <p style={{ margin: 0, fontWeight: 700, color: "#374151" }}>Sin tareas pendientes por cliente</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>
              Actualmente no hay actividades pendientes o de seguimiento registradas para ningún cliente.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
              {kpis.pendientes_por_cliente.map((item, idx) => {
                const totalPendientes = Object.values(item.pendientes_por_etapa).reduce((a, b) => a + b, 0);
                const initials = item.cliente.slice(0, 2).toUpperCase();

                return (
                  <div 
                    key={idx} 
                    style={{
                      background: "white",
                      borderRadius: 16,
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      cursor: "default"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.06)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.02)";
                    }}
                  >
                    <div>
                      {/* Card Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {/* Client Avatar initials */}
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: "linear-gradient(135deg, #4F7C82, #0B2E33)",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 13,
                            boxShadow: "0 2px 6px rgba(11,46,51,0.15)"
                          }}>
                            {initials}
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0B2E33" }}>
                              {item.cliente}
                            </h3>
                            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>CLIENTE ACTIVO</span>
                          </div>
                        </div>
                        <span style={{
                          background: "#EEF7F8",
                          color: "#0B2E33",
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                          border: "1px solid #B8E3E9"
                        }}>
                          {totalPendientes} pendientes
                        </span>
                      </div>

                      {/* Segmented Progress Bar Graphic */}
                      <div style={{
                        display: "flex",
                        height: 10,
                        borderRadius: 99,
                        overflow: "hidden",
                        background: "#F3F4F6",
                        marginBottom: 18,
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)"
                      }}>
                        {Object.entries(item.pendientes_por_etapa).map(([etapa, count]) => {
                          const pct = totalPendientes > 0 ? (count / totalPendientes) * 100 : 0;
                          const colors = getEtapaColor(etapa);
                          return (
                            <div 
                              key={etapa} 
                              style={{ 
                                width: `${pct}%`, 
                                background: colors.text,
                                height: "100%",
                                transition: "width 0.4s ease" 
                              }} 
                              title={`${etapa}: ${count} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>

                      {/* Stage Breakdown List */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                        {Object.entries(item.pendientes_por_etapa).map(([etapa, count]) => {
                          const colors = getEtapaColor(etapa);
                          return (
                            <div 
                              key={etapa} 
                              style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "center",
                                fontSize: 12,
                                padding: "6px 10px",
                                borderRadius: 8,
                                background: "#FAFAFA",
                                border: "1px solid #F3F4F6"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: colors.text
                                }} />
                                <span style={{ fontWeight: 600, color: "#4B5563" }}>{etapa}</span>
                              </div>
                              <span style={{
                                background: colors.bg,
                                color: colors.text,
                                border: `1.5px solid ${colors.border}`,
                                borderRadius: 6,
                                padding: "1px 6px",
                                fontSize: 10,
                                fontWeight: 800
                              }}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => {
                        if (item.cliente_id) {
                          navigate(`/clientes?id=${item.cliente_id}`);
                        } else {
                          navigate(`/clientes`);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "9px 0",
                        background: "#4F7C82",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.15s"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#0B2E33";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "#4F7C82";
                      }}
                    >
                      Ver Ficha Comercial ➔
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
