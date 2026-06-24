import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { formatUsername } from "../../hooks/useAuth";
import ExportExcelButton from "../../components/ExportExcelButton";

const PRIMARY = "#0B2E33";
const ACCENT  = "#4F7C82";
const LIGHT   = "#EEF7F8";

const AREAS = ["TI", "GERENCIA", "ADMINISTRACIÓN", "OPERACIONES", "LOGÍSTICA"];

function getUserArea(username, roles = []) {
  const lower = username.toLowerCase();
  if (lower === "admin" || roles.some(r => r.toLowerCase().includes("maestro"))) {
    return "TI";
  }
  if (lower === "frank_sonco" || roles.some(r => r.toLowerCase().includes("gerente"))) {
    return "GERENCIA";
  }
  if (
    lower === "juliet_alvis" ||
    lower === "yasmyn_machuca" ||
    roles.some(r => r.toLowerCase().includes("administra") || r.toLowerCase().includes("asistente") || r.toLowerCase().includes("auditor"))
  ) {
    return "ADMINISTRACIÓN";
  }
  if (
    lower === "wilfredo_flores" ||
    lower === "felipe_choque" ||
    lower === "lagartija_segura" ||
    lower === "cesar_huamani" ||
    roles.some(r => r.toLowerCase().includes("operacion") || r.toLowerCase().includes("operación") || r.toLowerCase().includes("campo") || r.toLowerCase().includes("supervisor") || r.toLowerCase().includes("ingeniero"))
  ) {
    return "OPERACIONES";
  }
  if (
    lower === "tiburoncito_junior" ||
    roles.some(r => r.toLowerCase().includes("logístic") || r.toLowerCase().includes("logistic"))
  ) {
    return "LOGÍSTICA";
  }
  return "OPERACIONES"; // Default fallback
}

export default function RecursosHumanos() {
  const [activeTab, setActiveTab] = useState("carga"); // carga | personal | reportes
  const [kpis, setKpis] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Report Export states
  const [filtroUser, setFiltroUser] = useState("");
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [kpiData, usersData] = await Promise.all([
        apiFetch("/planificacion/kpis"),
        apiFetch("/admin/users")
      ]);
      setKpis(kpiData);
      setUsers(usersData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const analyzeProductivity = () => {
    if (!kpis) return null;
    const total = kpis.tareas_total || 0;
    const completadas = kpis.tareas_completadas || 0;
    const retrasadas = kpis.tareas_retrasadas || 0;
    
    let sobrecargadosCount = 0;
    let totalActivas = 0;
    
    if (kpis.tareas_por_usuario) {
      kpis.tareas_por_usuario.forEach(u => {
        const activeCount = (u["En Progreso"] || 0) + (u["En espera"] || 0) + (u["Retraso"] || 0);
        totalActivas += activeCount;
        if (activeCount > 5) {
          sobrecargadosCount++;
        }
      });
    }

    let healthScore = "Excelente";
    let healthColor = "#22C55E";
    let healthDesc = "La carga de trabajo está distribuida eficientemente y no hay sobrecargas críticas.";
    
    const pctRetrasadas = total > 0 ? (retrasadas / total) * 100 : 0;
    
    if (sobrecargadosCount > 0 || pctRetrasadas > 15) {
      healthScore = "Atención requerida";
      healthColor = "#F97316";
      healthDesc = `Se detectan ${sobrecargadosCount} colaborador(es) con sobrecarga o alta tasa de retrasos.`;
    }
    if (pctRetrasadas > 30 || (total > 0 && (completadas / total) < 0.3)) {
      healthScore = "Crítico";
      healthColor = "#EF4444";
      healthDesc = "Alto volumen de tareas retrasadas. Se recomienda reasignar actividades urgentes.";
    }

    return {
      sobrecargadosCount,
      totalActivas,
      healthScore,
      healthColor,
      healthDesc,
      retrasadas
    };
  };

  const diag = analyzeProductivity();

  // Mapear tareas acumuladas del colaborador por usuario
  const getUserTasksStats = (username) => {
    if (!kpis?.tareas_por_usuario) return { completadas: 0, activas: 0, retraso: 0, total: 0 };
    const stats = kpis.tareas_por_usuario.find(u => u.username?.toLowerCase() === username?.toLowerCase());
    if (!stats) return { completadas: 0, activas: 0, retraso: 0, total: 0 };
    
    const completadas = stats["Completado"] || 0;
    const activas = (stats["En Progreso"] || 0) + (stats["En espera"] || 0) + (stats["Retraso"] || 0);
    const retraso = stats["Retraso"] || 0;
    
    return {
      completadas,
      activas,
      retraso,
      total: completadas + activas
    };
  };

  return (
    <Layout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Recursos Humanos</h1>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
              Gestión organizativa del personal, carga de trabajo, diagnósticos de rendimiento y reportes de productividad
            </p>
          </div>
          <button 
            onClick={loadData} 
            style={{ 
              background: LIGHT, 
              color: PRIMARY, 
              border: `1px solid ${ACCENT}30`, 
              borderRadius: 8, 
              padding: "8px 16px", 
              fontWeight: 700, 
              fontSize: 13, 
              cursor: "pointer" 
            }}
          >
            🔄 Actualizar Datos
          </button>
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E5E7EB", paddingBottom: 1, marginBottom: 20 }}>
          {[
            { key: "carga", label: "📊 Carga y Diagnóstico" },
            { key: "personal", label: "👥 Directorio del Personal" },
            { key: "reportes", label: "📥 Exportar Reportes" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 700,
                color: activeTab === tab.key ? PRIMARY : "#9CA3AF",
                borderBottom: activeTab === tab.key ? `3px solid ${ACCENT}` : "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                outline: "none"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "12px 16px", fontSize: 13, marginBottom: 20 }}>
            ⚠️ Error: {error}
          </div>
        )}

        {loading ? (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 60, textAlign: "center", color: "#9CA3AF" }}>
            Cargando información organizativa...
          </div>
        ) : (
          <div>
            {/* TAB: Carga y Diagnóstico */}
            {activeTab === "carga" && (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                
                {/* Panel izquierdo — Carga de Trabajo agrupada por Áreas */}
                <div style={{ flex: 1, minWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
                  {AREAS.map(areaName => {
                    const areaUsers = users.filter(u => getUserArea(u.username, u.roles) === areaName && u.is_active);
                    if (areaUsers.length === 0) return null;

                    return (
                      <div 
                        key={areaName}
                        style={{
                          background: "white",
                          borderRadius: 14,
                          border: "1px solid #E5E7EB",
                          padding: 20,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #F3F4F6", paddingBottom: 10, marginBottom: 14 }}>
                          <h3 style={{ fontSize: 12, fontWeight: 800, color: ACCENT, letterSpacing: "0.05em", margin: 0 }}>
                            💼 ÁREA {areaName}
                          </h3>
                          <span style={{ fontSize: 11, background: LIGHT, color: PRIMARY, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                            {areaUsers.length} colaborador{areaUsers.length !== 1 ? "es" : ""}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {areaUsers.map(u => {
                            const uStats = kpis?.tareas_por_usuario?.find(x => x.username?.toLowerCase() === u.username?.toLowerCase()) || {};
                            const totalT = Object.values(uStats).filter(v => typeof v === "number").reduce((a, b) => a + b, 0);
                            const act = (uStats["En Progreso"] || 0) + (uStats["En espera"] || 0) + (uStats["Retraso"] || 0);
                            
                            // HSL color states
                            const cComp = "#22C55E"; // completado (green)
                            const cProg = "#3B82F6"; // en progreso (blue)
                            const cWait = "#EAB308"; // en espera (yellow)
                            const cRetr = "#EF4444"; // retraso (red)

                            return (
                              <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 750, color: "#374151" }}>{formatUsername(u.username)}</span>
                                    <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 6 }}>
                                      {u.roles && u.roles.length > 0 ? u.roles.join(", ") : "Miembro"}
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {act > 5 && (
                                      <span style={{ background: "#FEE2E2", color: "#EF4444", fontSize: 10, padding: "2px 6px", borderRadius: 6, fontWeight: 800 }}>
                                        ⚠️ Sat.
                                      </span>
                                    )}
                                    <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{act} activas</span>
                                  </div>
                                </div>

                                {/* Stacked Progress Bar */}
                                <div style={{ height: 8, borderRadius: 4, background: "#F3F4F6", display: "flex", overflow: "hidden", marginTop: 2 }}>
                                  {totalT > 0 ? (
                                    <>
                                      {uStats["Completado"] > 0 && <div style={{ width: `${(uStats["Completado"]/totalT)*100}%`, background: cComp }} title={`Completado: ${uStats["Completado"]}`} />}
                                      {uStats["En Progreso"] > 0 && <div style={{ width: `${(uStats["En Progreso"]/totalT)*100}%`, background: cProg }} title={`En Progreso: ${uStats["En Progreso"]}`} />}
                                      {uStats["En espera"] > 0 && <div style={{ width: `${(uStats["En espera"]/totalT)*100}%`, background: cWait }} title={`En espera: ${uStats["En espera"]}`} />}
                                      {uStats["Retraso"] > 0 && <div style={{ width: `${(uStats["Retraso"]/totalT)*100}%`, background: cRetr }} title={`Retraso: ${uStats["Retraso"]}`} />}
                                    </>
                                  ) : (
                                    <div style={{ width: "100%", background: "#E5E7EB" }} title="Sin tareas asignadas" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Panel derecho — Diagnóstico y KPI Resumen */}
                <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                  
                  {/* Diagnóstico de Carga */}
                  {diag && (
                    <div style={{
                      background: "white",
                      borderRadius: 14,
                      padding: "20px 24px",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                    }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: "0 0 16px" }}>
                        Diagnóstico y Alertas de Carga
                      </h3>
                      
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: `${diag.healthColor}10`,
                        border: `1.5px solid ${diag.healthColor}25`,
                        borderRadius: 10,
                        padding: "12px 16px",
                        marginBottom: 20
                      }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: diag.healthColor,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          fontWeight: 800,
                          flexShrink: 0
                        }}>
                          {diag.healthScore === "Excelente" ? "✓" : "!"}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: PRIMARY }}>
                            Salud Carga: <span style={{ color: diag.healthColor }}>{diag.healthScore}</span>
                          </div>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4B5563", lineHeight: 1.4 }}>
                            {diag.healthDesc}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                          <span>Colaboradores sobrecargados</span>
                          <span style={{
                            fontWeight: 750,
                            color: diag.sobrecargadosCount > 0 ? "#EF4444" : "#22C55E",
                            background: diag.sobrecargadosCount > 0 ? "#FEE2E2" : "#DCFCE7",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11
                          }}>
                            {diag.sobrecargadosCount}
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                          <span>Tareas activas en curso</span>
                          <span style={{ fontWeight: 750, color: PRIMARY }}>
                            {diag.totalActivas}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                          <span>Tareas totales del equipo</span>
                          <span style={{ fontWeight: 750, color: PRIMARY }}>
                            {kpis.tareas_total || 0}
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                          <span>Tareas retrasadas críticas</span>
                          <span style={{
                            fontWeight: 750,
                            color: diag.retrasadas > 0 ? "#EF4444" : "#4B5563"
                          }}>
                            {diag.retrasadas}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Leyenda de estados */}
                  <div style={{
                    background: "white",
                    borderRadius: 14,
                    padding: 16,
                    border: "1px solid #E5E7EB",
                    fontSize: 12,
                    color: "#4B5563"
                  }}>
                    <h4 style={{ margin: "0 0 10px", fontWeight: 700, color: PRIMARY }}>Estados de Tarea</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} /> Completado</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} /> En Progreso</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EAB308" }} /> En espera</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} /> Con Retraso</div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB: Directorio del Personal */}
            {activeTab === "personal" && (
              <div>
                {AREAS.map(areaName => {
                  const areaUsers = users.filter(u => getUserArea(u.username, u.roles) === areaName);
                  if (areaUsers.length === 0) return null;

                  return (
                    <div key={areaName} style={{ marginBottom: 28 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: "0.05em", marginBottom: 12, borderBottom: "1px solid #E5E7EB", paddingBottom: 6 }}>
                        🏢 ÁREA DE {areaName}
                      </h3>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {areaUsers.map(u => {
                          const initials = u.username.slice(0, 2).toUpperCase();
                          const stats = getUserTasksStats(u.username);

                          return (
                            <div 
                              key={u.id}
                              style={{
                                background: "white",
                                borderRadius: 14,
                                border: "1px solid #E5E7EB",
                                padding: 18,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.01)",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                gap: 12,
                                opacity: u.is_active ? 1 : 0.6
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <div style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: "50%",
                                      background: u.is_active ? "linear-gradient(135deg, #4F7C82, #0B2E33)" : "#9CA3AF",
                                      color: "white",
                                      fontWeight: 800,
                                      fontSize: 12,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}>
                                      {initials}
                                    </div>
                                    <div>
                                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: PRIMARY }}>
                                        {formatUsername(u.username)}
                                      </h4>
                                      <span style={{ fontSize: 11, color: "#6B7280" }}>
                                        {u.email}
                                      </span>
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    borderRadius: 12,
                                    padding: "2px 8px",
                                    background: u.is_active ? "#DCFCE7" : "#FEE2E2",
                                    color: u.is_active ? "#15803D" : "#991B1B"
                                  }}>
                                    {u.is_active ? "Activo" : "Inactivo"}
                                  </span>
                                </div>

                                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#4B5563" }}>
                                  <div><strong>Cargos / Roles:</strong> {u.roles && u.roles.length > 0 ? u.roles.join(" / ") : "Miembro"}</div>
                                </div>
                              </div>

                              {/* Task volume badges */}
                              <div style={{ display: "flex", gap: 8, borderTop: "1px solid #F3F4F6", paddingTop: 10, marginTop: 4 }}>
                                <div style={{ flex: 1, background: LIGHT, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600 }}>Activas</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: PRIMARY }}>{stats.activas}</div>
                                </div>
                                <div style={{ flex: 1, background: "#DCFCE7", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: "#15803D", fontWeight: 600 }}>Completadas</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#15803D" }}>{stats.completadas}</div>
                                </div>
                                {stats.retraso > 0 && (
                                  <div style={{ flex: 1, background: "#FEE2E2", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: "#991B1B", fontWeight: 600 }}>Retraso</div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: "#991B1B" }}>{stats.retraso}</div>
                                  </div>
                                )}
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB: Exportar Reportes */}
            {activeTab === "reportes" && (
              <div style={{ maxWidth: 600, margin: "0 auto", background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: PRIMARY, marginTop: 0, marginBottom: 6 }}>
                  Reportes de Productividad de Personal
                </h3>
                <p style={{ color: "#6B7280", fontSize: 12, margin: "0 0 20px" }}>
                  Exporta un reporte en Excel estructurado con el desglose de horas y actividades de tus colaboradores.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  
                  {/* Filtro Mes */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Seleccionar mes calendario
                    </label>
                    <input 
                      type="month"
                      value={filtroMes}
                      onChange={e => setFiltroMes(e.target.value)}
                      style={{
                        width: "100%",
                        border: "1px solid #D1D5DB",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 13,
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  {/* Filtro Colaborador */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Filtrar por Colaborador específico (Opcional)
                    </label>
                    <select
                      value={filtroUser}
                      onChange={e => setFiltroUser(e.target.value)}
                      style={{
                        width: "100%",
                        border: "1px solid #D1D5DB",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 13,
                        boxSizing: "border-box",
                        background: "white"
                      }}
                    >
                      <option value="">— Todo el Equipo —</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {formatUsername(u.username)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botón de exportación */}
                  <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 18, marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <ExportExcelButton
                      url="/planificacion/productividad/export"
                      params={{
                        mes: filtroMes || null,
                        responsable_id: filtroUser || null
                      }}
                      filename={`Productividad_${filtroMes || "General"}.xlsx`}
                    />
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
