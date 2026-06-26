import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY = "var(--primary)";
const ACCENT  = "var(--primary)";
const LIGHT   = "var(--primary-soft)";

const CATEGORIAS = ["Operario", "Supervisor", "Especialista", "Otro"];
const UNIDADES   = ["HH", "HD", "MES"];

const emptyForm = { codigo: "", descripcion: "", categoria: "Operario", tarifa_hora: "", unidad: "HH" };

export default function RecursosMOView() {
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchRecursos(); }, []);

  async function fetchRecursos() {
    setLoading(true);
    try {
      const data = await apiFetch("/cotizaciones/recursos-mo");
      setRecursos(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModal(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({ codigo: r.codigo, descripcion: r.descripcion, categoria: r.categoria, tarifa_hora: String(r.tarifa_hora), unidad: r.unidad });
    setError("");
    setModal(true);
  }

  async function handleSave() {
    if (!form.codigo.trim() || !form.descripcion.trim() || !form.tarifa_hora) {
      setError("Código, descripción y tarifa son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, tarifa_hora: parseFloat(form.tarifa_hora) };
      if (editing) {
        await apiFetch(`/cotizaciones/recursos-mo/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/cotizaciones/recursos-mo", { method: "POST", body: JSON.stringify(payload) });
      }
      setModal(false);
      fetchRecursos();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este recurso de mano de obra?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/cotizaciones/recursos-mo/${id}`, { method: "DELETE" });
      fetchRecursos();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  }

  const activeCount  = recursos.filter(r => r.activo).length;
  const inactiveCount = recursos.filter(r => !r.activo).length;

  return (
    <Layout>
      {/* Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Tarifas de Mano de Obra</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
            Catálogo de recursos MO usados en el APU de cotizaciones
          </p>
        </div>
        <button onClick={openNew} style={{
          background: PRIMARY, color: "white", border: "none", borderRadius: 10,
          padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuevo Recurso
        </button>
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: recursos.length, color: PRIMARY },
          { label: "Activos", value: activeCount, color: "#059669" },
          { label: "Inactivos", value: inactiveCount, color: "#9CA3AF" },
        ].map(s => (
          <div key={s.label} style={{
            background: "white", border: "1px solid #E5E7EB", borderRadius: 10,
            padding: "10px 18px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Cargando...</div>
      ) : recursos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
          <p style={{ fontWeight: 600 }}>Sin recursos registrados</p>
          <p style={{ fontSize: 13 }}>Crea el primer recurso de mano de obra para usarlo en el APU</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: PRIMARY }}>
                {["Código", "Descripción", "Categoría", "Tarifa/Hora", "Unidad", "Estado", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", color: "white", fontWeight: 700, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recursos.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "white" : LIGHT, borderBottom: "1px solid #E5E7EB" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: PRIMARY }}>{r.codigo}</td>
                  <td style={{ padding: "10px 14px" }}>{r.descripcion}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      background: LIGHT, color: ACCENT, border: `1px solid ${ACCENT}30`,
                      borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                    }}>{r.categoria}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "#374151" }}>
                    S/ {parseFloat(r.tarifa_hora).toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6B7280" }}>{r.unidad}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      background: r.activo ? "#D1FAE5" : "#F3F4F6",
                      color: r.activo ? "#065F46" : "#9CA3AF",
                      borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                    }}>{r.activo ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(r)} style={{
                        background: LIGHT, border: `1px solid ${ACCENT}40`, color: ACCENT,
                        borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>Editar</button>
                      <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} style={{
                        background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626",
                        borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                        cursor: deleting === r.id ? "not-allowed" : "pointer", opacity: deleting === r.id ? 0.6 : 1,
                      }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: PRIMARY, margin: "0 0 20px" }}>
              {editing ? "Editar Recurso MO" : "Nuevo Recurso MO"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FieldRow label="Código">
                <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder="MO-001" disabled={!!editing}
                  style={inputStyle(!!editing)} />
              </FieldRow>
              <FieldRow label="Descripción">
                <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Técnico Electricista" style={inputStyle()} />
              </FieldRow>
              <FieldRow label="Categoría">
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={inputStyle()}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </FieldRow>
              <div style={{ display: "flex", gap: 12 }}>
                <FieldRow label="Tarifa/Hora (S/)">
                  <input type="number" min="0" step="0.01" value={form.tarifa_hora}
                    onChange={e => setForm(f => ({ ...f, tarifa_hora: e.target.value }))}
                    placeholder="0.00" style={inputStyle()} />
                </FieldRow>
                <FieldRow label="Unidad">
                  <select value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} style={inputStyle()}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </FieldRow>
              </div>
              {editing && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.activo ?? true}
                    onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: "#374151" }}>Activo</span>
                </label>
              )}
            </div>

            {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 12 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setModal(false)} style={{
                background: "#F3F4F6", border: "none", borderRadius: 9,
                padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151",
              }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{
                background: PRIMARY, color: "white", border: "none", borderRadius: 9,
                padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.7 : 1,
              }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle(disabled = false) {
  return {
    border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, width: "100%", boxSizing: "border-box",
    background: disabled ? "#F9FAFB" : "white",
    color: disabled ? "#9CA3AF" : "#111827",
    outline: "none",
  };
}
