import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY  = "var(--primary)";
const ACCENT   = "var(--primary)";
const LIGHT    = "var(--border)";
const LIGHTEST = "var(--primary-soft)";

const CONTEXTOS  = ["PARADA", "PROYECTO", "SERVICIO", "INGENIERIA"];
const UBICACIONES = ["MINA", "AREQUIPA", "INDUSTRIA", "CUALQUIERA"];
const MODALIDADES = ["HORA", "DIA"];

const CONTEXTO_COLOR = {
  PARADA:     { bg: "#FFF3E0", text: "#E65100" },
  PROYECTO:   { bg: "#E3F2FD", text: "#1565C0" },
  SERVICIO:   { bg: "#E8F5E9", text: "#2E7D32" },
  INGENIERIA: { bg: "#F3E5F5", text: "#6A1B9A" },
};

const MODALIDAD_ICON = { HORA: "⏱", DIA: "📅" };

function TarifaModal({ tarifa, onClose, onSaved }) {
  const isEdit = Boolean(tarifa?.id);
  const [form, setForm] = useState({
    rol:                  tarifa?.rol || "",
    contexto:             tarifa?.contexto || "PARADA",
    ubicacion:            tarifa?.ubicacion || "MINA",
    modalidad:            tarifa?.modalidad || "DIA",
    horas_por_dia:        tarifa?.horas_por_dia ?? 8,
    tarifa:               tarifa?.tarifa ?? "",
    tarifa_hora_extra:    tarifa?.tarifa_hora_extra ?? "",
    moneda:               tarifa?.moneda || "PEN",
    incluye_epp:          tarifa?.incluye_epp ?? false,
    incluye_herramientas: tarifa?.incluye_herramientas ?? false,
    notas:                tarifa?.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.rol.trim()) return setError("El rol es obligatorio");
    if (!form.tarifa)     return setError("La tarifa es obligatoria");

    setSaving(true);
    try {
      const body = {
        ...form,
        tarifa:            Number(form.tarifa),
        tarifa_hora_extra: form.tarifa_hora_extra !== "" ? Number(form.tarifa_hora_extra) : null,
        horas_por_dia:     Number(form.horas_por_dia),
      };
      let data;
      if (isEdit) {
        data = await apiFetch(`/cotizaciones/tarifas-personal/${tarifa.id}`, {
          method: "PATCH", body: JSON.stringify(body),
        });
      } else {
        data = await apiFetch("/cotizaciones/tarifas-personal", {
          method: "POST", body: JSON.stringify(body),
        });
      }
      onSaved(data);
    } catch (err) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: `1px solid ${LIGHT}`, fontSize: 13, outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 12, color: ACCENT, fontWeight: 600, display: "block", marginBottom: 3 };
  const groupStyle = { marginBottom: 12 };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "white", borderRadius: 12, padding: 28, width: 540,
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: PRIMARY, fontSize: 16 }}>
            {isEdit ? "Editar Tarifa" : "Nueva Tarifa de Personal"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>×</button>
        </div>

        {error && (
          <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 6, padding: "8px 12px", marginBottom: 12, color: "#E65100", fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={groupStyle}>
            <label style={labelStyle}>Rol *</label>
            <input style={inputStyle} value={form.rol} onChange={e => set("rol", e.target.value)}
              placeholder="Ej: Técnico E/I, Supervisor Operativo, Soldador..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Contexto *</label>
              <select style={inputStyle} value={form.contexto} onChange={e => set("contexto", e.target.value)}>
                {CONTEXTOS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ubicación *</label>
              <select style={inputStyle} value={form.ubicacion} onChange={e => set("ubicacion", e.target.value)}>
                {UBICACIONES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Modalidad *</label>
              <select style={inputStyle} value={form.modalidad} onChange={e => set("modalidad", e.target.value)}>
                {MODALIDADES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {form.modalidad === "DIA" && (
            <div style={groupStyle}>
              <label style={labelStyle}>Horas efectivas por día</label>
              <select style={inputStyle} value={form.horas_por_dia} onChange={e => set("horas_por_dia", Number(e.target.value))}>
                <option value={8}>8 horas</option>
                <option value={10}>10 horas</option>
                <option value={12}>12 horas</option>
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Tarifa *</label>
              <input style={inputStyle} type="number" step="0.01" min="0" value={form.tarifa}
                onChange={e => set("tarifa", e.target.value)} placeholder="230.00" />
            </div>
            <div>
              <label style={labelStyle}>Tarifa hora extra</label>
              <input style={inputStyle} type="number" step="0.01" min="0" value={form.tarifa_hora_extra}
                onChange={e => set("tarifa_hora_extra", e.target.value)} placeholder="—" />
            </div>
            <div>
              <label style={labelStyle}>Moneda</label>
              <select style={inputStyle} value={form.moneda} onChange={e => set("moneda", e.target.value)}>
                <option value="PEN">PEN (S/)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: PRIMARY, cursor: "pointer" }}>
              <input type="checkbox" checked={form.incluye_epp} onChange={e => set("incluye_epp", e.target.checked)} />
              Incluye EPP
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: PRIMARY, cursor: "pointer" }}>
              <input type="checkbox" checked={form.incluye_herramientas} onChange={e => set("incluye_herramientas", e.target.checked)} />
              Incluye herramientas
            </label>
          </div>

          <div style={groupStyle}>
            <label style={labelStyle}>Notas internas</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
              value={form.notas} onChange={e => set("notas", e.target.value)}
              placeholder="Ej: Turno 12h en minería, incluye movilización..." />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 18px", borderRadius: 6, border: `1px solid ${LIGHT}`,
              background: "white", color: PRIMARY, fontSize: 13, cursor: "pointer",
            }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              background: PRIMARY, color: "white", fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}>{saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tarifa"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TarifasPersonalView() {
  const [tarifas,  setTarifas]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [modal,    setModal]    = useState(null);   // null | "new" | tarifa-obj
  const [filters,  setFilters]  = useState({ rol: "", contexto: "", ubicacion: "", modalidad: "" });
  const [showInact, setShowInact] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (!showInact) params.append("activo", "true");
      else            params.append("activo", "false");
      const data = await apiFetch(`/cotizaciones/tarifas-personal?${params}`);
      setTarifas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [showInact]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(t) {
    if (!confirm(`¿Desactivar tarifa "${t.rol} / ${t.contexto} / ${t.ubicacion}"?`)) return;
    try {
      await apiFetch(`/cotizaciones/tarifas-personal/${t.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleSaved(data) {
    setModal(null);
    load();
  }

  // Filtro en cliente
  const filtered = tarifas.filter(t => {
    if (filters.rol      && !t.rol.toLowerCase().includes(filters.rol.toLowerCase())) return false;
    if (filters.contexto  && t.contexto  !== filters.contexto)  return false;
    if (filters.ubicacion && t.ubicacion !== filters.ubicacion) return false;
    if (filters.modalidad && t.modalidad !== filters.modalidad) return false;
    return true;
  });

  // Agrupar por rol
  const byRol = {};
  filtered.forEach(t => {
    if (!byRol[t.rol]) byRol[t.rol] = [];
    byRol[t.rol].push(t);
  });

  const thStyle = {
    padding: "8px 12px", textAlign: "left", fontSize: 11,
    fontWeight: 700, color: "white", background: PRIMARY, position: "sticky", top: 0,
  };
  const tdStyle = { padding: "7px 12px", fontSize: 12, borderBottom: `1px solid ${LIGHTEST}`, color: "#333" };

  return (
    <Layout>
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, color: PRIMARY, fontSize: 20 }}>Tarifas de Personal</h2>
            <p style={{ margin: "4px 0 0", color: ACCENT, fontSize: 13 }}>
              Matriz contextual: rol × contexto × ubicación × modalidad
            </p>
          </div>
          <button onClick={() => setModal("new")} style={{
            background: PRIMARY, color: "white", border: "none",
            padding: "9px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600,
          }}>+ Nueva tarifa</button>
        </div>

        {/* Filtros */}
        <div style={{
          background: LIGHTEST, borderRadius: 10, padding: "14px 16px",
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16,
        }}>
          <input
            placeholder="Buscar rol…"
            value={filters.rol}
            onChange={e => setFilters(f => ({ ...f, rol: e.target.value }))}
            style={{
              padding: "6px 10px", borderRadius: 6, border: `1px solid ${LIGHT}`,
              fontSize: 13, minWidth: 180, outline: "none",
            }}
          />
          {[
            { key: "contexto",  opts: CONTEXTOS,  label: "Contexto" },
            { key: "ubicacion", opts: UBICACIONES, label: "Ubicación" },
            { key: "modalidad", opts: MODALIDADES, label: "Modalidad" },
          ].map(({ key, opts, label }) => (
            <select key={key}
              value={filters[key]}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${LIGHT}`, fontSize: 13, outline: "none" }}
            >
              <option value="">Todos {label}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: ACCENT, cursor: "pointer" }}>
            <input type="checkbox" checked={showInact} onChange={e => setShowInact(e.target.checked)} />
            Ver inactivas
          </label>
          {(filters.rol || filters.contexto || filters.ubicacion || filters.modalidad) && (
            <button onClick={() => setFilters({ rol: "", contexto: "", ubicacion: "", modalidad: "" })}
              style={{ background: "none", border: "none", color: ACCENT, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Limpiar
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#E65100" }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", color: ACCENT, padding: 40 }}>Cargando tarifas…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", color: ACCENT, padding: 60, background: LIGHTEST, borderRadius: 10 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600 }}>Sin tarifas</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Ajusta los filtros o crea la primera tarifa.</div>
          </div>
        )}

        {/* Tabla agrupada por rol */}
        {!loading && Object.keys(byRol).length > 0 && (
          <div style={{ borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,31,84,0.10)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
              <thead>
                <tr>
                  {["Contexto", "Ubicación", "Modalidad", "H/Día", "Tarifa", "Hora Extra", "Moneda", "EPP / Herr.", "Notas", ""].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byRol).map(([rol, items]) => (
                  <>
                    {/* Encabezado de rol */}
                    <tr key={`rol-${rol}`}>
                      <td colSpan={10} style={{
                        padding: "8px 14px", background: "#E8F4F5",
                        fontWeight: 700, color: PRIMARY, fontSize: 13,
                        borderBottom: `1px solid ${LIGHT}`, letterSpacing: "0.3px",
                      }}>
                        👤 {rol}
                      </td>
                    </tr>
                    {items.map(t => {
                      const cColor = CONTEXTO_COLOR[t.contexto] || { bg: "#F5F5F5", text: "#333" };
                      return (
                        <tr key={t.id} style={{ opacity: t.activo ? 1 : 0.5 }}>
                          <td style={tdStyle}>
                            <span style={{
                              background: cColor.bg, color: cColor.text,
                              padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                            }}>{t.contexto}</span>
                          </td>
                          <td style={tdStyle}>{t.ubicacion}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>
                            {MODALIDAD_ICON[t.modalidad]} {t.modalidad}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {t.modalidad === "DIA" ? `${t.horas_por_dia}h` : "—"}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: PRIMARY }}>
                            {t.moneda === "PEN" ? "S/" : "$"} {Number(t.tarifa).toFixed(2)}
                          </td>
                          <td style={tdStyle}>
                            {t.tarifa_hora_extra != null
                              ? `${t.moneda === "PEN" ? "S/" : "$"} ${Number(t.tarifa_hora_extra).toFixed(2)}`
                              : <span style={{ color: "#aaa" }}>—</span>
                            }
                          </td>
                          <td style={tdStyle}>{t.moneda}</td>
                          <td style={{ ...tdStyle, fontSize: 11 }}>
                            {t.incluye_epp          && <span style={{ color: "#2E7D32" }}>EPP </span>}
                            {t.incluye_herramientas && <span style={{ color: "#1565C0" }}>Herr.</span>}
                            {!t.incluye_epp && !t.incluye_herramientas && <span style={{ color: "#aaa" }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, color: "#666", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.notas || ""}
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <button onClick={() => setModal(t)} style={{
                              background: "none", border: `1px solid ${LIGHT}`, borderRadius: 5,
                              padding: "3px 10px", fontSize: 11, color: ACCENT, cursor: "pointer", marginRight: 4,
                            }}>Editar</button>
                            {t.activo && (
                              <button onClick={() => handleDelete(t)} style={{
                                background: "none", border: "1px solid #FFB74D", borderRadius: 5,
                                padding: "3px 10px", fontSize: 11, color: "#E65100", cursor: "pointer",
                              }}>Desactivar</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, color: ACCENT, fontSize: 12 }}>
          {filtered.length} tarifa{filtered.length !== 1 ? "s" : ""} · {Object.keys(byRol).length} rol{Object.keys(byRol).length !== 1 ? "es" : ""}
        </div>
      </div>

      {modal && (
        <TarifaModal
          tarifa={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </Layout>
  );
}
