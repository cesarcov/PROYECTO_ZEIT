import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import ExportExcelButton from "../../components/ExportExcelButton";

const PRIMARY = "#0B2E33";
const ACCENT  = "#B8E3E9";
const MID     = "#4F7C82";
const LIGHT   = "#EEF7F8";

const STATUS_CONFIG = {
  BORRADOR:    { bg: "#F3F4F6", text: "#374151", label: "Borrador" },
  ENVIADA:     { bg: "#DBEAFE", text: "#1E40AF", label: "Enviada" },
  APROBADA:    { bg: "#D1FAE5", text: "#065F46", label: "Aprobada" },
  EN_TRANSITO: { bg: "#FEF3C7", text: "#92400E", label: "En Tránsito" },
  RECIBIDA:    { bg: "#E0E7FF", text: "#3730A3", label: "Recibida" },
  CERRADA:     { bg: "#F0FDF4", text: "#14532D", label: "Cerrada" },
  CANCELADA:   { bg: "#FEE2E2", text: "#991B1B", label: "Cancelada" },
};

const STATUSES = Object.keys(STATUS_CONFIG);

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || { bg: "#F3F4F6", text: "#374151", label: status };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
      {c.label}
    </span>
  );
}

export default function OrdenesCompraView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const misFiltro = searchParams.get("mis") === "true";

  const [ocs, setOcs]                 = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [almacenes, setAlmacenes]     = useState([]);
  const [materiales, setMateriales]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatus]     = useState("");
  const [provFilter, setProvFilter]   = useState("");
  const [search, setSearch]           = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const [form, setForm] = useState({
    proveedor_id: "", plan_id: "", almacen_destino: "",
    fecha_entrega_est: "", notas: "",
  });
  const [items, setItems] = useState([
    { material_id: "", cantidad_pedida: 1, precio_unitario: 0, notas: "" }
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (provFilter)   params.append("proveedor_id", provFilter);
      if (misFiltro)    params.append("mis", "true");
      const data = await apiFetch(`/compras/oc?${params}`);
      setOcs(data);
    } catch (err) {
      console.error("Error cargando OCs:", err);
      setError("No se pudieron cargar las órdenes de compra. Verifica tu conexión.");
    } finally { setLoading(false); }
  };

  const loadCatalogs = async () => {
    try {
      const [provs, warehouses, mats] = await Promise.all([
        apiFetch("/compras/proveedores?activo=true"),
        apiFetch("/logistics/warehouses"),
        apiFetch("/logistics/materials"),
      ]);
      setProveedores(provs);
      setAlmacenes(warehouses);
      setMateriales(mats);
    } catch (err) {
      console.error("Error cargando catálogos:", err);
    }
  };

  useEffect(() => { load(); }, [statusFilter, provFilter, misFiltro]);
  useEffect(() => { loadCatalogs(); }, []);

  const addItem = () => setItems(prev => [...prev, { material_id: "", cantidad_pedida: 1, precio_unitario: 0, notas: "" }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const totalEstimado = items.reduce((s, it) => s + (parseFloat(it.cantidad_pedida) || 0) * (parseFloat(it.precio_unitario) || 0), 0);

  const openNew = () => {
    setForm({ proveedor_id: "", plan_id: "", almacen_destino: "", fecha_entrega_est: "", notas: "" });
    setItems([{ material_id: "", cantidad_pedida: 1, precio_unitario: 0, notas: "" }]);
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    if (!form.proveedor_id) { setError("Selecciona un proveedor"); return; }
    const validItems = items.filter(it => it.material_id && it.cantidad_pedida > 0);
    if (validItems.length === 0) { setError("Agrega al menos un ítem válido"); return; }

    setSaving(true); setError("");
    try {
      const oc = await apiFetch("/compras/oc", {
        method: "POST",
        body: {
          ...form,
          plan_id: form.plan_id || null,
          almacen_destino: form.almacen_destino || null,
          fecha_entrega_est: form.fecha_entrega_est || null,
          items: validItems.map(it => ({
            material_id: it.material_id,
            cantidad_pedida: parseFloat(it.cantidad_pedida),
            precio_unitario: parseFloat(it.precio_unitario),
            notas: it.notas || null,
          })),
        },
      });
      setShowModal(false);
      navigate(`/compras/oc/${oc.id}`);
    } catch (e) {
      setError(e.message || "Error al crear OC");
    } finally { setSaving(false); }
  };

  const filteredOcs = ocs.filter(oc => {
    const q = search.toLowerCase();
    return !q || oc.code.toLowerCase().includes(q) || oc.proveedor_nombre.toLowerCase().includes(q);
  });

  // Estadísticas rápidas
  const stats = STATUSES.reduce((acc, s) => {
    acc[s] = ocs.filter(o => o.status === s).length;
    return acc;
  }, {});

  return (
    <Layout>
      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>
            {misFiltro ? "Mis Órdenes de Compra" : "Órdenes de Compra"}
          </h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
            Flujo BORRADOR → ENVIADA → APROBADA → EN_TRÁNSITO → RECIBIDA → CERRADA
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ExportExcelButton url="/compras/oc/export" filename="ordenes_compra.xlsx" />
          <button onClick={openNew} style={{
            background: PRIMARY, color: "white", border: "none",
            padding: "9px 18px", borderRadius: 9, fontWeight: 700,
            fontSize: 13, cursor: "pointer",
          }}>+ Nueva OC</button>
        </div>
      </div>

      {/* KPIs de estado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 20 }}>
        {STATUSES.map(s => {
          const c = STATUS_CONFIG[s];
          return (
            <div
              key={s}
              onClick={() => setStatus(statusFilter === s ? "" : s)}
              style={{
                padding: "10px 12px", borderRadius: 10, textAlign: "center",
                background: statusFilter === s ? c.bg : "white",
                border: `2px solid ${statusFilter === s ? c.text : "#E5E7EB"}`,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: c.text }}>{stats[s] || 0}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: c.text }}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código o proveedor..."
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none" }}
        />
        <select
          value={provFilter} onChange={e => setProvFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Lista de OCs */}
      {loading ? (
        <p style={{ color: "#9CA3AF", textAlign: "center", padding: 40 }}>Cargando órdenes de compra...</p>
      ) : filteredOcs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
          <p style={{ fontWeight: 600 }}>No hay órdenes de compra</p>
          <p style={{ fontSize: 12 }}>Crea la primera con el botón de arriba</p>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: PRIMARY }}>
                {["Código", "Proveedor", "Estado", "Almacén", "F. Solicitud", "F. Entrega Est.", "Total Est.", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", color: ACCENT, fontSize: 11, fontWeight: 700, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOcs.map((oc, i) => (
                <tr
                  key={oc.id}
                  style={{ background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}
                  onClick={() => navigate(`/compras/oc/${oc.id}`)}
                >
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 700, color: MID }}>{oc.code}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: PRIMARY }}>{oc.proveedor_nombre}</td>
                  <td style={{ padding: "11px 14px" }}><StatusBadge status={oc.status} /></td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#6B7280" }}>{oc.almacen_nombre || "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#6B7280" }}>
                    {oc.fecha_solicitud ? new Date(oc.fecha_solicitud).toLocaleDateString("es-PE") : "—"}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#6B7280" }}>
                    {oc.fecha_entrega_est ? new Date(oc.fecha_entrega_est).toLocaleDateString("es-PE") : "—"}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                    {oc.total_estimado != null ? `S/ ${parseFloat(oc.total_estimado).toFixed(2)}` : "—"}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/compras/oc/${oc.id}`); }}
                      style={{ background: LIGHT, color: MID, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                    >Ver →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva OC */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{
            background: "white", borderRadius: 16, width: 680,
            maxHeight: "92vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ background: PRIMARY, padding: "18px 24px", borderRadius: "16px 16px 0 0", position: "sticky", top: 0, zIndex: 2 }}>
              <h2 style={{ color: "white", margin: 0, fontSize: 16, fontWeight: 700 }}>Nueva Orden de Compra</h2>
            </div>

            <div style={{ padding: 24 }}>
              {error && (
                <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  {error}
                </div>
              )}

              {/* Datos generales */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Proveedor *</label>
                  <select
                    value={form.proveedor_id}
                    onChange={e => setForm(p => ({ ...p, proveedor_id: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Almacén destino</label>
                  <select
                    value={form.almacen_destino}
                    onChange={e => setForm(p => ({ ...p, almacen_destino: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
                  >
                    <option value="">Seleccionar almacén...</option>
                    {almacenes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Fecha entrega estimada</label>
                  <input
                    type="date"
                    value={form.fecha_entrega_est}
                    onChange={e => setForm(p => ({ ...p, fecha_entrega_est: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Notas</label>
                  <input
                    value={form.notas}
                    onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Observaciones generales..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Ítems */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: PRIMARY }}>Ítems de la OC</span>
                  <button onClick={addItem} style={{ background: LIGHT, color: MID, border: "none", padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    + Agregar ítem
                  </button>
                </div>

                {items.map((item, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                    <div>
                      {i === 0 && <label style={{ display: "block", fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Material</label>}
                      <select
                        value={item.material_id}
                        onChange={e => updateItem(i, "material_id", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12 }}
                      >
                        <option value="">Seleccionar...</option>
                        {materiales.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      {i === 0 && <label style={{ display: "block", fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Cantidad</label>}
                      <input
                        type="number" min="0" step="0.001"
                        value={item.cantidad_pedida}
                        onChange={e => updateItem(i, "cantidad_pedida", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      {i === 0 && <label style={{ display: "block", fontSize: 11, color: "#6B7280", marginBottom: 3 }}>Precio unit.</label>}
                      <input
                        type="number" min="0" step="0.01"
                        value={item.precio_unitario}
                        onChange={e => updateItem(i, "precio_unitario", e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                    <button
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      style={{ padding: "7px 10px", borderRadius: 7, border: "none", background: "#FEE2E2", color: "#DC2626", cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: items.length === 1 ? 0.4 : 1 }}
                    >×</button>
                  </div>
                ))}

                <div style={{ textAlign: "right", marginTop: 10, padding: "10px 14px", background: LIGHT, borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>Total estimado: </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: PRIMARY }}>S/ {totalEstimado.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={save} disabled={saving}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: PRIMARY, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Creando OC..." : "Crear OC"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
