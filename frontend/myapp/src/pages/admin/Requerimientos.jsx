import { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { formatUsername } from "../../hooks/useAuth";

const CATEGORIAS = ["Hospedaje", "Transporte", "Alimentación", "Exámenes Médicos", "Seguros", "Otros"];
const ESTADOS_REQ = ["Cotizado", "En Curso", "Finalizado", "Cancelado"];

const CATEGORIA_COLOR = {
  "Hospedaje":        "var(--primary)",
  "Transporte":       "#CA8A04",
  "Alimentación":     "#16A34A",
  "Exámenes Médicos": "#2563EB",
  "Seguros":          "#7C3AED",
  "Otros":            "#6B7280",
};

const CELL = {
  border: "none", background: "transparent", width: "100%",
  fontSize: 12, padding: "6px 8px", fontFamily: "inherit",
  color: "#111827", boxSizing: "border-box",
};

const COMPACT_INPUT = {
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "#192A2C",
  background: "#FFFFFF",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.15s ease",
};

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 300,
      background: isErr ? "#FEE2E2" : "#DCFCE7",
      color: isErr ? "#DC2626" : "#15803D",
      border: `1px solid ${isErr ? "#FCA5A5" : "#86EFAC"}`,
      borderRadius: 12, padding: "12px 20px", fontSize: 13, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
    }}>
      {isErr ? "✗ " : "✓ "}{toast.msg}
    </div>
  );
}

export default function Requerimientos() {
  const [clientes, setClientes] = useState([]);
  const [requerimientos, setRequerimientos] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [costos, setCostos] = useState([]);
  const [deletedCostoIds, setDeletedCostoIds] = useState([]);
  const [kpis, setKpis] = useState({ por_categoria: [], por_cliente: [], global_costos: [] });
  const [loading, setLoading] = useState(true);
  const [loadingCostos, setLoadingCostos] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [savingCostos, setSavingCostos] = useState(false);
  const [toast, setToast] = useState(null);

  // Formulario de nuevo Requerimiento
  const [showNewReqModal, setShowNewReqModal] = useState(false);
  const [newReq, setNewReq] = useState({
    cliente_id: "",
    nombre_servicio: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    estado: "Cotizado"
  });

  // Filtros Globales de Costos (Pestaña KPIs/Breackdown)
  const [filtroCategoriaGlobal, setFiltroCategoriaGlobal] = useState("");
  const [filtroClienteGlobal, setFiltroClienteGlobal] = useState("");

  // Modal de Detalles específicos (JSONB)
  const [editingDetailsCosto, setEditingDetailsCosto] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [clientsList, reqsList, kpiData] = await Promise.all([
        apiFetch("/clientes?solo_activos=true"),
        apiFetch("/requerimientos"),
        apiFetch("/requerimientos/kpis")
      ]);
      setClientes(clientsList);
      setRequerimientos(reqsList);
      setKpis(kpiData);
    } catch (e) {
      console.error(e);
      showToast("Error al cargar los datos", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function selectRequirement(req) {
    setSelectedReq(req);
    setLoadingCostos(true);
    setDeletedCostoIds([]);
    try {
      const costList = await apiFetch(`/requerimientos/${req.id}/costos`);
      setCostos(costList.map(c => ({ ...c, isDirty: false, isNew: false })));
    } catch (e) {
      console.error(e);
      showToast("Error al cargar costos del requerimiento", "error");
    } finally {
      setLoadingCostos(false);
    }
  }

  async function handleCreateReq(e) {
    e.preventDefault();
    if (!newReq.cliente_id || !newReq.nombre_servicio) {
      showToast("Cliente y Nombre del Servicio son obligatorios", "error");
      return;
    }
    setSavingReq(true);
    try {
      const created = await apiFetch("/requerimientos", {
        method: "POST",
        body: JSON.stringify(newReq)
      });
      showToast("Requerimiento de servicio creado exitosamente");
      setShowNewReqModal(false);
      setNewReq({
        cliente_id: "",
        nombre_servicio: "",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        estado: "Cotizado"
      });
      await loadData();
      // Auto seleccionar el creado
      selectRequirement(created);
    } catch (e) {
      console.error(e);
      showToast("Error al crear requerimiento", "error");
    } finally {
      setSavingReq(false);
    }
  }

  async function handleUpdateReqState(estado) {
    if (!selectedReq) return;
    try {
      const updated = await apiFetch(`/requerimientos/${selectedReq.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado })
      });
      setSelectedReq(updated);
      setRequerimientos(prev => prev.map(r => r.id === updated.id ? { ...r, estado: updated.estado } : r));
      showToast(`Estado actualizado a ${estado}`);
      loadData();
    } catch (e) {
      console.error(e);
      showToast("Error al actualizar estado", "error");
    }
  }

  async function handleDeleteReq() {
    if (!selectedReq) return;
    if (!window.confirm("¿Está seguro de eliminar este requerimiento y todos sus costos asociados?")) return;
    try {
      await apiFetch(`/requerimientos/${selectedReq.id}`, { method: "DELETE" });
      showToast("Requerimiento eliminado");
      setSelectedReq(null);
      setCostos([]);
      loadData();
    } catch (e) {
      console.error(e);
      showToast("Error al eliminar requerimiento", "error");
    }
  }

  function addCostoRow() {
    if (!selectedReq) return;
    const newRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      requerimiento_id: selectedReq.id,
      categoria: "Hospedaje",
      descripcion: "",
      costo_unitario: 0.0,
      cantidad: 1.0,
      total: 0.0,
      detalles: {},
      isNew: true,
      isDirty: true
    };
    setCostos(prev => [...prev, newRow]);
  }

  function updateCostoRow(costoId, field, value) {
    setCostos(prev =>
      prev.map(c => {
        if (c.id === costoId) {
          const updated = { ...c, [field]: value, isDirty: true };
          if (field === "costo_unitario" || field === "cantidad") {
            const cu = field === "costo_unitario" ? parseFloat(value) || 0 : c.costo_unitario;
            const cant = field === "cantidad" ? parseFloat(value) || 0 : c.cantidad;
            updated.total = cu * cant;
          }
          return updated;
        }
        return c;
      })
    );
  }

  function deleteCostoRow(costo) {
    setCostos(prev => prev.filter(c => c.id !== costo.id));
    if (!costo.isNew) {
      setDeletedCostoIds(prev => [...prev, costo.id]);
    }
  }

  async function handleSaveCostos() {
    if (!selectedReq) return;
    const invalidRows = costos.filter(c => !c.descripcion.trim());
    if (invalidRows.length > 0) {
      showToast(`${invalidRows.length} fila(s) sin descripción obligatoria`, "error");
      return;
    }

    setSavingCostos(true);
    try {
      const upsert = costos
        .filter(c => c.isNew || c.isDirty)
        .map(c => ({
          id:             c.isNew ? null : c.id,
          categoria:      c.categoria,
          descripcion:    c.descripcion.trim(),
          costo_unitario: parseFloat(c.costo_unitario) || 0.0,
          cantidad:       parseFloat(c.cantidad) || 0.0,
          detalles:       c.detalles || {}
        }));

      const res = await apiFetch(`/requerimientos/${selectedReq.id}/costos/bulk`, {
        method: "POST",
        body: JSON.stringify({ upsert, delete: deletedCostoIds })
      });

      showToast(`Cambios guardados: ${res.inserted} insertados, ${res.updated} actualizados, ${res.deleted} eliminados`);
      
      // Recargar datos
      await loadData();
      const freshCostList = await apiFetch(`/requerimientos/${selectedReq.id}/costos`);
      setCostos(freshCostList.map(c => ({ ...c, isDirty: false, isNew: false })));
      setDeletedCostoIds([]);
    } catch (e) {
      console.error(e);
      showToast("Error al guardar los costos", "error");
    } finally {
      setSavingCostos(false);
    }
  }

  // Guardar detalles variables (JSONB)
  function saveEditingDetails(detallesValues) {
    if (!editingDetailsCosto) return;
    updateCostoRow(editingDetailsCosto.id, "detalles", detallesValues);
    setEditingDetailsCosto(null);
    showToast("Detalles específicos asignados temporalmente");
  }

  // Filtrado de costos en KPIs / Breakdown Global
  const filteredGlobalCostos = kpis.global_costos.filter(c => {
    if (filtroCategoriaGlobal && c.categoria !== filtroCategoriaGlobal) return false;
    if (filtroClienteGlobal && !c.cliente.toLowerCase().includes(filtroClienteGlobal.toLowerCase())) return false;
    return true;
  });

  const totalCostoGeneral = kpis.global_costos.reduce((acc, c) => acc + c.total, 0);

  return (
    <Layout>
      <style>{`
        .req-card { transition: all 0.2s ease; cursor: pointer; }
        .req-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important; }
        .btn-act { transition: all 0.15s ease; }
        .btn-act:hover { opacity: 0.9; transform: scale(1.02); }
        .table-input { border: 1px solid transparent; background: transparent; padding: 4px 6px; border-radius: 4px; font-size: 12px; width: 100%; box-sizing: border-box; }
        .table-input:hover { border-color: #D1D5DB; background: #FFFFFF; }
        .table-input:focus { border-color: var(--primary); background: #FFFFFF; outline: none; box-shadow: 0 0 0 2px rgba(0,58,140,0.1); }
      `}</style>

      <div style={{ padding: "0 4px" }}>
        
        {/* ── Cabecera ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              Requerimientos de Servicios y Costos
            </h1>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
              Cotización y administración de hospedaje, transporte, exámenes médicos, seguros y alimentación por cliente.
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowNewReqModal(true)}
              className="btn-act"
              style={{
                background: "var(--primary)", color: "white", border: "none", borderRadius: 9,
                padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,31,84,0.2)"
              }}
            >
              + Nuevo Requerimiento
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#9CA3AF" }}>Cargando datos del módulo...</div>
        ) : (
          <div style={{ display: "flex", gap: 20, flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" }}>
            
            {/* ── PANEL IZQUIERDO: Requerimientos de Servicios (1/3 Ancho) ────── */}
            <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)", margin: "0 0 12px 0", textTransform: "uppercase" }}>
                  Servicios Activos por Cliente ({requerimientos.length})
                </h2>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "550px", overflowY: "auto", paddingRight: 4 }}>
                  {requerimientos.length === 0 ? (
                    <div style={{ padding: "32px 12px", textAlign: "center", color: "#9CA3AF", fontSize: 12, border: "1.5px dashed #E5E7EB", borderRadius: 8 }}>
                      No hay requerimientos activos. Comience creando uno.
                    </div>
                  ) : (
                    requerimientos.map(req => {
                      const isSelected = selectedReq?.id === req.id;
                      return (
                        <div
                          key={req.id}
                          onClick={() => selectRequirement(req)}
                          className="req-card"
                          style={{
                            background: isSelected ? "var(--primary-soft)" : "#F9FAFB",
                            border: isSelected ? "1px solid var(--primary)" : "1px solid #E5E7EB",
                            borderRadius: 10, padding: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#4B5563", background: "#E5E7EB", padding: "2px 6px", borderRadius: 4 }}>
                              {req.cliente_razon_social}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                              background: req.estado === "En Curso" ? "#DCFCE7" : req.estado === "Cotizado" ? "#FEF9C3" : "#F3F4F6",
                              color: req.estado === "En Curso" ? "#16A34A" : req.estado === "Cotizado" ? "#CA8A04" : "#4B5563",
                            }}>
                              {req.estado}
                            </span>
                          </div>
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 6px 0" }}>
                            {req.nombre_servicio}
                          </h3>
                          {req.descripcion && (
                            <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 8px 0", lineBreak: "anywhere" }}>
                              {req.descripcion}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#9CA3AF" }}>
                            {req.fecha_inicio && <span>Inicio: {req.fecha_inicio}</span>}
                            {req.fecha_fin && <span>Fin: {req.fecha_fin}</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── PANEL DERECHO: Matriz de Costos Relacionada (2/3 Ancho) ────── */}
            <div style={{ flex: "2 1 600px", display: "flex", flexDirection: "column", gap: 14 }}>
              {selectedReq ? (
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", gap: 14 }}>
                  
                  {/* Detalles del Requerimiento Seleccionado */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", paddingBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>
                        Ficha de Costos de Administración
                      </span>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>
                        {selectedReq.nombre_servicio} · {selectedReq.cliente_razon_social}
                      </h2>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={selectedReq.estado}
                        onChange={e => handleUpdateReqState(e.target.value)}
                        style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "5px 10px", fontSize: 12, background: "white", cursor: "pointer" }}
                      >
                        {ESTADOS_REQ.map(st => <option key={st}>{st}</option>)}
                      </select>
                      <button
                        onClick={handleDeleteReq}
                        title="Eliminar requerimiento"
                        style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
                      >
                        🗑 Borrar
                      </button>
                    </div>
                  </div>

                  {/* Detalle de Costos */}
                  {loadingCostos ? (
                    <div style={{ textAlign: "center", padding: "48px 0", color: "#9CA3AF" }}>Cargando matriz de costos...</div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#4B5563" }}>
                          Costos Programados ({costos.length})
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={addCostoRow}
                            style={{
                              background: "#F0FDF4", color: "#16A34A", border: "1px solid #86EFAC",
                              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                            }}
                          >
                            + Agregar Costo
                          </button>
                          <button
                            onClick={handleSaveCostos}
                            disabled={savingCostos || (costos.length === 0 && deletedCostoIds.length === 0)}
                            style={{
                              background: "var(--primary)", color: "white", border: "none",
                              borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                            }}
                          >
                            {savingCostos ? "Guardando..." : "💾 Guardar Cambios"}
                          </button>
                        </div>
                      </div>

                      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                          <thead>
                            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "8px 10px", width: 140 }}>Categoría</th>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "8px 10px", width: 220 }}>Descripción / Destinatario</th>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "right", padding: "8px 10px", width: 100 }}>Costo Unit.</th>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "right", padding: "8px 10px", width: 80 }}>Cant.</th>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "right", padding: "8px 10px", width: 100 }}>Total</th>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "center", padding: "8px 10px", width: 90 }}>Detalles</th>
                              <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "center", padding: "8px 10px", width: 44 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {costos.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 12 }}>
                                  No hay costos programados para este servicio. Agregue uno con "+ Agregar Costo".
                                </td>
                              </tr>
                            ) : (
                              costos.map(costo => {
                                const hasDetails = Object.keys(costo.detalles || {}).length > 0;
                                return (
                                  <tr key={costo.id} style={{ borderBottom: "1px solid #F3F4F6", background: costo.isNew ? "#F0FFF4" : costo.isDirty ? "#FEFCE8" : "white" }}>
                                    
                                    {/* Categoría */}
                                    <td style={{ padding: "4px" }}>
                                      <select
                                        className="table-input"
                                        value={costo.categoria}
                                        onChange={e => updateCostoRow(costo.id, "categoria", e.target.value)}
                                        style={{ fontSize: 12, fontWeight: 600, color: CATEGORIA_COLOR[costo.categoria] }}
                                      >
                                        {CATEGORIAS.map(cat => <option key={cat}>{cat}</option>)}
                                      </select>
                                    </td>

                                    {/* Descripción */}
                                    <td style={{ padding: "4px" }}>
                                      <input
                                        className="table-input"
                                        value={costo.descripcion}
                                        onChange={e => updateCostoRow(costo.id, "descripcion", e.target.value)}
                                        placeholder="ej. Alquiler de camioneta 4x4..."
                                      />
                                    </td>

                                    {/* Costo Unitario */}
                                    <td style={{ padding: "4px" }}>
                                      <input
                                        type="number" step="0.01"
                                        className="table-input"
                                        value={costo.costo_unitario}
                                        onChange={e => updateCostoRow(costo.id, "costo_unitario", e.target.value)}
                                        style={{ textAlign: "right" }}
                                      />
                                    </td>

                                    {/* Cantidad */}
                                    <td style={{ padding: "4px" }}>
                                      <input
                                        type="number" step="0.1"
                                        className="table-input"
                                        value={costo.cantidad}
                                        onChange={e => updateCostoRow(costo.id, "cantidad", e.target.value)}
                                        style={{ textAlign: "right" }}
                                      />
                                    </td>

                                    {/* Total Calculado */}
                                    <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#111827" }}>
                                      S/ {costo.total.toFixed(2)}
                                    </td>

                                    {/* Botón de Detalles Variables (JSONB) */}
                                    <td style={{ padding: "4px", textAlign: "center" }}>
                                      <button
                                        onClick={() => setEditingDetailsCosto(costo)}
                                        style={{
                                          background: hasDetails ? "var(--primary-soft)" : "#F3F4F6",
                                          color: hasDetails ? "var(--primary)" : "#4B5563",
                                          border: `1px solid ${hasDetails ? "#D1D5DB" : "#D1D5DB"}`,
                                          borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer"
                                        }}
                                      >
                                        {hasDetails ? "⚙️ Ver ({})" : "⚙️ Config"}
                                      </button>
                                    </td>

                                    {/* Borrar Fila */}
                                    <td style={{ padding: "4px", textAlign: "center" }}>
                                      <button
                                        onClick={() => deleteCostoRow(costo)}
                                        style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 14, cursor: "pointer" }}
                                        onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
                                        onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
                                      >
                                        🗑
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                  padding: "64px 24px", border: "2px dashed #E5E7EB", borderRadius: 12, background: "#F9FAFB", color: "#9CA3AF"
                }}>
                  <span style={{ fontSize: 36, marginBottom: 10 }}>📋</span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Seleccione un cliente y servicio de la izquierda para ver y programar sus costos.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── SECCIÓN INFERIOR: KPIs y Consolidado Histórico de Costos ────── */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)", margin: "10px 0 0 0", textTransform: "uppercase" }}>
            Resumen de Costos y Reporte Consolidado Global
          </h2>

          {/* Tarjetas KPI por Categoría */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {CATEGORIAS.map(cat => {
              const kpi = kpis.por_categoria.find(k => k.categoria === cat);
              const amount = kpi ? kpi.total : 0.0;
              return (
                <div
                  key={cat}
                  style={{
                    flex: "1 1 150px", background: "white", borderRadius: 10, border: "1px solid #E5E7EB",
                    padding: 12, borderTop: `4px solid ${CATEGORIA_COLOR[cat] || "#9CA3AF"}`, boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 4 }}>
                    {cat}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                    S/ {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
            
            {/* Total General */}
            <div style={{
              flex: "1 1 180px", background: "var(--primary-soft)", borderRadius: 10, border: "1px solid #D1D5DB",
              padding: 12, borderTop: "4px solid var(--primary)", boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", display: "block", marginBottom: 4 }}>
                TOTAL GENERAL DE SERVICIOS
              </span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "var(--primary)" }}>
                S/ {totalCostoGeneral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Tabla de Consolidado Global (Breakdown con filtros de Categoría) */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                  Detalle Consolidado de Costos
                </h3>
                <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0 0" }}>
                  Muestra todos los costos registrados en el sistema filtrados por categoría (ej. solo vehículos, solo hospedajes).
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={filtroClienteGlobal}
                  onChange={e => setFiltroClienteGlobal(e.target.value)}
                  placeholder="Filtrar por cliente..."
                  style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 12px", fontSize: 12, width: 160 }}
                />
                <select
                  value={filtroCategoriaGlobal}
                  onChange={e => setFiltroCategoriaGlobal(e.target.value)}
                  style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 12px", fontSize: 12, background: "white" }}
                >
                  <option value="">Todas las categorías</option>
                  {CATEGORIAS.map(cat => <option key={cat}>{cat}</option>)}
                </select>
                {(filtroCategoriaGlobal || filtroClienteGlobal) && (
                  <button
                    onClick={() => { setFiltroCategoriaGlobal(""); setFiltroClienteGlobal(""); }}
                    style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E5E7EB" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "10px" }}>Cliente</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "10px" }}>Servicio</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "10px", width: 130 }}>Categoría</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "10px" }}>Descripción / Costo</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "right", padding: "10px", width: 90 }}>Cant.</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "right", padding: "10px", width: 110 }}>Total</th>
                    <th style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", textAlign: "left", padding: "10px", width: 220 }}>Detalles del Requerimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGlobalCostos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 12 }}>
                        Ningún costo coincide con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredGlobalCostos.map(costo => {
                      const det = costo.detalles || {};
                      let detailsStr = "";
                      if (costo.categoria === "Hospedaje") {
                        detailsStr = `${det.hotel || "S/H"} · ${det.noches || 0} noches · hab. ${det.habitacion_tipo || "S/D"}`;
                      } else if (costo.categoria === "Transporte") {
                        detailsStr = `${det.proveedor || "S/P"} · Placa: ${det.placa || "S/Pl"} · ${det.vehiculo_tipo || "S/V"}`;
                      } else if (costo.categoria === "Exámenes Médicos" || costo.categoria === "Seguros" || costo.categoria === "Otros") {
                        detailsStr = `${det.personal ? det.personal.substring(0, 45) + "..." : "Sin lista de personal"}`;
                      } else {
                        detailsStr = JSON.stringify(det);
                      }

                      return (
                        <tr key={costo.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 12 }}>
                          <td style={{ padding: "10px", fontWeight: 700, color: "var(--primary)" }}>{costo.cliente}</td>
                          <td style={{ padding: "10px", color: "#111827" }}>{costo.nombre_servicio}</td>
                          <td style={{ padding: "10px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                              background: `${CATEGORIA_COLOR[costo.categoria]}15`,
                              color: CATEGORIA_COLOR[costo.categoria]
                            }}>{costo.categoria}</span>
                          </td>
                          <td style={{ padding: "10px" }}>
                            <div style={{ fontWeight: 600 }}>{costo.descripcion}</div>
                            <div style={{ fontSize: 10, color: "#6B7280" }}>C.U: S/ {costo.costo_unitario.toFixed(2)}</div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right" }}>{costo.cantidad}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>S/ {costo.total.toFixed(2)}</td>
                          <td style={{ padding: "10px", fontSize: 11, color: "#6B7280", fontStyle: "italic" }}>
                            {detailsStr}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* ── MODAL: Crear Nuevo Requerimiento de Servicio ───────────────── */}
      {showNewReqModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 200
        }}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: "480px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)", margin: 0 }}>Crear Nuevo Servicio y Requerimientos</h3>
              <button onClick={() => setShowNewReqModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <form onSubmit={handleCreateReq} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Cliente *</label>
                <select
                  value={newReq.cliente_id}
                  onChange={e => setNewReq(prev => ({ ...prev, cliente_id: e.target.value }))}
                  style={COMPACT_INPUT}
                  required
                >
                  <option value="">— Seleccionar Cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Nombre del Servicio *</label>
                <input
                  type="text"
                  placeholder="ej. Servicio de Soldadura y Montaje Planta 2"
                  value={newReq.nombre_servicio}
                  onChange={e => setNewReq(prev => ({ ...prev, nombre_servicio: e.target.value }))}
                  style={COMPACT_INPUT}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Descripción / Notas</label>
                <textarea
                  rows={3}
                  placeholder="Detalles sobre el proyecto, condiciones de trabajo..."
                  value={newReq.descripcion}
                  onChange={e => setNewReq(prev => ({ ...prev, descripcion: e.target.value }))}
                  style={{ ...COMPACT_INPUT, resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Fecha de Inicio</label>
                  <input
                    type="date"
                    value={newReq.fecha_inicio}
                    onChange={e => setNewReq(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    style={COMPACT_INPUT}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Fecha de Fin</label>
                  <input
                    type="date"
                    value={newReq.fecha_fin}
                    onChange={e => setNewReq(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    style={COMPACT_INPUT}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Estado Inicial</label>
                <select
                  value={newReq.estado}
                  onChange={e => setNewReq(prev => ({ ...prev, estado: e.target.value }))}
                  style={COMPACT_INPUT}
                >
                  {ESTADOS_REQ.map(st => <option key={st}>{st}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button
                  type="button" onClick={() => setShowNewReqModal(false)}
                  style={{ background: "#F3F4F6", color: "#4B5563", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={savingReq}
                  style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {savingReq ? "Creando..." : "Crear Requerimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Variables de Costo (JSONB) Dinámico por Categoría ──── */}
      {editingDetailsCosto && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 200
        }}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: "460px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                Detalles Específicos: {editingDetailsCosto.categoria}
              </h3>
              <button onClick={() => setEditingDetailsCosto(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* Formulario Variable según Categoría */}
              {editingDetailsCosto.categoria === "Hospedaje" && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Nombre del Hotel</label>
                    <input
                      type="text"
                      className="details-field"
                      placeholder="Hotel El Mirador, Arequipa..."
                      defaultValue={editingDetailsCosto.detalles?.hotel || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Número de Noches</label>
                    <input
                      type="number"
                      className="details-field"
                      placeholder="5"
                      defaultValue={editingDetailsCosto.detalles?.noches || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Tipo de Habitación</label>
                    <input
                      type="text"
                      className="details-field"
                      placeholder="Simple, Doble, Matrimonial..."
                      defaultValue={editingDetailsCosto.detalles?.habitacion_tipo || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>
                </>
              )}

              {editingDetailsCosto.categoria === "Transporte" && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Proveedor / Rent-a-car</label>
                    <input
                      type="text"
                      className="details-field"
                      placeholder="Toyota Rental, Hertz..."
                      defaultValue={editingDetailsCosto.detalles?.proveedor || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Placa del Vehículo</label>
                    <input
                      type="text"
                      className="details-field"
                      placeholder="V4N-890..."
                      defaultValue={editingDetailsCosto.detalles?.placa || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Tipo de Vehículo</label>
                    <input
                      type="text"
                      className="details-field"
                      placeholder="Camioneta Hilux 4x4, Minivan 15 pax, Camión Grúa..."
                      defaultValue={editingDetailsCosto.detalles?.vehiculo_tipo || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>
                </>
              )}

              {/* Categorías que guardan listas de personal programado */}
              {(editingDetailsCosto.categoria === "Exámenes Médicos" || editingDetailsCosto.categoria === "Seguros" || editingDetailsCosto.categoria === "Otros") && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>
                      {editingDetailsCosto.categoria === "Exámenes Médicos" ? "Clínica / Entidad programadora" : editingDetailsCosto.categoria === "Seguros" ? "Proveedor del Seguro" : "Nombre del Trámite"}
                    </label>
                    <input
                      type="text"
                      className="details-field"
                      placeholder="ej. San Pablo, SCTR Salud Rímac, Antecedentes Penales..."
                      defaultValue={editingDetailsCosto.detalles?.clinica || editingDetailsCosto.detalles?.compania || editingDetailsCosto.detalles?.tramite || ""}
                      style={COMPACT_INPUT}
                    />
                  </div>

                  {editingDetailsCosto.categoria === "Exámenes Médicos" && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Fecha Programada</label>
                      <input
                        type="date"
                        className="details-field"
                        defaultValue={editingDetailsCosto.detalles?.fecha_programada || ""}
                        style={COMPACT_INPUT}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>
                      Personal Programado / Destinatario(s) (Fijos o temporales)
                    </label>
                    <textarea
                      rows={4}
                      className="details-field"
                      placeholder="Ingresar los nombres del personal fijo y los contratados temporales para el servicio, uno por fila..."
                      defaultValue={editingDetailsCosto.detalles?.personal || ""}
                      style={{ ...COMPACT_INPUT, resize: "none" }}
                    />
                  </div>
                </>
              )}

              {editingDetailsCosto.categoria === "Alimentación" && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Detalle de alimentación / viáticos</label>
                  <textarea
                    rows={3}
                    className="details-field"
                    placeholder="Desayunos, almuerzos, cenas para personal en planta..."
                    defaultValue={editingDetailsCosto.detalles?.comida_detalle || ""}
                    style={{ ...COMPACT_INPUT, resize: "none" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => setEditingDetailsCosto(null)}
                  style={{ background: "#F3F4F6", color: "#4B5563", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const fields = document.querySelectorAll(".details-field");
                    const vals = {};
                    if (editingDetailsCosto.categoria === "Hospedaje") {
                      vals.hotel = fields[0].value;
                      vals.noches = parseInt(fields[1].value) || 0;
                      vals.habitacion_tipo = fields[2].value;
                    } else if (editingDetailsCosto.categoria === "Transporte") {
                      vals.proveedor = fields[0].value;
                      vals.placa = fields[1].value;
                      vals.vehiculo_tipo = fields[2].value;
                    } else if (editingDetailsCosto.categoria === "Exámenes Médicos") {
                      vals.clinica = fields[0].value;
                      vals.fecha_programada = fields[1].value;
                      vals.personal = fields[2].value;
                    } else if (editingDetailsCosto.categoria === "Seguros") {
                      vals.compania = fields[0].value;
                      vals.personal = fields[1].value;
                    } else if (editingDetailsCosto.categoria === "Otros") {
                      vals.tramite = fields[0].value;
                      vals.personal = fields[1].value;
                    } else if (editingDetailsCosto.categoria === "Alimentación") {
                      vals.comida_detalle = fields[0].value;
                    }
                    saveEditingDetails(vals);
                  }}
                  style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Asignar Detalles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </Layout>
  );
}
