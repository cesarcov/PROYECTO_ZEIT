import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch } from "../../services/api";

const inputStyle = {
  width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
  padding: "9px 12px", fontSize: 13, color: "#111827",
  background: "#FAFAFA", outline: "none", boxSizing: "border-box",
};

function WarehouseFormModal({ title, subtitle, initial, onClose, onSuccess }) {
  const [form, setForm] = useState(initial || { name: "", code: "", location: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError("Nombre y código son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (initial?.id) {
        await apiFetch(`/logistics/warehouses/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name.trim(), code: form.code.trim().toUpperCase(), location: form.location.trim() || null }),
        });
      } else {
        await apiFetch("/logistics/warehouses", {
          method: "POST",
          body: JSON.stringify({ name: form.name.trim(), code: form.code.trim().toUpperCase(), location: form.location.trim() || null }),
        });
      }
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al guardar almacén");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} maxWidth={440}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Nombre *
          </label>
          <input
            autoFocus type="text" placeholder="Ej: Almacén Norte"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Código *
          </label>
          <input
            type="text" placeholder="Ej: WH-NORTE"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            style={{ ...inputStyle, fontFamily: "monospace" }}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Ubicación
          </label>
          <input
            type="text" placeholder="Ej: Av. Industrial 456, Piso 2"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Cancelar
          </button>
          <button
            onClick={submit} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "var(--primary)", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear almacén"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteWarehouseModal({ warehouse, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    try {
      await apiFetch(`/logistics/warehouses/${warehouse.id}`, { method: "DELETE" });
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Eliminar almacén" subtitle="Esta acción no se puede deshacer" onClose={onClose} maxWidth={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 14, color: "#374151" }}>
          ¿Eliminar el almacén <strong>{warehouse.name}</strong> ({warehouse.code})?
        </p>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Cancelar
          </button>
          <button
            onClick={confirm} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function WarehousesView() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "new" | { wh, mode: "edit"|"delete" }

  const load = useCallback(async () => {
    setLoading(true);
    const [whRes, stockRes] = await Promise.allSettled([
      apiFetch("/logistics/warehouses"),
      apiFetch("/logistics/stock/availability"),
    ]);
    if (whRes.status === "fulfilled") setWarehouses(whRes.value);
    if (stockRes.status === "fulfilled") setStockData(stockRes.value);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stockByWarehouse = stockData.reduce((acc, row) => {
    const wid = row.warehouse_id;
    if (!acc[wid]) acc[wid] = { materials: 0, total_units: 0, low_stock: 0 };
    acc[wid].materials += 1;
    acc[wid].total_units += row.stock_available;
    if (row.stock_available <= (row.min_stock || 0) && row.stock_available > 0)
      acc[wid].low_stock += 1;
    return acc;
  }, {});

  const closeModal = () => setModal(null);
  const afterSuccess = () => { closeModal(); load(); };

  return (
    <Layout>
      {modal === "new" && (
        <WarehouseFormModal
          title="Nuevo Almacén"
          subtitle="Registrar almacén en el sistema"
          onClose={closeModal}
          onSuccess={afterSuccess}
        />
      )}
      {modal?.mode === "edit" && (
        <WarehouseFormModal
          title="Editar Almacén"
          subtitle={`Modificar datos de ${modal.wh.name}`}
          initial={modal.wh}
          onClose={closeModal}
          onSuccess={afterSuccess}
        />
      )}
      {modal?.mode === "delete" && (
        <DeleteWarehouseModal
          warehouse={modal.wh}
          onClose={closeModal}
          onSuccess={afterSuccess}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Almacenes
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              {warehouses.length} almacenes registrados
            </p>
          </div>
          <button
            onClick={() => setModal("new")}
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "var(--primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer" }}
          >
            + Nuevo almacén
          </button>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 16, padding: 20, minHeight: 160 }} />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Sin almacenes registrados.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {warehouses.map((wh) => {
              const stats = stockByWarehouse[wh.id] || { materials: 0, total_units: 0, low_stock: 0 };
              return (
                <div
                  key={wh.id}
                  style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}
                >
                  {/* Card header — clicable para ver inventario */}
                  <div
                    onClick={() => navigate(`/logistics/warehouses/${wh.id}`)}
                    style={{ background: "var(--primary)", padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--primary-dark)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--primary)"}
                  >
                    <div>
                      <p style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0 }}>{wh.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, background: "rgba(199,210,229,0.2)", color: "rgba(199,210,229,0.9)", padding: "2px 8px", borderRadius: 99 }}>
                          {wh.code}
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(199,210,229,0.6)", display: "flex", alignItems: "center", gap: 3 }}>
                          Ver inventario →
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>🏭</span>
                  </div>

                  {/* Body */}
                  <div style={{ padding: "14px 20px", flex: 1 }}>
                    {wh.location ? (
                      <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>📍</span> {wh.location}
                      </p>
                    ) : (
                      <p style={{ fontSize: 12, color: "#D1D5DB", marginBottom: 14, fontStyle: "italic" }}>Sin ubicación registrada</p>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {[
                        { label: "Materiales", value: stats.materials, color: "#374151" },
                        { label: "Unidades", value: stats.total_units.toLocaleString(), color: "var(--primary)" },
                        { label: "Stock bajo", value: stats.low_stock, color: stats.low_stock > 0 ? "#D97706" : "#16A34A" },
                      ].map((s) => (
                        <div key={s.label} style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                          <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                          <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div style={{ borderTop: "1px solid #F3F4F6", padding: "10px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={() => navigate(`/logistics/warehouses/${wh.id}`)}
                      style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, background: "var(--primary)", color: "white", border: "none", borderRadius: 7, cursor: "pointer", flex: 1 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-dark)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--primary)"}
                    >
                      📋 Ver inventario completo
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModal({ wh, mode: "edit" }); }}
                      style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 7, cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#E5E7EB"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#F3F4F6"}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModal({ wh, mode: "delete" }); }}
                      style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 7, cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#FEE2E2"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#FEF2F2"}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
