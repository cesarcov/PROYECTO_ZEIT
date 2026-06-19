import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import ExportExcelButton from "../../components/ExportExcelButton";

const PRIMARY = "#0B2E33";
const ACCENT  = "#B8E3E9";
const MID     = "#4F7C82";
const LIGHT   = "#EEF7F8";

const TIPOS = ["PROVEEDOR", "SUBCONTRATISTA"];

function Badge({ label, color }) {
  const colors = {
    PROVEEDOR:       { bg: "#DCFCE7", text: "#166534" },
    SUBCONTRATISTA:  { bg: "#FEF3C7", text: "#92400E" },
    activo:          { bg: "#D1FAE5", text: "#065F46" },
    inactivo:        { bg: "#FEE2E2", text: "#991B1B" },
  };
  const c = colors[label] || { bg: "#F3F4F6", text: "#374151" };
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      borderRadius: 99,
    }}>{label}</span>
  );
}

export default function ProveedoresView() {
  const [proveedores, setProveedores]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [tipoFilter, setTipoFilter]     = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [selected, setSelected]         = useState(null);
  const [materiales, setMateriales]     = useState([]);
  const [loadingMat, setLoadingMat]     = useState(false);
  const [form, setForm]                 = useState({
    nombre: "", ruc: "", telefono: "", email: "",
    contacto: "", direccion: "", tipo: "PROVEEDOR",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/compras/proveedores");
      setProveedores(data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nombre: "", ruc: "", telefono: "", email: "", contacto: "", direccion: "", tipo: "PROVEEDOR" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      nombre: p.nombre, ruc: p.ruc || "", telefono: p.telefono || "",
      email: p.email || "", contacto: p.contacto || "",
      direccion: p.direccion || "", tipo: p.tipo,
    });
    setError("");
    setShowModal(true);
  };

  const selectProveedor = async (p) => {
    setSelected(p);
    setLoadingMat(true);
    try {
      const data = await apiFetch(`/compras/proveedores/${p.id}/materiales`);
      setMateriales(data);
    } catch { setMateriales([]); } finally { setLoadingMat(false); }
  };

  const save = async () => {
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true); setError("");
    try {
      if (editing) {
        await apiFetch(`/compras/proveedores/${editing.id}`, { method: "PATCH", body: form });
      } else {
        await apiFetch("/compras/proveedores", { method: "POST", body: form });
      }
      setShowModal(false);
      load();
    } catch (e) {
      setError(e.message || "Error al guardar");
    } finally { setSaving(false); }
  };

  const toggleActivo = async (p) => {
    try {
      await apiFetch(`/compras/proveedores/${p.id}`, { method: "PATCH", body: { activo: !p.activo } });
      load();
      if (selected?.id === p.id) setSelected(s => ({ ...s, activo: !s.activo }));
    } catch { }
  };

  const filtered = proveedores.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.nombre.toLowerCase().includes(q) || (p.ruc || "").includes(q) || p.codigo.toLowerCase().includes(q);
    const matchT = !tipoFilter || p.tipo === tipoFilter;
    return matchQ && matchT;
  });

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Proveedores</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
            Gestión de proveedores y catálogo de precios
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ExportExcelButton url="/compras/proveedores/export" filename="proveedores.xlsx" />
          <button onClick={openNew} style={{
            background: PRIMARY, color: "white", border: "none",
            padding: "9px 18px", borderRadius: 9, fontWeight: 700,
            fontSize: 13, cursor: "pointer",
          }}>+ Nuevo Proveedor</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 20 }}>
        {/* Panel izquierdo: lista */}
        <div>
          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, RUC o código..."
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: "1px solid #E5E7EB", fontSize: 13,
                outline: "none",
              }}
            />
            <select
              value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
            >
              <option value="">Todos los tipos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Tabla */}
          {loading ? (
            <p style={{ color: "#9CA3AF", textAlign: "center", padding: 40 }}>Cargando proveedores...</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏭</div>
              <p style={{ fontWeight: 600 }}>No hay proveedores</p>
              <p style={{ fontSize: 12 }}>Crea el primero con el botón de arriba</p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: PRIMARY }}>
                    {["Código", "Nombre", "RUC", "Tipo", "Contacto", "Estado", "Acciones"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", color: ACCENT, fontSize: 11, fontWeight: 700, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{
                        background: selected?.id === p.id ? LIGHT : (i % 2 === 0 ? "white" : "#FAFAFA"),
                        cursor: "pointer",
                        borderBottom: "1px solid #F3F4F6",
                      }}
                      onClick={() => selectProveedor(p)}
                    >
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: MID }}>{p.codigo}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: PRIMARY }}>{p.nombre}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{p.ruc || "—"}</td>
                      <td style={{ padding: "10px 14px" }}><Badge label={p.tipo} /></td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{p.contacto || "—"}</td>
                      <td style={{ padding: "10px 14px" }}><Badge label={p.activo ? "activo" : "inactivo"} /></td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(p); }}
                            style={{ background: "#EFF6FF", color: "#1D4ED8", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                          >Editar</button>
                          <button
                            onClick={e => { e.stopPropagation(); toggleActivo(p); }}
                            style={{ background: p.activo ? "#FEF2F2" : "#F0FDF4", color: p.activo ? "#DC2626" : "#16A34A", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                          >{p.activo ? "Desactivar" : "Activar"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel derecho: materiales del proveedor */}
        {selected && (
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", height: "fit-content" }}>
            <div style={{ background: PRIMARY, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{selected.nombre}</div>
                <div style={{ color: ACCENT, fontSize: 11 }}>{selected.codigo} · {selected.tipo}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: ACCENT, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>

            {/* Datos del proveedor */}
            <div style={{ padding: "14px 18px", background: LIGHT, borderBottom: "1px solid #E5E7EB" }}>
              {[
                ["RUC", selected.ruc || "—"],
                ["Email", selected.email || "—"],
                ["Teléfono", selected.telefono || "—"],
                ["Contacto", selected.contacto || "—"],
                ["Dirección", selected.direccion || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, minWidth: 70 }}>{k}</span>
                  <span style={{ fontSize: 12, color: "#374151" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Catálogo de materiales */}
            <div style={{ padding: "14px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: PRIMARY, marginBottom: 10 }}>
                Catálogo de materiales ({materiales.length})
              </div>
              {loadingMat ? (
                <p style={{ color: "#9CA3AF", fontSize: 12 }}>Cargando...</p>
              ) : materiales.length === 0 ? (
                <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                  Sin materiales vinculados
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {materiales.map(m => (
                    <div key={m.id} style={{
                      border: "1px solid #E5E7EB", borderRadius: 8,
                      padding: "8px 12px", background: "white",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{m.material_nombre}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.material_unidad}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: MID }}>
                            {m.moneda} {parseFloat(m.precio_unitario).toFixed(2)}
                          </div>
                          <div style={{ fontSize: 10, color: "#9CA3AF" }}>{m.tiempo_entrega_dias}d entrega</div>
                        </div>
                      </div>
                      {m.es_principal && (
                        <span style={{ fontSize: 10, background: "#D1FAE5", color: "#065F46", padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Principal</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo/editar proveedor */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{
            background: "white", borderRadius: 16, width: 500,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ background: PRIMARY, padding: "18px 24px", borderRadius: "16px 16px 0 0" }}>
              <h2 style={{ color: "white", margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editing ? "Editar Proveedor" : "Nuevo Proveedor"}
              </h2>
            </div>

            <div style={{ padding: 24 }}>
              {error && (
                <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  {error}
                </div>
              )}

              {[
                { label: "Nombre *", key: "nombre", type: "text" },
                { label: "RUC", key: "ruc", type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "Teléfono", key: "telefono", type: "text" },
                { label: "Contacto", key: "contacto", type: "text" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Dirección</label>
                <textarea
                  value={form.direccion}
                  onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))}
                  rows={2}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 4 }}>Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
                >
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={save} disabled={saving}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: PRIMARY, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
