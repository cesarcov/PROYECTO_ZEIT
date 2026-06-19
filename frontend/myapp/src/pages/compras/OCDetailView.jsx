import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY = "#0B2E33";
const ACCENT  = "#B8E3E9";
const MID     = "#4F7C82";
const LIGHT   = "#EEF7F8";

const STATUS_CONFIG = {
  BORRADOR:    { bg: "#F3F4F6", text: "#374151",  label: "Borrador",    icon: "✏️" },
  ENVIADA:     { bg: "#DBEAFE", text: "#1E40AF",  label: "Enviada",     icon: "📤" },
  APROBADA:    { bg: "#D1FAE5", text: "#065F46",  label: "Aprobada",    icon: "✅" },
  EN_TRANSITO: { bg: "#FEF3C7", text: "#92400E",  label: "En Tránsito", icon: "🚚" },
  RECIBIDA:    { bg: "#E0E7FF", text: "#3730A3",  label: "Recibida",    icon: "📦" },
  CERRADA:     { bg: "#F0FDF4", text: "#14532D",  label: "Cerrada",     icon: "🔒" },
  CANCELADA:   { bg: "#FEE2E2", text: "#991B1B",  label: "Cancelada",   icon: "❌" },
};

const TRANSITIONS = {
  BORRADOR:    ["ENVIADA", "CANCELADA"],
  ENVIADA:     ["APROBADA", "CANCELADA"],
  APROBADA:    ["EN_TRANSITO", "CANCELADA"],
  EN_TRANSITO: ["RECIBIDA"],
  RECIBIDA:    ["CERRADA"],
};

const TRANS_LABELS = {
  ENVIADA:     { label: "Enviar OC", bg: "#1D4ED8", color: "white" },
  APROBADA:    { label: "Aprobar",   bg: "#059669", color: "white" },
  EN_TRANSITO: { label: "Marcar En Tránsito", bg: "#D97706", color: "white" },
  RECIBIDA:    { label: "Registrar Recepción", bg: "#7C3AED", color: "white" },
  CERRADA:     { label: "Cerrar OC", bg: "#374151", color: "white" },
  CANCELADA:   { label: "Cancelar",  bg: "#DC2626", color: "white" },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || { bg: "#F3F4F6", text: "#374151", label: status, icon: "?" };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 5 }}>
      {c.icon} {c.label}
    </span>
  );
}

function ProgressBar({ pedida, recibida }) {
  const pct = pedida > 0 ? Math.min(100, (recibida / pedida) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#E5E7EB", borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#10B981" : "#6366F1", borderRadius: 99, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 100 ? "#10B981" : "#6B7280", whiteSpace: "nowrap" }}>
        {recibida}/{pedida}
      </span>
    </div>
  );
}

export default function OCDetailView() {
  const { ocId } = useParams();
  const navigate  = useNavigate();

  const [oc, setOc]               = useState(null);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [actioning, setActioning] = useState(false);
  const [error, setError]         = useState("");

  // Modal ítem nuevo
  const [showAddItem, setShowAddItem] = useState(false);
  const [materiales, setMateriales]   = useState([]);
  const [newItem, setNewItem]         = useState({ material_id: "", cantidad_pedida: 1, precio_unitario: 0 });

  // Modal recepción
  const [showRecibir, setShowRecibir] = useState(false);
  const [recepcion, setRecepcion]     = useState([]);
  const [almacenRecep, setAlmacenRecep] = useState("");
  const [savingRecep, setSavingRecep]   = useState(false);
  const [errorRecep, setErrorRecep]     = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/compras/oc/${ocId}`);
      setOc(data);
    } catch (err) {
      console.error("Error cargando OC:", err);
      setError(err.message || "No se pudo cargar la orden de compra.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    apiFetch("/logistics/warehouses").then(setAlmacenes).catch(() => {});
    apiFetch("/logistics/materials").then(setMateriales).catch(() => {});
  }, [ocId]);

  const changeStatus = async (newStatus) => {
    if (!window.confirm(`¿Cambiar estado a "${STATUS_CONFIG[newStatus]?.label}"?`)) return;
    setActioning(true); setError("");
    try {
      const updated = await apiFetch(`/compras/oc/${ocId}/status`, { method: "PATCH", body: { status: newStatus } });
      setOc(updated);
    } catch (e) {
      setError(e.message || "Error al cambiar estado");
    } finally { setActioning(false); }
  };

  const addItem = async () => {
    if (!newItem.material_id) return;
    try {
      const updated = await apiFetch(`/compras/oc/${ocId}/items`, {
        method: "POST",
        body: {
          material_id: newItem.material_id,
          cantidad_pedida: parseFloat(newItem.cantidad_pedida),
          precio_unitario: parseFloat(newItem.precio_unitario),
        },
      });
      setOc(updated);
      setShowAddItem(false);
      setNewItem({ material_id: "", cantidad_pedida: 1, precio_unitario: 0 });
    } catch (e) { setError(e.message); }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("¿Eliminar este ítem?")) return;
    try {
      await apiFetch(`/compras/oc/${ocId}/items/${itemId}`, { method: "DELETE" });
      load();
    } catch (e) { setError(e.message); }
  };

  const openRecibir = () => {
    const pendientes = (oc?.items || []).filter(it => it.pendiente > 0);
    setRecepcion(pendientes.map(it => ({
      item_id: it.id,
      material_nombre: it.material_nombre,
      cantidad_pedida: it.cantidad_pedida,
      cantidad_recibida_prev: it.cantidad_recibida,
      pendiente: it.pendiente,
      cantidad: 0,
      almacen_id: "",
    })));
    setAlmacenRecep(oc?.almacen_destino || "");
    setErrorRecep("");
    setShowRecibir(true);
  };

  const submitRecepcion = async () => {
    const items = recepcion
      .filter(it => it.cantidad > 0)
      .map(it => ({
        item_id: it.item_id,
        cantidad_recibida: parseFloat(it.cantidad),
        almacen_id: it.almacen_id || almacenRecep || null,
      }));

    if (items.length === 0) { setErrorRecep("Ingresa al menos una cantidad recibida"); return; }
    setSavingRecep(true); setErrorRecep("");
    try {
      const updated = await apiFetch(`/compras/oc/${ocId}/recibir`, {
        method: "POST",
        body: { items, almacen_id: almacenRecep || null },
      });
      setOc(updated);
      setShowRecibir(false);
    } catch (e) {
      setErrorRecep(e.message || "Error al registrar recepción");
    } finally { setSavingRecep(false); }
  };

  if (loading) return <Layout><p style={{ padding: 40, color: "#9CA3AF" }}>Cargando...</p></Layout>;
  if (!oc)     return <Layout><p style={{ padding: 40, color: "#DC2626" }}>OC no encontrada</p></Layout>;

  const isBorrador = oc.status === "BORRADOR";
  const canRecibir = oc.status === "APROBADA" || oc.status === "EN_TRANSITO";
  const nextStatuses = TRANSITIONS[oc.status] || [];
  const totalRecibido = (oc.items || []).reduce((s, it) => s + (it.cantidad_recibida || 0) * it.precio_unitario, 0);

  return (
    <Layout>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button onClick={() => navigate("/compras/oc")} style={{ background: "none", border: "none", color: MID, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Órdenes de Compra
        </button>
        <span style={{ color: "#D1D5DB" }}>›</span>
        <span style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }}>{oc.code}</span>
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Header OC */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{oc.code}</div>
              <div style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{oc.proveedor_nombre}</div>
            </div>
            <StatusBadge status={oc.status} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              ["Almacén destino", oc.almacen_nombre || "—"],
              ["F. Solicitud", oc.fecha_solicitud ? new Date(oc.fecha_solicitud).toLocaleDateString("es-PE") : "—"],
              ["F. Entrega Est.", oc.fecha_entrega_est ? new Date(oc.fecha_entrega_est).toLocaleDateString("es-PE") : "—"],
              ["F. Recepción", oc.fecha_recepcion ? new Date(oc.fecha_recepcion).toLocaleDateString("es-PE") : "—"],
              ["Total Estimado", oc.total_estimado != null ? `S/ ${parseFloat(oc.total_estimado).toFixed(2)}` : "—"],
              ["Total Real", oc.total_real != null ? `S/ ${parseFloat(oc.total_real).toFixed(2)}` : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ background: LIGHT, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>

          {oc.notas && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A" }}>
              <span style={{ fontSize: 12, color: "#92400E" }}>📝 {oc.notas}</span>
            </div>
          )}
        </div>

        {/* Panel de acciones */}
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px", minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: PRIMARY, marginBottom: 14 }}>Acciones</div>

          {/* Flujo de estado */}
          {nextStatuses.filter(s => s !== "RECIBIDA").map(s => {
            const cfg = TRANS_LABELS[s] || { label: s, bg: "#374151", color: "white" };
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={actioning}
                style={{
                  width: "100%", padding: "10px", borderRadius: 9, border: "none",
                  background: cfg.bg, color: cfg.color,
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  marginBottom: 8, opacity: actioning ? 0.7 : 1,
                }}
              >{cfg.label}</button>
            );
          })}

          {canRecibir && (
            <button
              onClick={openRecibir}
              style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#7C3AED", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}
            >📦 Registrar Recepción</button>
          )}

          {nextStatuses.includes("CERRADA") && (
            <button
              onClick={() => changeStatus("CERRADA")}
              disabled={actioning}
              style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#374151", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}
            >🔒 Cerrar OC</button>
          )}

          {nextStatuses.includes("CANCELADA") && (
            <button
              onClick={() => changeStatus("CANCELADA")}
              disabled={actioning}
              style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >❌ Cancelar OC</button>
          )}

          {/* Timeline de estados */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase" }}>Flujo</div>
            {["BORRADOR", "ENVIADA", "APROBADA", "EN_TRANSITO", "RECIBIDA", "CERRADA"].map(s => {
              const sc = STATUS_CONFIG[s];
              const isActive = oc.status === s;
              const isPast = ["BORRADOR", "ENVIADA", "APROBADA", "EN_TRANSITO", "RECIBIDA", "CERRADA"].indexOf(s) <
                             ["BORRADOR", "ENVIADA", "APROBADA", "EN_TRANSITO", "RECIBIDA", "CERRADA"].indexOf(oc.status);
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: isActive ? sc.text : (isPast ? "#10B981" : "#E5E7EB"),
                    border: `2px solid ${isActive ? sc.text : (isPast ? "#10B981" : "#E5E7EB")}`,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, color: isActive ? sc.text : (isPast ? "#10B981" : "#9CA3AF") }}>
                    {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ítems de la OC */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: PRIMARY }}>Ítems ({oc.items?.length || 0})</span>
          {isBorrador && (
            <button
              onClick={() => setShowAddItem(true)}
              style={{ background: LIGHT, color: MID, border: "none", padding: "6px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
            >+ Agregar ítem</button>
          )}
        </div>

        {!oc.items?.length ? (
          <p style={{ padding: 30, textAlign: "center", color: "#9CA3AF" }}>Sin ítems</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: PRIMARY }}>
                {["Material", "Unidad", "Cantidad pedida", "P.U.", "Subtotal", "Recibido", "Progreso", ""].map(h => (
                  <th key={h} style={{ padding: "9px 14px", color: ACCENT, fontSize: 11, fontWeight: 700, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {oc.items.map((it, i) => (
                <tr key={it.id} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: PRIMARY }}>{it.material_nombre}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{it.material_unidad}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>{parseFloat(it.cantidad_pedida).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>S/ {parseFloat(it.precio_unitario).toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: PRIMARY }}>S/ {parseFloat(it.subtotal).toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: it.pendiente <= 0 ? "#10B981" : "#6B7280" }}>
                    {parseFloat(it.cantidad_recibida).toLocaleString()}
                    {it.pendiente <= 0 && <span style={{ marginLeft: 4 }}>✓</span>}
                  </td>
                  <td style={{ padding: "10px 14px", minWidth: 140 }}>
                    <ProgressBar pedida={it.cantidad_pedida} recibida={it.cantidad_recibida} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {isBorrador && (
                      <button
                        onClick={() => deleteItem(it.id)}
                        style={{ background: "#FEE2E2", color: "#DC2626", border: "none", padding: "3px 8px", borderRadius: 5, fontSize: 12, cursor: "pointer" }}
                      >✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: LIGHT }}>
                <td colSpan={4} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 13, color: PRIMARY }}>Total estimado:</td>
                <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 800, color: PRIMARY }}>
                  S/ {parseFloat(oc.total_estimado || 0).toFixed(2)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modal agregar ítem */}
      {showAddItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 14, width: 460, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 18px", color: PRIMARY }}>Agregar ítem a la OC</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Material</label>
              <select
                value={newItem.material_id}
                onChange={e => setNewItem(p => ({ ...p, material_id: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
              >
                <option value="">Seleccionar...</option>
                {materiales.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Cantidad</label>
                <input
                  type="number" min="0" step="0.001"
                  value={newItem.cantidad_pedida}
                  onChange={e => setNewItem(p => ({ ...p, cantidad_pedida: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Precio unitario</label>
                <input
                  type="number" min="0" step="0.01"
                  value={newItem.precio_unitario}
                  onChange={e => setNewItem(p => ({ ...p, precio_unitario: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddItem(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={addItem} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: PRIMARY, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal recepción */}
      {showRecibir && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 16, width: 620, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "#7C3AED", padding: "18px 24px", borderRadius: "16px 16px 0 0", position: "sticky", top: 0 }}>
              <h2 style={{ color: "white", margin: 0, fontSize: 16, fontWeight: 700 }}>📦 Registrar Recepción</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", margin: "4px 0 0", fontSize: 12 }}>
                La cantidad recibida generará un movimiento de entrada en el inventario
              </p>
            </div>

            <div style={{ padding: 24 }}>
              {errorRecep && (
                <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  {errorRecep}
                </div>
              )}

              {/* Almacén general */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>
                  Almacén de recepción (aplica a todos los ítems)
                </label>
                <select
                  value={almacenRecep}
                  onChange={e => setAlmacenRecep(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
                >
                  <option value="">Seleccionar almacén...</option>
                  {almacenes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              {/* Ítems pendientes */}
              {recepcion.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9CA3AF", padding: 20 }}>
                  Todos los ítems ya fueron recibidos completamente.
                </p>
              ) : (
                <div>
                  {recepcion.map((item, i) => (
                    <div key={item.item_id} style={{
                      border: "1px solid #E5E7EB", borderRadius: 10,
                      padding: "14px 16px", marginBottom: 10,
                      background: item.cantidad > 0 ? "#F5F3FF" : "white",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: PRIMARY }}>{item.material_nombre}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                            Pedido: {item.cantidad_pedida} · Ya recibido: {item.cantidad_recibida_prev} · Pendiente: {item.pendiente}
                          </div>
                        </div>
                        <ProgressBar pedida={item.cantidad_pedida} recibida={item.cantidad_recibida_prev} />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>
                            Cantidad a recibir ahora
                          </label>
                          <input
                            type="number" min="0" max={item.pendiente} step="0.001"
                            value={item.cantidad}
                            onChange={e => setRecepcion(prev => prev.map((it, idx) => idx === i ? { ...it, cantidad: e.target.value } : it))}
                            style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `2px solid ${item.cantidad > 0 ? "#7C3AED" : "#E5E7EB"}`, fontSize: 13, boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>
                            Almacén específico (opcional)
                          </label>
                          <select
                            value={item.almacen_id}
                            onChange={e => setRecepcion(prev => prev.map((it, idx) => idx === i ? { ...it, almacen_id: e.target.value } : it))}
                            style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12 }}
                          >
                            <option value="">Usar almacén general</option>
                            {almacenes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setShowRecibir(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={submitRecepcion} disabled={savingRecep}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#7C3AED", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: savingRecep ? 0.7 : 1 }}
                >
                  {savingRecep ? "Procesando..." : "Confirmar Recepción"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
