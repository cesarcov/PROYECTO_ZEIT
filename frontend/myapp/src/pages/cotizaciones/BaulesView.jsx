import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY = "#0B2E33";
const ACCENT  = "#4F7C82";
const LIGHT   = "#EEF7F8";

const TIPOS       = ["MATERIAL", "MANO_OBRA", "EQUIPO"];
const TIPO_LABELS = { MATERIAL: "Material", MANO_OBRA: "Mano de Obra", EQUIPO: "Equipo" };
const TIPO_BG     = { MATERIAL: "#E0F2FE", MANO_OBRA: "#D1FAE5", EQUIPO: "#FEF3C7" };
const TIPO_COLORS = { MATERIAL: "#0369A1", MANO_OBRA: "#065F46", EQUIPO: "#92400E" };

const CATEGORIAS = ["general", "herramientas", "materiales eléctricos", "mano de obra", "equipos", "seguridad", "consumibles"];

const emptyBaulForm = () => ({ nombre: "", descripcion: "", categoria: "general" });
const emptyItemForm = () => ({ tipo_recurso: "MATERIAL", material_id: "", recurso_mo_id: "", descripcion: "", unidad: "UND", cantidad_base: "1", precio_unitario: "0", orden: "0" });

export default function BaulesView() {
  const [baules, setBaules]         = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [recursosMO, setRecursosMO] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeBaul, setActiveBaul] = useState(null);

  const [showBaulModal, setShowBaulModal] = useState(false);
  const [editingBaul, setEditingBaul]     = useState(null);
  const [baulForm, setBaulForm]           = useState(emptyBaulForm());

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem]     = useState(null);
  const [itemForm, setItemForm]           = useState(emptyItemForm());
  const [itemBaulId, setItemBaulId]       = useState(null);

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [baulesData, matsData, moData] = await Promise.all([
        apiFetch("/cotizaciones/baules"),
        apiFetch("/logistics/materials"),
        apiFetch("/cotizaciones/recursos-mo"),
      ]);
      setBaules(baulesData);
      setMateriales(matsData);
      setRecursosMO(moData.filter(m => m.activo));
    } catch (e) {
      console.error("Error cargando baúles:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── Baúl CRUD ────────────────────────────────────────────────────────────────

  function openNewBaul() {
    setEditingBaul(null);
    setBaulForm(emptyBaulForm());
    setError(""); setShowBaulModal(true);
  }

  function openEditBaul(b) {
    setEditingBaul(b);
    setBaulForm({ nombre: b.nombre, descripcion: b.descripcion || "", categoria: b.categoria });
    setError(""); setShowBaulModal(true);
  }

  async function saveBaul() {
    if (!baulForm.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      if (editingBaul) {
        const updated = await apiFetch(`/cotizaciones/baules/${editingBaul.id}`, { method: "PATCH", body: JSON.stringify(baulForm) });
        setBaules(bs => bs.map(b => b.id === editingBaul.id ? { ...updated, items: b.items } : b));
      } else {
        const created = await apiFetch("/cotizaciones/baules", { method: "POST", body: JSON.stringify(baulForm) });
        setBaules(bs => [...bs, created]);
      }
      setShowBaulModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteBaul(b) {
    if (!window.confirm(`¿Desactivar el baúl "${b.nombre}"?`)) return;
    try {
      await apiFetch(`/cotizaciones/baules/${b.id}`, { method: "DELETE" });
      setBaules(bs => bs.filter(x => x.id !== b.id));
      if (activeBaul === b.id) setActiveBaul(null);
    } catch (e) { alert(e.message); }
  }

  // ── Ítem CRUD ────────────────────────────────────────────────────────────────

  function openNewItem(baulId) {
    setEditingItem(null);
    setItemBaulId(baulId);
    setItemForm(emptyItemForm());
    setError(""); setShowItemModal(true);
  }

  function openEditItem(item, baulId) {
    setEditingItem(item);
    setItemBaulId(baulId);
    setItemForm({
      tipo_recurso: item.tipo_recurso,
      material_id: item.material_id || "",
      recurso_mo_id: item.recurso_mo_id || "",
      descripcion: item.descripcion,
      unidad: item.unidad,
      cantidad_base: String(item.cantidad_base),
      precio_unitario: String(item.precio_unitario),
      orden: String(item.orden),
    });
    setError(""); setShowItemModal(true);
  }

  function onItemMaterialSelect(matId) {
    const mat = materiales.find(m => m.id === matId);
    setItemForm(f => ({
      ...f, material_id: matId,
      precio_unitario: mat?.unit_cost ? String(mat.unit_cost) : f.precio_unitario,
      unidad: mat?.unit ?? f.unidad,
    }));
  }

  function onItemMOSelect(moId) {
    const mo = recursosMO.find(m => m.id === moId);
    setItemForm(f => ({
      ...f, recurso_mo_id: moId,
      precio_unitario: mo ? String(mo.tarifa_hora) : f.precio_unitario,
      unidad: mo?.unidad ?? f.unidad,
    }));
  }

  async function saveItem() {
    if (!itemForm.descripcion.trim()) { setError("Agrega una descripción."); return; }
    if (!parseFloat(itemForm.cantidad_base) > 0) { setError("La cantidad base debe ser mayor a 0."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        tipo_recurso: itemForm.tipo_recurso,
        material_id: itemForm.tipo_recurso !== "MANO_OBRA" && itemForm.material_id ? itemForm.material_id : null,
        recurso_mo_id: itemForm.tipo_recurso === "MANO_OBRA" && itemForm.recurso_mo_id ? itemForm.recurso_mo_id : null,
        descripcion: itemForm.descripcion,
        unidad: itemForm.unidad,
        cantidad_base: parseFloat(itemForm.cantidad_base) || 1,
        precio_unitario: parseFloat(itemForm.precio_unitario) || 0,
        orden: parseInt(itemForm.orden) || 0,
      };

      if (editingItem) {
        const updated = await apiFetch(`/cotizaciones/baules/${itemBaulId}/items/${editingItem.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setBaules(bs => bs.map(b => b.id === itemBaulId
          ? { ...b, items: b.items.map(i => i.id === editingItem.id ? { ...updated, material_nombre: i.material_nombre, recurso_mo_codigo: i.recurso_mo_codigo } : i) }
          : b
        ));
      } else {
        const created = await apiFetch(`/cotizaciones/baules/${itemBaulId}/items`, { method: "POST", body: JSON.stringify(payload) });
        setBaules(bs => bs.map(b => b.id === itemBaulId ? { ...b, items: [...(b.items || []), created] } : b));
      }
      setShowItemModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteItem(baulId, itemId) {
    if (!window.confirm("¿Eliminar este ítem del baúl?")) return;
    try {
      await apiFetch(`/cotizaciones/baules/${baulId}/items/${itemId}`, { method: "DELETE" });
      setBaules(bs => bs.map(b => b.id === baulId ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b));
    } catch (e) { alert(e.message); }
  }

  if (loading) return <Layout><div style={{ padding: 60, textAlign: "center", color: "#9CA3AF" }}>Cargando baúles...</div></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Baúles APU</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
            Kits preconfigurados de recursos — insértalos en cualquier APU con un multiplicador
          </p>
        </div>
        <button
          onClick={openNewBaul}
          style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 9, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + Nuevo Baúl
        </button>
      </div>

      {baules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF", border: "2px dashed #E5E7EB", borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧰</div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>Sin baúles aún</p>
          <p style={{ fontSize: 13 }}>Crea tu primer baúl con ítems preconfigurados (ej: "Maleta Electricista", "Kit EPP")</p>
          <button onClick={openNewBaul} style={{ marginTop: 16, background: PRIMARY, color: "white", border: "none", borderRadius: 9, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Crear primer baúl
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {baules.map(baul => {
            const isOpen = activeBaul === baul.id;
            const items  = baul.items || [];
            const totalBase = items.reduce((s, i) => s + i.cantidad_base * i.precio_unitario, 0);

            return (
              <div key={baul.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                {/* Baúl header */}
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: isOpen ? LIGHT : "white", cursor: "pointer" }}
                  onClick={() => setActiveBaul(isOpen ? null : baul.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>🧰</span>
                    <div>
                      <div style={{ fontWeight: 800, color: PRIMARY, fontSize: 15 }}>{baul.nombre}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {baul.categoria} · {items.length} ítem{items.length !== 1 ? "s" : ""} · valor base S/ {totalBase.toFixed(2)}
                      </div>
                      {baul.descripcion && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{baul.descripcion}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditBaul(baul)} style={{ background: LIGHT, color: ACCENT, border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Editar</button>
                    <button onClick={() => deleteBaul(baul)} style={{ background: "#FEE2E2", color: "#991B1B", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
                    <span style={{ color: "#9CA3AF", fontSize: 18 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Ítems */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #E5E7EB", background: "#FAFAFA" }}>
                    <div style={{ padding: "10px 18px", display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => openNewItem(baul.id)} style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        + Agregar ítem
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                        Baúl vacío — agrega ítems para que aparezcan al insertar este baúl en un APU
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F3F4F6" }}>
                            {["Tipo", "Descripción / Recurso", "Und", "Cant. Base", "P.U. Ref.", "Subtotal Base", "Ord.", ""].map(h => (
                              <th key={h} style={{ padding: "7px 14px", textAlign: "left", color: "#374151", fontWeight: 600, fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...items].sort((a,b) => a.orden - b.orden).map(item => (
                            <tr key={item.id} style={{ borderTop: "1px solid #E5E7EB", background: "white" }}>
                              <td style={{ padding: "8px 14px" }}>
                                <span style={{ background: TIPO_BG[item.tipo_recurso], color: TIPO_COLORS[item.tipo_recurso], borderRadius: 4, padding: "2px 7px", fontWeight: 700, fontSize: 10 }}>
                                  {TIPO_LABELS[item.tipo_recurso]}
                                </span>
                              </td>
                              <td style={{ padding: "8px 14px", color: "#1F2937" }}>
                                {item.material_nombre || item.recurso_mo_codigo || item.descripcion}
                                {(item.material_nombre || item.recurso_mo_codigo) && item.descripcion && (
                                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{item.descripcion}</div>
                                )}
                              </td>
                              <td style={{ padding: "8px 14px", color: "#6B7280" }}>{item.unidad}</td>
                              <td style={{ padding: "8px 14px", fontWeight: 600 }}>{parseFloat(item.cantidad_base).toFixed(3)}</td>
                              <td style={{ padding: "8px 14px" }}>S/ {parseFloat(item.precio_unitario).toFixed(2)}</td>
                              <td style={{ padding: "8px 14px", fontWeight: 700, color: "#059669" }}>
                                S/ {(item.cantidad_base * item.precio_unitario).toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 14px", color: "#9CA3AF" }}>{item.orden}</td>
                              <td style={{ padding: "8px 10px" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => openEditItem(item, baul.id)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13 }}>✏</button>
                                  <button onClick={() => deleteItem(baul.id, item.id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 13 }}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Baúl ───────────────────────────────────────────────────────── */}
      {showBaulModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "white", borderRadius: 14, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: PRIMARY, margin: "0 0 20px" }}>
              {editingBaul ? "Editar Baúl" : "Nuevo Baúl"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Nombre *</label>
                <input value={baulForm.nombre} onChange={e => setBaulForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Maleta Electricista, Kit EPP Básico..."
                  style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Categoría</label>
                <select value={baulForm.categoria} onChange={e => setBaulForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Descripción</label>
                <textarea value={baulForm.descripcion} onChange={e => setBaulForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2} placeholder="Descripción opcional del baúl..."
                  style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: 12, marginTop: 10 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowBaulModal(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveBaul} disabled={saving} style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ítem de Baúl ────────────────────────────────────────────────── */}
      {showItemModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "white", borderRadius: 14, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: PRIMARY, margin: "0 0 20px" }}>
              {editingItem ? "Editar Ítem" : "Nuevo Ítem del Baúl"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Tipo */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tipo de Recurso</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {TIPOS.map(t => (
                    <button key={t} onClick={() => setItemForm(f => ({ ...f, tipo_recurso: t, material_id: "", recurso_mo_id: "" }))}
                      style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `2px solid ${itemForm.tipo_recurso === t ? TIPO_COLORS[t] : "#E5E7EB"}`, background: itemForm.tipo_recurso === t ? TIPO_BG[t] : "white", color: itemForm.tipo_recurso === t ? TIPO_COLORS[t] : "#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurso del catálogo */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                  {itemForm.tipo_recurso === "MANO_OBRA" ? "Recurso de Mano de Obra" : "Material del catálogo (opcional)"}
                </label>
                {itemForm.tipo_recurso === "MANO_OBRA" ? (
                  <select value={itemForm.recurso_mo_id} onChange={e => onItemMOSelect(e.target.value)}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                    <option value="">— Seleccionar MO —</option>
                    {recursosMO.map(m => <option key={m.id} value={m.id}>{m.codigo} — {m.descripcion} (S/ {m.tarifa_hora}/{m.unidad})</option>)}
                  </select>
                ) : (
                  <select value={itemForm.material_id} onChange={e => onItemMaterialSelect(e.target.value)}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                    <option value="">— Del catálogo (opcional) —</option>
                    {materiales.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit ?? ""})</option>)}
                  </select>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Descripción *</label>
                <input value={itemForm.descripcion} onChange={e => setItemForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Nombre del recurso en el baúl..."
                  style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Unidad</label>
                  <input value={itemForm.unidad} onChange={e => setItemForm(f => ({ ...f, unidad: e.target.value }))}
                    placeholder="UND, HH, M..." style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Cantidad base</label>
                  <input type="number" min="0.001" step="0.001" value={itemForm.cantidad_base}
                    onChange={e => setItemForm(f => ({ ...f, cantidad_base: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>P.U. referencia (S/)</label>
                  <input type="number" min="0" step="0.01" value={itemForm.precio_unitario}
                    onChange={e => setItemForm(f => ({ ...f, precio_unitario: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Orden</label>
                  <input type="number" value={itemForm.orden} onChange={e => setItemForm(f => ({ ...f, orden: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 2, display: "flex", alignItems: "flex-end" }}>
                  <div style={{ background: LIGHT, borderRadius: 8, padding: "8px 12px", width: "100%", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#374151" }}>Subtotal base:</span>
                    <strong style={{ color: PRIMARY }}>S/ {((parseFloat(itemForm.cantidad_base)||0)*(parseFloat(itemForm.precio_unitario)||0)).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: 12, marginTop: 10 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowItemModal(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveItem} disabled={saving} style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : "Guardar ítem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
