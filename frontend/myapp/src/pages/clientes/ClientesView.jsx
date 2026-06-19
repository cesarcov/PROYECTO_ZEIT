import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const PRIMARY = "#0B2E33";
const ACCENT  = "#4F7C82";
const LIGHT   = "#EEF7F8";

const STATUS_COLORS = {
  BORRADOR:  { bg: "#F3F4F6", text: "#6B7280", label: "Borrador" },
  ENVIADA:   { bg: "#DBEAFE", text: "#1D4ED8", label: "Enviada" },
  APROBADA:  { bg: "#D1FAE5", text: "#065F46", label: "Aprobada" },
  RECHAZADA: { bg: "#FEE2E2", text: "#991B1B", label: "Rechazada" },
  EXPIRADA:  { bg: "#FEF3C7", text: "#92400E", label: "Expirada" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.BORRADOR;
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

export default function ClientesView() {
  const navigate = useNavigate();
  const [clientes, setClientes]           = useState([]);
  const [selected, setSelected]           = useState(null);
  const [cotizaciones, setCotizaciones]   = useState([]);
  const [stats, setStats]                 = useState(null);
  const [highlightContact, setHighlightContact] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [loadingCot, setLoadingCot]       = useState(false);
  const [search, setSearch]               = useState("");
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState({});
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  
  // Contact management states
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ nombre: "", cargo: "", telefono: "", email: "" });
  const [addingContact, setAddingContact] = useState(false);
  const [contactError, setContactError] = useState("");

  useEffect(() => { loadClientes(); }, []);

  async function loadClientes() {
    setLoading(true);
    try {
      const data = await apiFetch("/clientes");
      setClientes(data);
      
      // Auto-select client if 'id' is in URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const preselectedId = urlParams.get("id");
      const highlightId = urlParams.get("contacto");
      if (highlightId) setHighlightContact(highlightId);
      if (preselectedId) {
        const matched = data.find(c => c.id === preselectedId);
        if (matched) {
          selectCliente(matched, highlightId);
        }
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function selectCliente(c, contactoId = null) {
    setSelected(c);
    if (contactoId) setHighlightContact(contactoId);
    setLoadingCot(true);
    try {
      const [cots, st] = await Promise.all([
        apiFetch(`/clientes/${c.id}/cotizaciones`),
        apiFetch(`/clientes/${c.id}/stats`),
      ]);
      setCotizaciones(cots);
      setStats(st);
    } catch {
      setCotizaciones([]);
      setStats(null);
    }
    finally { setLoadingCot(false); }
  }

  function openNew() {
    setEditing(null);
    setForm({ razon_social: "", ruc: "", direccion: "", telefono: "", email: "", contacto: "", cargo_contacto: "", notas: "" });
    setError("");
    setShowModal(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      razon_social: c.razon_social || "",
      ruc: c.ruc || "",
      direccion: c.direccion || "",
      telefono: c.telefono || "",
      email: c.email || "",
      contacto: c.contacto || "",
      cargo_contacto: c.cargo_contacto || "",
      notas: c.notas || "",
    });
    setError("");
    setShowModal(true);
  }

  async function save() {
    if (!form.razon_social.trim()) { setError("Razón social es obligatoria."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        razon_social: form.razon_social.trim(),
        ruc: form.ruc || null,
        direccion: form.direccion || null,
        telefono: form.telefono || null,
        email: form.email || null,
        contacto: form.contacto || null,
        cargo_contacto: form.cargo_contacto || null,
        notas: form.notas || null,
      };
      let saved;
      if (editing) {
        saved = await apiFetch(`/clientes/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setClientes(cs => cs.map(c => c.id === saved.id ? saved : c));
        if (selected?.id === saved.id) { setSelected(saved); }
      } else {
        saved = await apiFetch("/clientes", { method: "POST", body: JSON.stringify(payload) });
        setClientes(cs => [...cs, saved]);
      }
      setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActivo(c) {
    try {
      const saved = await apiFetch(`/clientes/${c.id}`, { method: "PATCH", body: JSON.stringify({ activo: !c.activo }) });
      setClientes(cs => cs.map(x => x.id === saved.id ? saved : x));
      if (selected?.id === saved.id) setSelected(saved);
    } catch (e) { alert(e.message); }
  }

  async function addContact() {
    if (!contactForm.nombre.trim()) { setContactError("El nombre es obligatorio."); return; }
    setAddingContact(true); setContactError("");
    try {
      const res = await apiFetch(`/clientes/${selected.id}/contactos`, {
        method: "POST",
        body: JSON.stringify({
          nombre: contactForm.nombre.trim(),
          cargo: contactForm.cargo.trim() || null,
          telefono: contactForm.telefono.trim() || null,
          email: contactForm.email.trim() || null,
        })
      });
      setSelected(prev => ({
        ...prev,
        contactos: [...(prev.contactos || []), res]
      }));
      setClientes(cs => cs.map(c => c.id === selected.id ? { ...c, contactos: [...(c.contactos || []), res] } : c));
      setShowAddContact(false);
      setContactForm({ nombre: "", cargo: "", telefono: "", email: "" });
    } catch (e) {
      setContactError(e.message);
    } finally {
      setAddingContact(false);
    }
  }

  async function deleteContact(contactoId) {
    if (!window.confirm("¿Estás seguro de eliminar este contacto?")) return;
    try {
      await apiFetch(`/clientes/contactos/${contactoId}`, { method: "DELETE" });
      setSelected(prev => ({
        ...prev,
        contactos: (prev.contactos || []).filter(ct => ct.id !== contactoId)
      }));
      setClientes(cs => cs.map(c => c.id === selected.id ? { ...c, contactos: (c.contactos || []).filter(ct => ct.id !== contactoId) } : c));
    } catch (e) {
      alert(e.message);
    }
  }

  const filtered = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (c.ruc || "").includes(search)
  );

  const totalCots = cotizaciones.length;
  const aprobadas = cotizaciones.filter(c => c.status === "APROBADA").length;

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>Clientes</h1>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>Cartera de clientes y su historial de cotizaciones</p>
        </div>
        <button onClick={openNew} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Nuevo Cliente
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Panel izquierdo — lista */}
        <div style={{ width: 320, flexShrink: 0, background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
            <input
              placeholder="Buscar por razón social o RUC..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Sin clientes{search ? " para esa búsqueda" : ""}</div>
            ) : filtered.map(c => (
              <div
                key={c.id}
                onClick={() => selectCliente(c)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid #F3F4F6",
                  background: selected?.id === c.id ? LIGHT : "transparent",
                  borderLeft: selected?.id === c.id ? `3px solid ${ACCENT}` : "3px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: PRIMARY }}>{c.razon_social}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{c.codigo} {c.ruc ? `· RUC ${c.ruc}` : ""}</div>
                  </div>
                  {!c.activo && (
                    <span style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                      Inactivo
                    </span>
                  )}
                </div>
                {(() => {
                  const contactsLabel = c.contactos && c.contactos.length > 0 
                    ? c.contactos[0].nombre + (c.contactos.length > 1 ? ` (+${c.contactos.length - 1})` : "")
                    : (c.contacto || "");
                  return contactsLabel ? (
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>👤</span>
                      <span>{contactsLabel}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid #E5E7EB", fontSize: 12, color: "#6B7280" }}>
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Panel derecho — detalle */}
        {!selected ? (
          <div style={{ flex: 1, background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 60, textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
            <p style={{ fontWeight: 600 }}>Selecciona un cliente</p>
            <p style={{ fontSize: 13 }}>para ver su ficha e historial de cotizaciones</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Ficha del cliente */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: PRIMARY, margin: 0 }}>{selected.razon_social}</h2>
                  {selected.ruc && (
                    <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginTop: 4 }}>
                      RUC: {selected.ruc}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    CÓDIGO: {selected.codigo}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(selected)} style={{ background: LIGHT, color: PRIMARY, border: `1px solid ${ACCENT}40`, borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    Editar
                  </button>
                  <button onClick={() => toggleActivo(selected)} style={{ background: selected.activo ? "#FEF3C7" : "#D1FAE5", color: selected.activo ? "#92400E" : "#065F46", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {selected.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 13 }}>
                {[
                  ["Email General", selected.email || "—"],
                  ["Teléfono General", selected.telefono || "—"],
                  ["Dirección", selected.direccion || "—"],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: LIGHT, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ color: PRIMARY, fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* KPI mini */}
              <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "8px 16px", fontSize: 12 }}>
                  <span style={{ color: "#6B7280" }}>Total cotizaciones: </span>
                  <span style={{ fontWeight: 700, color: "#1D4ED8" }}>{stats?.total_cotizaciones ?? totalCots}</span>
                </div>
                <div style={{ background: "#D1FAE5", borderRadius: 8, padding: "8px 16px", fontSize: 12 }}>
                  <span style={{ color: "#6B7280" }}>Aprobadas: </span>
                  <span style={{ fontWeight: 700, color: "#065F46" }}>{stats?.aprobadas ?? aprobadas}</span>
                </div>
                <div style={{ background: "#FFFBEB", borderRadius: 8, padding: "8px 16px", fontSize: 12 }}>
                  <span style={{ color: "#6B7280" }}>OTs en ejecución: </span>
                  <span style={{ fontWeight: 700, color: "#92400E" }}>{stats?.ots_en_ejecucion ?? 0}</span>
                </div>
                <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 16px", fontSize: 12 }}>
                  <span style={{ color: "#6B7280" }}>OTs completadas: </span>
                  <span style={{ fontWeight: 700, color: "#15803D" }}>{stats?.ots_completadas ?? 0}</span>
                </div>
                <div style={{ background: "#EEF7F8", borderRadius: 8, padding: "8px 16px", fontSize: 12 }}>
                  <span style={{ color: "#6B7280" }}>Actividades activas: </span>
                  <span style={{ fontWeight: 700, color: PRIMARY }}>{stats?.actividades_activas ?? 0}</span>
                </div>
              </div>

              {/* Directorio de Contactos de la Empresa */}
              <div style={{ marginTop: 24, borderTop: "1px solid #E5E7EB", paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0 }}>
                    Directorio de Contactos
                  </h3>
                  <button 
                    onClick={() => { setContactError(""); setShowAddContact(true); }}
                    style={{
                      background: LIGHT,
                      color: PRIMARY,
                      border: `1px solid ${ACCENT}40`,
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#D9EDF0"}
                    onMouseLeave={e => e.currentTarget.style.background = LIGHT}
                  >
                    + Añadir Contacto
                  </button>
                </div>

                {!selected.contactos || selected.contactos.length === 0 ? (
                  <div style={{ background: "#F9FAFB", border: "1px dashed #D1D5DB", borderRadius: 10, padding: "20px", textAlign: "center", color: "#6B7280", fontSize: 13 }}>
                    Sin contactos registrados. Haz clic en "+ Añadir Contacto" para registrar uno.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {selected.contactos.map(contacto => (
                      <div 
                        key={contacto.id}
                        style={{
                          background: highlightContact === contacto.id ? "#EEF7F8" : "#FAFAFA",
                          border: highlightContact === contacto.id ? `2px solid ${ACCENT}` : "1px solid #E5E7EB",
                          borderRadius: 10,
                          padding: 12,
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          boxShadow: highlightContact === contacto.id ? "0 0 0 3px rgba(79,124,130,0.15)" : "none",
                        }}
                      >
                        <button
                          onClick={() => deleteContact(contacto.id)}
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            background: "none",
                            border: "none",
                            color: "#EF4444",
                            cursor: "pointer",
                            fontSize: 14,
                            padding: 4
                          }}
                          title="Eliminar contacto"
                        >
                          🗑
                        </button>
                        
                        <div style={{ fontWeight: 700, color: PRIMARY, fontSize: 13, paddingRight: 24, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>👤 {contacto.nombre}</span>
                          <span style={{
                            background: (contacto.total_cotizaciones || 0) > 0 ? "#E0F2F1" : "#F3F4F6",
                            color: (contacto.total_cotizaciones || 0) > 0 ? "#00695C" : "#6B7280",
                            borderRadius: 12,
                            padding: "1px 6px",
                            fontSize: 10,
                            fontWeight: 700
                          }}>
                            {contacto.total_cotizaciones || 0} cot
                          </span>
                        </div>
                        
                        {contacto.cargo && (
                          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                            💼 {contacto.cargo}
                          </div>
                        )}
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, marginTop: 4 }}>
                          {contacto.telefono && (
                            <div>
                              📞 <a href={`tel:${contacto.telefono}`} style={{ color: ACCENT, textDecoration: "none", fontWeight: 500 }}>{contacto.telefono}</a>
                            </div>
                          )}
                          {contacto.email && (
                            <div>
                              ✉️ <a href={`mailto:${contacto.email}`} style={{ color: ACCENT, textDecoration: "none", fontWeight: 500 }}>{contacto.email}</a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Historial de cotizaciones */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #E5E7EB", fontWeight: 700, fontSize: 14, color: PRIMARY }}>
                Historial de Cotizaciones
              </div>
              {loadingCot ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
              ) : cotizaciones.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  Sin cotizaciones para este cliente
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                     <tr style={{ background: LIGHT }}>
                      {["N° Cotización", "Plan", "Contacto", "Estado", "Lugar", "Plazo", "Enviada", "Respuesta"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#6B7280", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                      <th style={{ padding: "10px 14px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.map((cot, i) => (
                      <tr key={cot.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: PRIMARY }}>{cot.numero_cotizacion || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#374151" }}>{cot.plan_code}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{cot.plan_title}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 500, color: "#374151" }}>
                          {cot.contacto_nombre || "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}><StatusBadge status={cot.status} /></td>
                        <td style={{ padding: "10px 14px", color: "#6B7280" }}>{cot.lugar_trabajo || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#6B7280" }}>{cot.plazo_dias ? `${cot.plazo_dias}d` : "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 12 }}>
                          {cot.fecha_envio ? new Date(cot.fecha_envio).toLocaleDateString("es-PE") : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 12 }}>
                          {cot.fecha_respuesta ? new Date(cot.fecha_respuesta).toLocaleDateString("es-PE") : "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <button
                            onClick={() => navigate(`/operations/plans/${cot.plan_id}/presupuesto`)}
                            style={{ background: LIGHT, color: PRIMARY, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: PRIMARY, marginTop: 0, marginBottom: 20 }}>
              {editing ? "Editar Cliente" : "Nuevo Cliente"}
            </h2>

            {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Razón Social *", key: "razon_social", span: 2 },
                { label: "RUC", key: "ruc" },
                { label: "Email", key: "email" },
                { label: "Teléfono", key: "telefono" },
                { label: "Contacto", key: "contacto" },
                { label: "Cargo del Contacto", key: "cargo_contacto" },
                { label: "Dirección", key: "direccion", span: 2 },
                { label: "Notas internas", key: "notas", span: 2, multiline: true },
              ].map(({ label, key, span, multiline }) => (
                <div key={key} style={{ gridColumn: span === 2 ? "span 2" : undefined }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
                  {multiline ? (
                    <textarea
                      value={form[key] || ""}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      rows={2}
                      style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                    />
                  ) : (
                    <input
                      value={form[key] || ""}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : (editing ? "Guardar cambios" : "Crear Cliente")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal añadir contacto */}
      {showAddContact && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: PRIMARY, marginTop: 0, marginBottom: 4 }}>
              Añadir Nuevo Contacto
            </h2>
            <p style={{ color: "#6B7280", fontSize: 12, margin: "0 0 20px" }}>
              Registra una persona de contacto para la empresa {selected?.razon_social}
            </p>

            {contactError && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{contactError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nombre Completo *", key: "nombre" },
                { label: "Cargo / Puesto", key: "cargo" },
                { label: "Teléfono", key: "telefono" },
                { label: "Correo Electrónico", key: "email" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
                  <input
                    value={contactForm[key] || ""}
                    onChange={e => setContactForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowAddContact(false)} style={{ background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={addContact} disabled={addingContact} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: addingContact ? "not-allowed" : "pointer", opacity: addingContact ? 0.7 : 1 }}>
                {addingContact ? "Añadiendo..." : "Añadir Contacto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
