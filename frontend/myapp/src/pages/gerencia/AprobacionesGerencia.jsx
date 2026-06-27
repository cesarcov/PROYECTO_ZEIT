import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY = "var(--primary)";
const ACCENT  = "var(--primary)";
const LIGHT   = "var(--primary-soft)";

const TIPO_CONFIG = {
  VISITA_TECNICA: { label: "Visita Técnica", bg: "#EFF6FF", text: "#1E40AF", border: "#DBEAFE", icon: "🚗" },
  COTIZACION:     { label: "Monto Propuesta", bg: "#F5F3FF", text: "#5B21B6", border: "#EDE9FE", icon: "📋" },
  PRESTAMO_COMPRA:{ label: "Préstamo Compra", bg: "#FEF3C7", text: "#92400E", border: "#FEEBDE", icon: "💰" },
};

const ESTADO_CONFIG = {
  PENDIENTE: { bg: "#F3F4F6", text: "#374151", label: "Pendiente" },
  APROBADO:  { bg: "#D1FAE5", text: "#065F46", label: "Aprobado" },
  RECHAZADO: { bg: "#FEE2E2", text: "#991B1B", label: "Rechazado" },
};

export default function AprobacionesGerencia() {
  const navigate = useNavigate();
  const [aprobaciones, setAprobaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDIENTES"); // PENDIENTES | HISTORIAL
  
  // Decision Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [decisionType, setDecisionType] = useState(""); // APROBADO | RECHAZADO
  const [notas, setNotas] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  useEffect(() => {
    loadAprobaciones();
  }, []);

  async function loadAprobaciones() {
    setLoading(true);
    try {
      const data = await apiFetch("/gerencia/aprobaciones");
      setAprobaciones(data);
    } catch (e) {
      console.error("Error al cargar aprobaciones:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleActionClick(item, type) {
    setSelectedItem(item);
    setDecisionType(type);
    setNotas("");
    setShowModal(true);
  }

  function handleDetailClick(item) {
    setDetailItem(item);
    setShowDetailModal(true);
  }

  async function handleSubmitDecision() {
    if (!selectedItem || !decisionType) return;
    setActionLoading(true);
    try {
      await apiFetch(`/gerencia/aprobaciones/${selectedItem.id}/decidir`, {
        method: "POST",
        body: {
          decision: decisionType,
          notas_gerencia: notas,
        },
      });
      setShowModal(false);
      loadAprobaciones();
      if (showDetailModal && detailItem?.id === selectedItem.id) {
        setShowDetailModal(false);
      }
    } catch (e) {
      console.error("Error al registrar decisión:", e);
      alert(e.message || "Error al procesar la aprobación.");
    } finally {
      setActionLoading(false);
    }
  }

  const pendingItems = aprobaciones.filter(a => a.estado === "PENDIENTE");
  const historyItems = aprobaciones.filter(a => a.estado !== "PENDIENTE");
  const currentList = activeTab === "PENDIENTES" ? pendingItems : historyItems;

  return (
    <Layout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Panel de Gerencia</h1>
        <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
          Revisión y aprobación de viáticos de visitas técnicas, propuestas de presupuestos y solicitudes extraordinarias de compra.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "2px solid #E5E7EB", marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("PENDIENTES")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "PENDIENTES" ? `3px solid ${PRIMARY}` : "3px solid transparent",
            color: activeTab === "PENDIENTES" ? PRIMARY : "#6B7280",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Pendientes ({pendingItems.length})
        </button>
        <button
          onClick={() => setActiveTab("HISTORIAL")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "HISTORIAL" ? `3px solid ${PRIMARY}` : "3px solid transparent",
            color: activeTab === "HISTORIAL" ? PRIMARY : "#6B7280",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Historial de decisiones ({historyItems.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Cargando aprobaciones...</div>
      ) : currentList.length === 0 ? (
        <div style={{
          padding: 48,
          textAlign: "center",
          background: "#F9FAFB",
          borderRadius: 12,
          border: "1.5px dashed #E5E7EB",
          color: "#9CA3AF",
        }}>
          {activeTab === "PENDIENTES" ? "🎉 No tienes aprobaciones pendientes." : "Historial vacío."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {currentList.map((item) => {
            const t = TIPO_CONFIG[item.tipo] || { label: item.tipo, bg: "#F3F4F6", text: "#374151", border: "#E5E7EB", icon: "📦" };
            const est = ESTADO_CONFIG[item.estado] || ESTADO_CONFIG.PENDIENTE;
            return (
              <div
                key={item.id}
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                }}
              >
                {/* Content info */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}>
                    {t.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: PRIMARY }}>{item.titulo}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: t.bg,
                        color: t.text,
                        border: `1px solid ${t.border}`,
                        padding: "2px 8px",
                        borderRadius: 99,
                      }}>
                        {t.label}
                      </span>
                    </div>
                    
                    <p style={{ margin: "6px 0 10px", fontSize: 13, color: "#4B5563", lineHeight: 1.5 }}>
                      {item.descripcion}
                    </p>

                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#9CA3AF", alignItems: "center" }}>
                      <span>Solicitado por: <strong style={{ color: "#4B5563" }}>{item.solicitante_username}</strong></span>
                      <span>•</span>
                      <span>Fecha: <strong style={{ color: "#4B5563" }}>{new Date(item.created_at).toLocaleDateString("es-PE")}</strong></span>
                      <span>•</span>
                      <button
                        onClick={() => handleDetailClick(item)}
                        style={{
                          background: "none",
                          border: "none",
                          color: PRIMARY,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 11,
                          textDecoration: "underline",
                        }}
                      >
                        🔍 Ver Detalle Completo
                      </button>
                    </div>

                    {item.notas_gerencia && (
                      <div style={{
                        marginTop: 12,
                        padding: "8px 12px",
                        background: "#F9FAFB",
                        borderLeft: `3px solid ${ACCENT}`,
                        borderRadius: "0 8px 8px 0",
                        fontSize: 12,
                        color: "#4B5563",
                      }}>
                        <strong>Nota de Gerencia:</strong> {item.notas_gerencia}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Area (Amount & Actions) */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, minWidth: 140, flexShrink: 0 }}>
                  {item.monto !== null && (
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: "#9CA3AF", display: "block" }}>Monto</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: PRIMARY }}>
                        {item.tipo === "COTIZACION" ? `$ ` : `S/. `}
                        {item.monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {item.estado === "PENDIENTE" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleActionClick(item, "RECHAZADO")}
                        style={{
                          background: "#FEF2F2",
                          color: "#DC2626",
                          border: "1.5px solid #FECACA",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; }}
                      >
                        ✕ Rechazar
                      </button>
                      <button
                        onClick={() => handleActionClick(item, "APROBADO")}
                        style={{
                          background: PRIMARY,
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          padding: "7px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(0,31,84,0.2)",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = 0.9; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = 1; }}
                      >
                        ✓ Aprobar
                      </button>
                    </div>
                  ) : (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: est.bg,
                      color: est.text,
                      borderRadius: 99,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      border: `1px solid ${item.estado === "APROBADO" ? "#A7F3D0" : "#FCA5A5"}`
                    }}>
                      {item.estado === "APROBADO" ? "✓" : "✕"} {est.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {showModal && selectedItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #E5E7EB" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: PRIMARY, margin: "0 0 6px" }}>
              {decisionType === "APROBADO" ? "✓ Confirmar Aprobación" : "✕ Confirmar Rechazo"}
            </h2>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>
              ¿Estás seguro de que deseas <strong>{decisionType === "APROBADO" ? "aprobar" : "rechazar"}</strong> la solicitud: <strong>{selectedItem.titulo}</strong>?
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                Notas de Gerencia (Justificación)
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Escribe comentarios o notas de revisión (opcional)..."
                rows={4}
                style={{
                  width: "100%",
                  border: "1px solid #D1D5DB",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  resize: "vertical",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={actionLoading}
                style={{
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={actionLoading}
                style={{
                  background: decisionType === "APROBADO" ? PRIMARY : "#DC2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading ? "Procesando..." : "Confirmar Decisión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Inspector Modal */}
      {showDetailModal && detailItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 640, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #E5E7EB" }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1.5px solid #F3F4F6", paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, background: LIGHT, color: PRIMARY, padding: "2px 8px", borderRadius: 99, textTransform: "uppercase" }}>
                  Inspección Detallada ({detailItem.tipo})
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: PRIMARY, margin: "6px 0 0" }}>
                  {detailItem.titulo}
                </h2>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontWeight: 700, color: "#6B7280" }}
              >
                ✕
              </button>
            </div>

            {/* Info Body */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
              
              {/* Visita Técnica Details */}
              {detailItem.tipo === "VISITA_TECNICA" && detailItem.detalles && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Destino de la visita:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 600 }}>{detailItem.detalles.destino}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Fecha planificada:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 600 }}>
                        {detailItem.detalles.fecha_visita ? new Date(detailItem.detalles.fecha_visita).toLocaleDateString("es-PE", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "—"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <strong style={{ color: "#4B5563" }}>Proyecto Asociado:</strong>
                    <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4 }}>{detailItem.detalles.proyecto}</div>
                  </div>
                  <div>
                    <strong style={{ color: "#4B5563" }}>Motivo / Justificación técnica:</strong>
                    <div style={{ background: "#F9FAFB", padding: "10px 14px", borderRadius: 8, marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detailItem.detalles.motivo}</div>
                  </div>
                  <div>
                    <strong style={{ color: "#4B5563" }}>Presupuesto de viáticos solicitado:</strong>
                    <div style={{ fontSize: 20, fontWeight: 900, color: PRIMARY, marginTop: 4 }}>
                      S/. {detailItem.detalles.costo_estimado.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </>
              )}

              {/* Cotización Details */}
              {detailItem.tipo === "COTIZACION" && detailItem.detalles && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <strong style={{ color: "#4B5563" }}>N° Cotización:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 700, color: PRIMARY }}>{detailItem.detalles.numero_cotizacion || "Sin número"}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Cliente:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 600 }}>{detailItem.detalles.cliente_nombre}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Moneda:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4 }}>{detailItem.detalles.moneda}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Plazo de Ejecución:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4 }}>{detailItem.detalles.plazo_dias ? `${detailItem.detalles.plazo_dias} días` : "—"}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Validez de Oferta:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4 }}>{detailItem.detalles.validez_dias ? `${detailItem.detalles.validez_dias} días` : "—"}</div>
                    </div>
                  </div>
                  <div>
                    <strong style={{ color: "#4B5563" }}>Proyecto:</strong>
                    <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4 }}>{detailItem.detalles.proyecto}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: 14, borderRadius: 10, marginTop: 6 }}>
                    <div style={{ fontSize: 24 }}>📈</div>
                    <div>
                      <h4 style={{ margin: 0, color: "#1E40AF", fontWeight: 700 }}>Resumen del Costo Directo</h4>
                      <p style={{ margin: "2px 0 0", color: "#1E3A8A", fontSize: 12 }}>
                        Este presupuesto cuenta con un total de <strong>{detailItem.detalles.partidas_count} partidas</strong> configuradas.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        navigate(`/operations/plans/${detailItem.detalles.plan_id}/presupuesto`);
                      }}
                      style={{
                        marginLeft: "auto", background: PRIMARY, color: "white", border: "none", borderRadius: 8, padding: "8px 14px",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,31,84,0.2)"
                      }}
                    >
                      Ver APUs Completo →
                    </button>
                  </div>
                </>
              )}

              {/* Préstamo Compra Details */}
              {detailItem.tipo === "PRESTAMO_COMPRA" && detailItem.detalles && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Código OC:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 700, color: PRIMARY }}>{detailItem.detalles.code}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Proveedor:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 600 }}>{detailItem.detalles.proveedor}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Almacén de Destino:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4 }}>{detailItem.detalles.almacen}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#4B5563" }}>Monto de Compra:</strong>
                      <div style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 4, fontWeight: 700 }}>S/. {detailItem.detalles.total_estimado.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                  <div>
                    <strong style={{ color: "#4B5563" }}>Justificación / Notas del Comprador:</strong>
                    <div style={{ background: "#F9FAFB", padding: "10px 14px", borderRadius: 8, marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detailItem.detalles.notas || "Sin notas específicas."}</div>
                  </div>

                  {/* Items list */}
                  <div>
                    <strong style={{ color: "#4B5563", display: "block", marginBottom: 6 }}>Lista de Materiales Solicitados:</strong>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", color: "#6B7280" }}>Material</th>
                            <th style={{ padding: "8px 12px", textAlign: "right", color: "#6B7280" }}>Cant.</th>
                            <th style={{ padding: "8px 12px", textAlign: "right", color: "#6B7280" }}>Precio U.</th>
                            <th style={{ padding: "8px 12px", textAlign: "right", color: "#6B7280" }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailItem.detalles.items && detailItem.detalles.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < detailItem.detalles.items.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 600 }}>{it.material}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right" }}>{it.cantidad.toLocaleString("es-PE")}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right" }}>S/. {it.precio_unitario.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>S/. {(it.cantidad * it.precio_unitario).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Status information */}
              <div style={{ marginTop: 12, borderTop: "1.5px solid #F3F4F6", paddingTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <span>Estado actual de la solicitud:</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                  background: ESTADO_CONFIG[detailItem.estado].bg,
                  color: ESTADO_CONFIG[detailItem.estado].text,
                  border: `1px solid ${detailItem.estado === "APROBADO" ? "#A7F3D0" : detailItem.estado === "RECHAZADO" ? "#FCA5A5" : "#E5E7EB"}`
                }}>{ESTADO_CONFIG[detailItem.estado].label}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1.5px solid #F3F4F6", paddingTop: 16, marginTop: 20 }}>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 20px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer"
                }}
              >
                Cerrar Detalle
              </button>
              {detailItem.estado === "PENDIENTE" && (
                <>
                  <button
                    onClick={() => handleActionClick(detailItem, "RECHAZADO")}
                    style={{
                      background: "#FEF2F2", color: "#DC2626", border: "1.5px solid #FECACA", borderRadius: 8, padding: "9px 18px",
                      fontSize: 13, fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    ✕ Rechazar
                  </button>
                  <button
                    onClick={() => handleActionClick(detailItem, "APROBADO")}
                    style={{
                      background: PRIMARY, color: "white", border: "none", borderRadius: 8, padding: "10px 20px",
                      fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,31,84,0.2)"
                    }}
                  >
                    ✓ Aprobar
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
}
