import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY   = "#0B2E33";
const ACCENT    = "#4F7C82";
const LIGHT     = "#EEF7F8";
const BORDER    = "#C5D8DB";

function CategoryModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    codigo:     item?.codigo     ?? "",
    nombre:     item?.nombre     ?? "",
    es_directo: item?.es_directo ?? true,
    orden:      item?.orden      ?? 0,
    color_hex:  item?.color_hex  ?? "#4F7C82",
    activo:     item?.activo     ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return setErr("Código y nombre son obligatorios");
    setLoading(true); setErr("");
    try {
      if (isEdit) {
        await apiFetch(`/cotizaciones/categorias-costo/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ nombre: form.nombre, es_directo: form.es_directo, orden: Number(form.orden), color_hex: form.color_hex, activo: form.activo }),
        });
      } else {
        await apiFetch("/cotizaciones/categorias-costo", {
          method: "POST",
          body: JSON.stringify({ codigo: form.codigo.toUpperCase().trim(), nombre: form.nombre.trim(), es_directo: form.es_directo, orden: Number(form.orden), color_hex: form.color_hex }),
        });
      }
      onSaved();
    } catch (e) { setErr(e.message ?? "Error al guardar"); }
    finally { setLoading(false); }
  };

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 18px", color: PRIMARY, fontSize: 16, fontWeight: 800 }}>
          {isEdit ? "Editar categoría" : "Nueva categoría de costo"}
        </h3>

        <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 3 }}>Código *</label>
        <input
          value={form.codigo}
          onChange={e => set("codigo", e.target.value)}
          disabled={isEdit}
          placeholder="Ej: MO, MAT, EQP"
          style={{ ...inp, marginBottom: 12, fontWeight: 700, textTransform: "uppercase", fontFamily: "monospace", background: isEdit ? "#F9FAFB" : "#fff" }}
        />

        <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 3 }}>Nombre *</label>
        <input
          value={form.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej: Mano de Obra"
          style={{ ...inp, marginBottom: 12 }}
          autoFocus={!isEdit}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 3 }}>Orden</label>
            <input type="number" value={form.orden} onChange={e => set("orden", e.target.value)} style={inp} min={0} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 3 }}>Color</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="color" value={form.color_hex} onChange={e => set("color_hex", e.target.value)}
                style={{ width: 36, height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: 2, cursor: "pointer" }} />
              <input value={form.color_hex} onChange={e => set("color_hex", e.target.value)}
                style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: 12 }} placeholder="#4F7C82" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={form.es_directo} onChange={e => set("es_directo", e.target.checked)}
              style={{ width: 15, height: 15, accentColor: ACCENT }} />
            <span style={{ color: "#374151", fontWeight: 600 }}>Costo Directo</span>
          </label>
          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.activo} onChange={e => set("activo", e.target.checked)}
                style={{ width: 15, height: 15, accentColor: ACCENT }} />
              <span style={{ color: "#374151", fontWeight: 600 }}>Activo</span>
            </label>
          )}
        </div>

        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 12px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear categoría"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategoriasCosto() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // null | "new" | { item }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/cotizaciones/categorias-costo");
      setCategorias(Array.isArray(data) ? data : []);
    } catch { setCategorias([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const directas   = categorias.filter(c => c.es_directo);
  const indirectas = categorias.filter(c => !c.es_directo);

  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F0F9FA" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: PRIMARY }}>Categorías de Costo</h1>
            <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>
              Define los tipos de recurso que aparecen en el APU y en la exportación Excel
            </p>
          </div>
          <button
            onClick={() => setModal("new")}
            style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + Nueva categoría
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total categorías", value: categorias.length,          color: ACCENT },
            { label: "Costos directos",  value: directas.length,            color: "#166534" },
            { label: "Costos indirectos",value: indirectas.length,          color: "#92400E" },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>Cargando...</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: PRIMARY }}>
                  {["Código", "Nombre", "Tipo", "Orden", "Color", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categorias.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Sin categorías</td></tr>
                ) : categorias.sort((a, b) => a.orden - b.orden).map((cat, i) => (
                  <tr key={cat.id} style={{ background: i % 2 === 0 ? "#fff" : "#F9FAFB", borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, color: cat.color_hex, background: cat.color_hex + "15", padding: "2px 8px", borderRadius: 5, fontSize: 13 }}>
                        {cat.codigo}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: PRIMARY, fontSize: 13 }}>{cat.nombre}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                        background: cat.es_directo ? "#DCFCE7" : "#FEF3C7",
                        color:      cat.es_directo ? "#166534" : "#92400E",
                      }}>
                        {cat.es_directo ? "Directo" : "Indirecto"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#64748B", fontSize: 13 }}>{cat.orden}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, background: cat.color_hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748B" }}>{cat.color_hex}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                        background: cat.activo ? "#DBEAFE" : "#F3F4F6",
                        color:      cat.activo ? "#1D4ED8" : "#6B7280",
                      }}>
                        {cat.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => setModal({ item: cat })}
                        style={{ background: LIGHT, color: PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = LIGHT; e.currentTarget.style.color = PRIMARY; }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: 14, color: "#94A3B8", fontSize: 11 }}>
          Nota: los códigos no se pueden cambiar una vez creados. Para desactivar una categoría usa el toggle "Activo".
        </p>
      </div>

      {modal === "new" && (
        <CategoryModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal?.item && (
        <CategoryModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </Layout>
  );
}
