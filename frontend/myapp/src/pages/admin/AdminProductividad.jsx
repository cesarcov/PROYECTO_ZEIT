import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { formatUsername } from "../../hooks/useAuth";
import ExportExcelButton from "../../components/ExportExcelButton";

function cleanActivityDescription(desc) {
  if (!desc) return "";
  return desc.replace(/^\[[^\]]+\]\s*[-:]?\s*/, "");
}

function getRecentMonths() {
  const months = [];
  const date = new Date();
  for (let i = 0; i < 24; i++) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const label = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    months.push({ value: `${y}-${m}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
    date.setMonth(date.getMonth() - 1);
  }
  return months;
}

function UserActivityCard({ username, logs, users, filtroFecha, filtroMes }) {
  const [expanded, setExpanded] = useState(false);
  
  const totalMinutos = logs.reduce((sum, log) => sum + (log.duracion_minutos || 0), 0);
  const totalHoras = (totalMinutos / 60).toFixed(1);
  const formattedName = formatUsername(username);

  return (
    <div style={{
      background: "white",
      borderRadius: 14,
      border: "1px solid #E5E7EB",
      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      overflow: "hidden",
      transition: "all 0.2s ease",
      marginBottom: 12,
    }}>
      {/* Header card */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          background: expanded ? "#F9FAFB" : "white",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid #E5E7EB" : "none",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Avatar circular */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "var(--primary)", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 16,
          }}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: "var(--primary)" }}>
              {formattedName}
            </h4>
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              {logs.length} {logs.length === 1 ? "actividad" : "actividades"} registrada{logs.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16 }} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Tiempo Total</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>{totalHoras}h</div>
          </div>
          
          {/* Export individual excel */}
          <ExportExcelButton
            url="/planificacion/productividad/export"
            filename={`productividad_${username}_${filtroFecha || filtroMes || "completo"}.xlsx`}
            label="Excel"
            params={(() => {
              const params = new URLSearchParams();
              const matchedUser = users.find(u => u.username === username);
              if (matchedUser) params.set("user_id", matchedUser.id);
              if (filtroFecha) {
                params.set("fecha", filtroFecha);
              } else if (filtroMes) {
                params.set("mes", filtroMes);
              }
              return params.toString();
            })()}
          />
          
          {/* Chevron icon */}
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: "#9CA3AF", display: "flex", alignItems: "center",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              padding: "4px 8px"
            }}
          >
            ▼
          </button>
        </div>
      </div>
      
      {/* Collapsible log detail table */}
      {expanded && (
        <div style={{ padding: "0 24px 20px", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Actividad</th>
                <th style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Inicio</th>
                <th style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Fin</th>
                <th style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Duración</th>
                <th style={{ padding: "10px 12px", color: "#9CA3AF", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Tarea Vinculada</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 12px", fontWeight: 500, color: "#111827" }}>
                    {cleanActivityDescription(log.actividad)}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "center", color: "#6B7280" }}>
                    {log.hora_inicio?.slice(0,5)}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "center", color: "#6B7280" }}>
                    {log.hora_fin?.slice(0,5) || "—"}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "center" }}>
                    <span style={{ background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 99, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                      {Math.floor(log.duracion_minutos / 60)}h {log.duracion_minutos % 60}m
                    </span>
                  </td>
                  <td style={{ padding: "12px 12px", color: "#6B7280" }}>
                    {log.tarea_vinculada || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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

export default function AdminProductividad() {
  const navigate = useNavigate();
  const [kpis, setKpis]           = useState(null);
  const [users, setUsers]         = useState([]);
  const [logs, setLogs]           = useState([]);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filtroUser, setFiltroUser]   = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroMes, setFiltroMes]     = useState(new Date().toISOString().slice(0, 7)); // default current month YYYY-MM

  async function loadKpis() {
    setLoadingKpis(true);
    try {
      const [k, u] = await Promise.all([
        apiFetch("/planificacion/kpis"),
        apiFetch("/admin/users"),
      ]);
      setKpis(k);
      setUsers(u);
    } catch (e) { console.error(e); }
    finally { setLoadingKpis(false); }
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (filtroUser)  params.set("user_id", filtroUser);
      if (filtroFecha) {
        params.set("fecha", filtroFecha);
      } else if (filtroMes) {
        params.set("mes", filtroMes);
      }
      const data = await apiFetch(`/planificacion/productividad/admin?${params.toString()}`);
      setLogs(data);
    } catch (e) { console.error(e); }
    finally { setLoadingLogs(false); }
  }

  useEffect(() => { loadKpis(); loadLogs(); }, []);
  useEffect(() => { loadLogs(); }, [filtroUser, filtroFecha, filtroMes]);

  // Group logs by user
  const groupedLogs = {};
  logs.forEach(log => {
    const uname = log.username || "desconocido";
    if (!groupedLogs[uname]) {
      groupedLogs[uname] = [];
    }
    groupedLogs[uname].push(log);
  });

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

  return (
    <Layout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", margin: 0 }}>Dashboard de Productividad</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>Monitoreo de horas y finalización de tareas del equipo</p>
        </div>

        {/* KPI Cards */}
        {loadingKpis ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF" }}>Cargando KPIs...</div>
        ) : kpis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Tareas totales",      value: kpis.tareas_total,            color: "var(--primary)", sub: "en sistema" },
              { label: "Completadas",         value: kpis.tareas_completadas,      color: "#22C55E", sub: "finalizadas" },
              { label: "Tasa finalización",   value: `${kpis.ratio_finalizacion_pct}%`, color: "var(--primary)", sub: "del total" },
              { label: "Tareas retrasadas",   value: kpis.tareas_retrasadas,       color: "#EF4444", sub: "vencidas sin completar" },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: "white", borderRadius: 14, padding: "20px 22px",
                border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}>
                <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>{kpi.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 4 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28, alignItems: "start" }}>

          {/* Carga de trabajo por colaborador (Grouped by Area) */}
          <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", margin: "0 0 4px" }}>Carga de trabajo por colaborador</h3>
            <p style={{ color: "#6B7280", fontSize: 11, margin: "0 0 16px" }}>Distribución de tareas asignadas agrupadas por área de la empresa</p>
            
            {loadingKpis ? (
              <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Cargando datos...</div>
            ) : !kpis?.tareas_por_usuario || kpis.tareas_por_usuario.length === 0 ? (
              <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin tareas asignadas aún</div>
            ) : (() => {
              const areasOrder = ["TI", "GERENCIA", "ADMINISTRACIÓN", "OPERACIONES", "LOGÍSTICA"];
              return areasOrder.map(areaName => {
                const usersInArea = kpis.tareas_por_usuario.filter(u => {
                  const matchedUser = users.find(usr => usr.username.toLowerCase() === u.username.toLowerCase());
                  const userRoles = matchedUser ? matchedUser.roles : [];
                  return getUserArea(u.username, userRoles) === areaName;
                });

                if (usersInArea.length === 0) return null;

                return (
                  <div key={areaName} style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--primary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      borderBottom: "1.5px solid #EEF2F6",
                      paddingBottom: 4,
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <span>{areaName}</span>
                      <span style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                        {usersInArea.length} {usersInArea.length === 1 ? "usuario" : "usuarios"}
                      </span>
                    </div>
                    {usersInArea.map(u => {
                      const activeCount = (u["En Progreso"] || 0) + (u["En espera"] || 0) + (u["Retraso"] || 0);
                      const totalCount = activeCount + (u["Completado"] || 0);
                      
                      const pctComp = totalCount > 0 ? (u["Completado"] / totalCount) * 100 : 0;
                      const pctProg = totalCount > 0 ? (u["En Progreso"] / totalCount) * 100 : 0;
                      const pctWait = totalCount > 0 ? (u["En espera"] / totalCount) * 100 : 0;
                      const pctRetr = totalCount > 0 ? (u["Retraso"] / totalCount) * 100 : 0;

                      return (
                        <div key={u.username} style={{ marginBottom: 12, paddingLeft: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 750, color: "#374151" }}>{formatUsername(u.username)}</span>
                            <span style={{ fontSize: 11, color: activeCount > 5 ? "#EF4444" : "#6B7280", fontWeight: 700 }}>
                              {activeCount} activas {activeCount > 5 && "⚠️ Sat."}
                            </span>
                          </div>
                          <div style={{ width: "100%", background: "#E5E7EB", borderRadius: 99, height: 8, display: "flex", overflow: "hidden" }}>
                            {pctComp > 0 && <div style={{ width: `${pctComp}%`, background: "#22C55E" }} title={`Completado: ${u["Completado"]}`} />}
                            {pctProg > 0 && <div style={{ width: `${pctProg}%`, background: "var(--primary)" }} title={`En Progreso: ${u["En Progreso"]}`} />}
                            {pctWait > 0 && <div style={{ width: `${pctWait}%`, background: "#EAB308" }} title={`En espera: ${u["En espera"]}`} />}
                            {pctRetr > 0 && <div style={{ width: `${pctRetr}%`, background: "#EF4444" }} title={`Retraso: ${u["Retraso"]}`} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>

          {/* Right Column: Distribución de tareas + Alertas de Carga */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Tareas por estado */}
            <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", margin: "0 0 16px" }}>Distribución de tareas</h3>
              {kpis && (() => {
                const total = kpis.tareas_total || 1;
                const completadas = kpis.tareas_completadas || 0;
                const retrasadas = kpis.tareas_retrasadas || 0;
                const enProgreso = Math.max(0, total - completadas - retrasadas);
                
                const pctComp = (completadas / total) * 100;
                const pctRetr = (retrasadas / total) * 100;
                const pctProg = (enProgreso / total) * 100;

                return (
                  <div>
                    <div style={{
                      display: "flex",
                      height: 24,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#E5E7EB",
                      marginBottom: 20,
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)"
                    }}>
                      {pctComp > 0 && <div style={{ width: `${pctComp}%`, background: "#22C55E", transition: "width 0.5s" }} title={`Completadas: ${completadas}`} />}
                      {pctProg > 0 && <div style={{ width: `${pctProg}%`, background: "var(--primary)", transition: "width 0.5s" }} title={`En Progreso: ${enProgreso}`} />}
                      {pctRetr > 0 && <div style={{ width: `${pctRetr}%`, background: "#EF4444", transition: "width 0.5s" }} title={`Retrasadas: ${retrasadas}`} />}
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Completado",  value: completadas, percent: pctComp, color: "#22C55E", bg: "#DCFCE7" },
                        { label: "En Progreso", value: enProgreso,  percent: pctProg, color: "var(--primary)", bg: "var(--primary-soft)" },
                        { label: "Retrasadas",  value: retrasadas,  percent: pctRetr, color: "#EF4444", bg: "#FEE2E2" }
                      ].map(d => (
                        <div key={d.label} style={{ background: d.bg, padding: "12px 14px", borderRadius: 10, border: `1px solid ${d.color}15` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>{d.label}</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: d.color }}>{d.value}</span>
                            <span style={{ fontSize: 12, color: "#9CA3AF" }}>({Math.round(d.percent)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Diagnóstico y Alertas de Carga */}
            {diag && (
              <div style={{
                background: "white",
                borderRadius: 14,
                padding: "20px 24px",
                border: "1px solid #E5E7EB",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", margin: "0 0 16px" }}>
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
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>
                      Estado del Equipo: <span style={{ color: diag.healthColor }}>{diag.healthScore}</span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4B5563", lineHeight: 1.4 }}>
                      {diag.healthDesc}
                    </p>
                  </div>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                    <span>Colaboradores con sobrecarga</span>
                    <span style={{
                      fontWeight: 750,
                      color: diag.sobrecargadosCount > 0 ? "#EF4444" : "#22C55E",
                      background: diag.sobrecargadosCount > 0 ? "#FEE2E2" : "#DCFCE7",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11
                    }}>
                      {diag.sobrecargadosCount} {diag.sobrecargadosCount === 1 ? "usuario" : "usuarios"}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                    <span>Tareas activas en curso</span>
                    <span style={{ fontWeight: 750, color: "var(--primary)" }}>
                      {diag.totalActivas} tareas
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#4B5563" }}>
                    <span>Tareas retrasadas sin completar</span>
                    <span style={{
                      fontWeight: 750,
                      color: diag.retrasadas > 0 ? "#EF4444" : "#22C55E",
                      background: diag.retrasadas > 0 ? "#FEE2E2" : "#DCFCE7",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11
                    }}>
                      {diag.retrasadas} críticas
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auditoría de logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            background: "white",
            borderRadius: 14,
            padding: "20px 24px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                Log de actividades del equipo
              </h3>
              <p style={{ color: "#6B7280", fontSize: 12, margin: "2px 0 0" }}>
                Visualiza el desglose de horas y tareas agrupado por colaborador
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select value={filtroUser} onChange={e => setFiltroUser(e.target.value)}
                style={{ border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "8px 12px", fontSize: 13, background: "white", outline: "none", cursor: "pointer" }}>
                <option value="">Todos los colaboradores</option>
                {users.map(u => <option key={u.id} value={u.id}>{formatUsername(u.username)}</option>)}
              </select>
              
              {/* Filtro de Mes */}
              <select value={filtroMes} onChange={e => { setFiltroMes(e.target.value); setFiltroFecha(""); }}
                style={{ border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "8px 12px", fontSize: 13, background: "white", outline: "none", cursor: "pointer" }}>
                <option value="">Todos los meses</option>
                {getRecentMonths().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>

              {/* Filtro de Día */}
              <input type="date" value={filtroFecha} onChange={e => {
                setFiltroFecha(e.target.value);
                if (e.target.value) setFiltroMes("");
              }}
                style={{ border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "8px 12px", fontSize: 13, outline: "none", cursor: "pointer" }} />
              
              {(filtroUser || filtroFecha || filtroMes !== new Date().toISOString().slice(0, 7)) && (
                <button onClick={() => { setFiltroUser(""); setFiltroFecha(""); setFiltroMes(new Date().toISOString().slice(0, 7)); }}
                  style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  × Limpiar
                </button>
              )}
              
              {/* Global Excel Export */}
              <ExportExcelButton
                url="/planificacion/productividad/export"
                filename={`productividad_equipo_${filtroFecha || filtroMes || "completo"}.xlsx`}
                label="Descargar Excel Completo"
                params={(() => {
                  const params = new URLSearchParams();
                  if (filtroUser) params.set("user_id", filtroUser);
                  if (filtroFecha) {
                    params.set("fecha", filtroFecha);
                  } else if (filtroMes) {
                    params.set("mes", filtroMes);
                  }
                  return params.toString();
                })()}
              />
            </div>
          </div>

          {loadingLogs ? (
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 50, textAlign: "center", color: "#9CA3AF" }}>
              Cargando registros de actividades...
            </div>
          ) : Object.keys(groupedLogs).length === 0 ? (
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 50, textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
              <p style={{ margin: 0, fontWeight: 700, color: "#374151" }}>Sin registros de actividades</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>No hay registros de productividad cargados para los filtros seleccionados.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(groupedLogs).map(([username, userLogs]) => (
                <UserActivityCard
                  key={username}
                  username={username}
                  logs={userLogs}
                  users={users}
                  filtroFecha={filtroFecha}
                  filtroMes={filtroMes}
                />
              ))}
              <div style={{ padding: "4px 12px", color: "#9CA3AF", fontSize: 12, textAlign: "right" }}>
                Total: {logs.length} registros · {(logs.reduce((s, l) => s + l.duracion_minutos, 0) / 60).toFixed(1)}h acumuladas en este listado
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
