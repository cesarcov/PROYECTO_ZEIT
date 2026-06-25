import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch, BASE_URL as API } from "../../services/api";

const PRIMARY = "#0B2E33";
const ACCENT  = "#4F7C82";
const LIGHT   = "#EEF7F8";
const TOKEN   = () => localStorage.getItem("access_token");

// Helpers dinámicos — usan las categorías cargadas del backend
function buildCatHelpers(cats) {
  const byCode = {};
  cats.forEach(c => { byCode[c.codigo] = c; });
  const catColor = (code) => byCode[code]?.color_hex ?? "#6B7280";
  const catBg    = (code) => (byCode[code]?.color_hex ?? "#6B7280") + "20";
  const catLabel = (code) => byCode[code]?.nombre ?? code;
  return { catColor, catBg, catLabel };
}

const UNIDADES    = ["GLB", "UND", "ML", "M2", "M3", "KG", "HH", "HD", "MES"];
const CONTEXTOS   = ["PARADA", "PROYECTO", "SERVICIO", "INGENIERIA"];
const UBICACIONES = ["MINA", "AREQUIPA", "INDUSTRIA", "CUALQUIERA"];
const MODALIDADES = ["HORA", "DIA"];

export default function PresupuestoView() {
  const { planId } = useParams();
  const navigate   = useNavigate();

  const [plan, setPlan]           = useState(null);
  const [partidas, setPartidas]   = useState([]);
  const [config, setConfig]       = useState(null);
  const [resumen, setResumen]     = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [recursosMO, setRecursosMO] = useState([]);
  const [rolesPersonal, setRolesPersonal] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activePartida, setActivePartida] = useState(null);
  const [apuItems, setApuItems]   = useState({});

  // Modales
  const [showPartidaModal, setShowPartidaModal] = useState(false);
  const [editingPartida, setEditingPartida]     = useState(null);
  const [partidaForm, setPartidaForm]           = useState({ codigo: "", descripcion: "", unidad: "GLB", cantidad: "1", orden: "0", es_capitulo: false, parent_id: "" });

  // Editor APU multi-row
  const [showApuModal, setShowApuModal] = useState(false);
  const [editingApu, setEditingApu]     = useState(null);
  const [apuForm, setApuForm]           = useState({ tipo_recurso: "MAT", material_id: "", recurso_mo_id: "", descripcion: "", unidad: "", cantidad: "1", precio_unitario: "0" });

  const [showApuEditor, setShowApuEditor] = useState(false);
  const [editorPartida, setEditorPartida] = useState(null);
  const [newApuRows, setNewApuRows]       = useState([]);
  const [savingBulk, setSavingBulk]       = useState(false);
  const [baules, setBaules]               = useState([]);
  const [showBaulPicker, setShowBaulPicker] = useState(false);
  const [selectedBaul, setSelectedBaul]   = useState(null);
  const [baulMultiplier, setBaulMultiplier] = useState("1");

  // Modal proponer material nuevo
  const [showProponer, setShowProponer]       = useState(false);
  const [proponerRowKey, setProponerRowKey]   = useState(null);
  const [proponerForm, setProponerForm]       = useState({ nombre: "", unidad: "", categoria: "Material", precio_referencia: "", proveedor_referencia: "" });
  const [proponiendo, setProponiendo]         = useState(false);

  const [showConfig, setShowConfig]     = useState(false);
  const [configForm, setConfigForm]     = useState({});

  const [clientes, setClientes]       = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ nombre: "", cargo: "", telefono: "", email: "" });
  const [addingContact, setAddingContact] = useState(false);
  const [contactError, setContactError] = useState("");
  const [saving, setSaving]           = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError]             = useState("");
  const [exporting, setExporting]     = useState("");

  useEffect(() => { loadAll(); }, [planId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [planData, partidasData, configData, resumenData, matsData, moData, clientesData, rolesData, catsData] = await Promise.all([
        apiFetch(`/operations/plans/${planId}`),
        apiFetch(`/cotizaciones/planes/${planId}/partidas`),
        apiFetch(`/cotizaciones/planes/${planId}/config`),
        apiFetch(`/cotizaciones/planes/${planId}/resumen`),
        apiFetch("/logistics/materials?estado=ACTIVO"),
        apiFetch("/cotizaciones/recursos-mo"),
        apiFetch("/clientes?solo_activos=true"),
        apiFetch("/cotizaciones/tarifas-personal/roles").catch(() => []),
        apiFetch("/cotizaciones/categorias-costo").catch(() => []),
      ]);
      setPlan(planData);
      setPartidas(partidasData);
      setConfig(configData);
      setResumen(resumenData);
      setMateriales(matsData);
      setRecursosMO(moData.filter(m => m.activo));
      setClientes(clientesData);
      setRolesPersonal(Array.isArray(rolesData) ? rolesData : []);
      setCategorias(Array.isArray(catsData) ? catsData : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadApu(partidaId) {
    try {
      const items = await apiFetch(`/cotizaciones/partidas/${partidaId}/apu`);
      setApuItems(prev => ({ ...prev, [partidaId]: items }));
    } catch (err) {
      console.error("Error cargando APU de partida:", err);
    }
  }

  async function refreshResumen() {
    try {
      const r = await apiFetch(`/cotizaciones/planes/${planId}/resumen`);
      setResumen(r);
      const p = await apiFetch(`/cotizaciones/planes/${planId}/partidas`);
      setPartidas(p);
    } catch (err) {
      console.error("Error refrescando resumen:", err);
    }
  }

  // ── PARTIDAS ────────────────────────────────────────────────────────────────

  function openNewPartida(esCapitulo = false) {
    setEditingPartida(null);
    setPartidaForm({ codigo: "", descripcion: "", unidad: "GLB", cantidad: "1", orden: "0", es_capitulo: esCapitulo, parent_id: "" });
    setError("");
    setShowPartidaModal(true);
  }

  function openEditPartida(p) {
    setEditingPartida(p);
    setPartidaForm({ codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad, cantidad: String(p.cantidad), orden: String(p.orden), es_capitulo: p.es_capitulo, parent_id: p.parent_id || "" });
    setError("");
    setShowPartidaModal(true);
  }

  async function savePartida() {
    if (!partidaForm.codigo.trim() || !partidaForm.descripcion.trim()) {
      setError("Código y descripción son obligatorios."); return;
    }
    setSaving(true); setError("");
    try {
      const payload = {
        ...partidaForm,
        cantidad: parseFloat(partidaForm.cantidad) || 1,
        orden: parseInt(partidaForm.orden) || 0,
        parent_id: partidaForm.parent_id || null,
      };
      if (editingPartida) {
        await apiFetch(`/cotizaciones/planes/${planId}/partidas/${editingPartida.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/cotizaciones/planes/${planId}/partidas`, { method: "POST", body: JSON.stringify(payload) });
      }
      setShowPartidaModal(false);
      const updated = await apiFetch(`/cotizaciones/planes/${planId}/partidas`);
      setPartidas(updated);
      await refreshResumen();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deletePartida(id) {
    if (!window.confirm("¿Eliminar esta partida y todos sus ítems APU?")) return;
    try {
      await apiFetch(`/cotizaciones/planes/${planId}/partidas/${id}`, { method: "DELETE" });
      setPartidas(p => p.filter(x => x.id !== id));
      if (activePartida === id) setActivePartida(null);
      await refreshResumen();
    } catch (e) { alert(e.message); }
  }

  // ── APU ─────────────────────────────────────────────────────────────────────

  function openNewApu(partidaId) {
    setEditingApu(null);
    setApuForm({ tipo_recurso: "MAT", material_id: "", recurso_mo_id: "", descripcion: "", unidad: "", cantidad: "1", precio_unitario: "0" });
    setActivePartida(partidaId);
    setError("");
    setShowApuModal(true);
  }

  function openEditApu(item, partidaId) {
    setEditingApu({ ...item, partidaId });
    setApuForm({
      tipo_recurso: item.tipo_recurso,
      material_id: item.material_id || "",
      recurso_mo_id: item.recurso_mo_id || "",
      descripcion: item.descripcion || "",
      unidad: item.unidad || "",
      cantidad: String(item.cantidad),
      precio_unitario: String(item.precio_unitario),
    });
    setActivePartida(partidaId);
    setError("");
    setShowApuModal(true);
  }

  async function saveApu() {
    if (!apuForm.cantidad || !apuForm.precio_unitario) { setError("Cantidad y precio son obligatorios."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        tipo_recurso: apuForm.tipo_recurso,
        material_id: apuForm.tipo_recurso !== "MO" && apuForm.material_id ? apuForm.material_id : null,
        recurso_mo_id: apuForm.tipo_recurso === "MO" && apuForm.recurso_mo_id ? apuForm.recurso_mo_id : null,
        descripcion: apuForm.descripcion || null,
        unidad: apuForm.unidad || null,
        cantidad: parseFloat(apuForm.cantidad),
        precio_unitario: parseFloat(apuForm.precio_unitario),
      };
      if (editingApu) {
        await apiFetch(`/cotizaciones/partidas/${editingApu.partidaId}/apu/${editingApu.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/cotizaciones/partidas/${activePartida}/apu`, { method: "POST", body: JSON.stringify(payload) });
      }
      const pid = editingApu ? editingApu.partidaId : activePartida;
      setShowApuModal(false);
      await loadApu(pid);
      await refreshResumen();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteApu(partidaId, apuId) {
    if (!window.confirm("¿Eliminar este ítem APU?")) return;
    try {
      await apiFetch(`/cotizaciones/partidas/${partidaId}/apu/${apuId}`, { method: "DELETE" });
      await loadApu(partidaId);
      await refreshResumen();
    } catch (e) { alert(e.message); }
  }

  // ── APU Editor multi-row ────────────────────────────────────────────────────

  function emptyRow() {
    return {
      _key: Math.random(), tipo_recurso: "MAT",
      material_id: "", recurso_mo_id: "", descripcion: "", unidad: "", cantidad: "1", precio_unitario: "0",
      // Campos de Tarifa Personal (Fase 6B)
      tp_rol: "", tp_contexto: "PARADA", tp_ubicacion: "MINA", tp_modalidad: "DIA", tp_tarifa: null,
    };
  }

  async function fetchTarifaForRow(rowKey, rol, contexto, ubicacion, modalidad) {
    if (!rol) return;
    try {
      const params = new URLSearchParams({ rol, contexto, ubicacion, modalidad });
      const tarifa = await apiFetch(`/cotizaciones/tarifas-personal/buscar?${params}`);
      setNewApuRows(rows => rows.map(r => {
        if (r._key !== rowKey) return r;
        const precio = tarifa ? String(tarifa.tarifa) : r.precio_unitario;
        const unidad = tarifa ? (tarifa.modalidad === "HORA" ? "HH" : "HD") : r.unidad;
        const desc   = r.descripcion || (tarifa ? rol : r.descripcion);
        return { ...r, tp_tarifa: tarifa, precio_unitario: precio, unidad, descripcion: desc };
      }));
    } catch {}
  }

  async function openApuEditor(partida) {
    setEditorPartida(partida);
    setNewApuRows([emptyRow()]);
    setShowBaulPicker(false);
    setSelectedBaul(null);
    setBaulMultiplier("1");
    setError("");
    if (!apuItems[partida.id]) await loadApu(partida.id);
    if (baules.length === 0) {
      try { const b = await apiFetch("/cotizaciones/baules"); setBaules(b); } catch {}
    }
    setShowApuEditor(true);
  }

  function updateRow(key, field, val) {
    setNewApuRows(rows => rows.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: val };
      if (field === "material_id" && val) {
        const mat = materiales.find(m => m.id === val);
        if (mat) { updated.precio_unitario = String(mat.unit_cost ?? 0); updated.unidad = mat.unit ?? ""; }
      }
      if (field === "recurso_mo_id" && val) {
        const mo = recursosMO.find(m => m.id === val);
        if (mo) { updated.precio_unitario = String(mo.tarifa_hora); updated.unidad = mo.unidad; }
      }
      if (field === "tipo_recurso") { updated.material_id = ""; updated.recurso_mo_id = ""; }
      return updated;
    }));
  }

  function addEmptyRow() { setNewApuRows(rows => [...rows, emptyRow()]); }
  function removeRow(key) { setNewApuRows(rows => rows.filter(r => r._key !== key)); }

  function insertBaul() {
    if (!selectedBaul) return;
    const mult = parseFloat(baulMultiplier) || 1;
    const baul = baules.find(b => b.id === selectedBaul);
    if (!baul) return;
    const newRows = baul.items.map(item => ({
      _key: Math.random(),
      tipo_recurso: item.tipo_recurso,
      material_id: item.material_id || "",
      recurso_mo_id: item.recurso_mo_id || "",
      descripcion: item.descripcion,
      unidad: item.unidad,
      cantidad: String(parseFloat(item.cantidad_base) * mult),
      precio_unitario: String(item.precio_unitario),
    }));
    setNewApuRows(rows => [...rows.filter(r => r.descripcion || r.material_id || r.recurso_mo_id), ...newRows]);
    setShowBaulPicker(false);
    setSelectedBaul(null);
    setBaulMultiplier("1");
  }

  function openProponerModal(rowKey) {
    setProponerRowKey(rowKey);
    setProponerForm({ nombre: "", unidad: "", categoria: "Material", precio_referencia: "", proveedor_referencia: "" });
    setShowProponer(true);
  }

  async function confirmarProponer() {
    if (!proponerForm.nombre.trim()) return;
    setProponiendo(true);
    try {
      const nuevo = await apiFetch("/logistics/materials/proponer", {
        method: "POST",
        body: JSON.stringify({
          nombre: proponerForm.nombre,
          unidad: proponerForm.unidad || undefined,
          categoria: proponerForm.categoria || undefined,
          precio_referencia: proponerForm.precio_referencia ? parseFloat(proponerForm.precio_referencia) : undefined,
          proveedor_referencia: proponerForm.proveedor_referencia || undefined,
          plan_id: planId,
        }),
      });
      // Inyectar el material propuesto en la fila del APU editor
      setNewApuRows(rows => rows.map(r => {
        if (r._key !== proponerRowKey) return r;
        return {
          ...r,
          material_id: nuevo.id,
          descripcion: nuevo.name,
          precio_unitario: String(nuevo.precio_referencia ?? 0),
        };
      }));
      // Agregar el material al catálogo local con chip de estado
      setMateriales(prev => [...prev, { ...nuevo, unit_cost: nuevo.precio_referencia }]);
      setShowProponer(false);
    } catch (e) {
      alert(e.message || "Error al proponer material");
    } finally {
      setProponiendo(false);
    }
  }

  async function saveBulkApu() {
    const validRows = newApuRows.filter(r => parseFloat(r.cantidad) > 0 && (r.descripcion || r.material_id || r.recurso_mo_id));
    if (validRows.length === 0) { setError("Agrega al menos un ítem con descripción y cantidad."); return; }
    setSavingBulk(true); setError("");
    try {
      const payload = {
        items: validRows.map(r => ({
          tipo_recurso: r.tipo_recurso,
          material_id: r.tipo_recurso !== "MO" && r.material_id ? r.material_id : null,
          recurso_mo_id: r.tipo_recurso === "MO" && r.recurso_mo_id ? r.recurso_mo_id : null,
          descripcion: r.descripcion || null,
          unidad: r.unidad || null,
          cantidad: parseFloat(r.cantidad),
          precio_unitario: parseFloat(r.precio_unitario) || 0,
        })),
      };
      await apiFetch(`/cotizaciones/partidas/${editorPartida.id}/apu/bulk`, { method: "POST", body: JSON.stringify(payload) });
      await loadApu(editorPartida.id);
      await refreshResumen();
      setNewApuRows([emptyRow()]);
    } catch (e) { setError(e.message); }
    finally { setSavingBulk(false); }
  }

  // ── Expandir partida ─────────────────────────────────────────────────────────

  async function togglePartida(id) {
    if (activePartida === id) { setActivePartida(null); return; }
    setActivePartida(id);
    if (!apuItems[id]) await loadApu(id);
  }

  // ── Configuración ────────────────────────────────────────────────────────────

  function openConfig() {
    setConfigForm({
      gastos_generales_pct: String(config?.gastos_generales_pct ?? 12),
      utilidad_pct: String(config?.utilidad_pct ?? 10),
      igv_pct: String(config?.igv_pct ?? 18),
      moneda: config?.moneda ?? "PEN",
      cliente_id: config?.cliente_id ?? "",
      cliente_nombre: config?.cliente_nombre ?? "",
      cliente_ruc: config?.cliente_ruc ?? "",
      contacto_id: config?.contacto_id ?? "",
      lugar_trabajo: config?.lugar_trabajo ?? "",
      plazo_dias: String(config?.plazo_dias ?? ""),
      validez_dias: String(config?.validez_dias ?? 30),
      notas: config?.notas ?? "",
      notas_comerciales: config?.notas_comerciales ?? "",
    });
    setError("");
    setShowConfig(true);
  }

  async function handleStatusChange(nuevoStatus) {
    if (!window.confirm(`¿Cambiar estado de cotización a "${nuevoStatus}"?`)) return;
    setChangingStatus(true);
    try {
      const updated = await apiFetch(`/cotizaciones/planes/${planId}/config/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nuevoStatus }),
      });
      setConfig(updated);
    } catch (e) { alert(e.message); }
    finally { setChangingStatus(false); }
  }

  function onClienteSelect(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    setConfigForm(f => ({
      ...f,
      cliente_id: clienteId,
      cliente_nombre: cliente ? cliente.razon_social : f.cliente_nombre,
      cliente_ruc: cliente ? (cliente.ruc || f.cliente_ruc) : f.cliente_ruc,
      contacto_id: "",
    }));
  }

  async function handleAddContactInline() {
    if (!contactForm.nombre.trim()) {
      setContactError("El nombre es obligatorio.");
      return;
    }
    if (!configForm.cliente_id) {
      setContactError("Debes seleccionar un cliente primero.");
      return;
    }
    setAddingContact(true);
    setContactError("");
    try {
      const res = await apiFetch(`/clientes/${configForm.cliente_id}/contactos`, {
        method: "POST",
        body: JSON.stringify({
          nombre: contactForm.nombre.trim(),
          cargo: contactForm.cargo.trim() || null,
          telefono: contactForm.telefono.trim() || null,
          email: contactForm.email.trim() || null,
        })
      });
      setClientes(prev => prev.map(c => {
        if (c.id === configForm.cliente_id) {
          return {
            ...c,
            contactos: [...(c.contactos || []), res]
          };
        }
        return c;
      }));
      setConfigForm(f => ({ ...f, contacto_id: res.id }));
      setShowAddContact(false);
      setContactForm({ nombre: "", cargo: "", telefono: "", email: "" });
    } catch (e) {
      setContactError(e.message);
    } finally {
      setAddingContact(false);
    }
  }

  async function saveConfig() {
    setSaving(true); setError("");
    try {
      const payload = {
        gastos_generales_pct: parseFloat(configForm.gastos_generales_pct),
        utilidad_pct: parseFloat(configForm.utilidad_pct),
        igv_pct: parseFloat(configForm.igv_pct),
        moneda: configForm.moneda,
        cliente_id: configForm.cliente_id || null,
        cliente_nombre: configForm.cliente_nombre || null,
        cliente_ruc: configForm.cliente_ruc || null,
        contacto_id: configForm.contacto_id || null,
        lugar_trabajo: configForm.lugar_trabajo || null,
        plazo_dias: configForm.plazo_dias ? parseInt(configForm.plazo_dias) : null,
        validez_dias: parseInt(configForm.validez_dias) || 30,
        notas: configForm.notas || null,
        notas_comerciales: configForm.notas_comerciales || null,
      };
      const updated = await apiFetch(`/cotizaciones/planes/${planId}/config`, { method: "PUT", body: JSON.stringify(payload) });
      setConfig(updated);
      setShowConfig(false);
      await refreshResumen();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  // ── Exportar ─────────────────────────────────────────────────────────────────

  async function handleExport(format) {
    setExporting(format);
    try {
      const res = await fetch(`${API}/cotizaciones/planes/${planId}/export/${format}`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (!res.ok) throw new Error("Error al generar el archivo");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `cotizacion_${plan?.code ?? planId}.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
    finally { setExporting(""); }
  }

  // ── Auto-completar precio al seleccionar MO ──────────────────────────────────

  function onMOSelect(moId) {
    const mo = recursosMO.find(m => m.id === moId);
    setApuForm(f => ({
      ...f,
      recurso_mo_id: moId,
      precio_unitario: mo ? String(mo.tarifa_hora) : f.precio_unitario,
      unidad: mo ? mo.unidad : f.unidad,
    }));
  }

  function onMaterialSelect(matId) {
    const mat = materiales.find(m => m.id === matId);
    setApuForm(f => ({
      ...f,
      material_id: matId,
      precio_unitario: mat?.unit_cost ? String(mat.unit_cost) : f.precio_unitario,
      unidad: mat?.unit ?? f.unidad,
    }));
  }

  if (loading) return <Layout><div style={{ padding: 60, textAlign: "center", color: "#9CA3AF" }}>Cargando presupuesto...</div></Layout>;

  const capitulos = partidas.filter(p => p.es_capitulo);
  const monedaSym = config?.moneda === "USD" ? "$" : "S/";

  const STATUS_META = {
    BORRADOR:  { bg: "#F3F4F6", text: "#6B7280",  label: "Borrador",  actions: [{ label: "Enviar al Cliente", next: "ENVIADA", color: "#1D4ED8" }] },
    ENVIADA:   { bg: "#DBEAFE", text: "#1D4ED8",  label: "Enviada",   actions: [{ label: "Marcar Aprobada", next: "APROBADA", color: "#059669" }, { label: "Rechazada", next: "RECHAZADA", color: "#DC2626" }] },
    APROBADA:  { bg: "#D1FAE5", text: "#065F46",  label: "Aprobada",  actions: [] },
    RECHAZADA: { bg: "#FEE2E2", text: "#991B1B",  label: "Rechazada", actions: [{ label: "Reabrir Borrador", next: "BORRADOR", color: "#6B7280" }] },
    EXPIRADA:  { bg: "#FEF3C7", text: "#92400E",  label: "Expirada",  actions: [{ label: "Reabrir Borrador", next: "BORRADOR", color: "#6B7280" }] },
  };
  const statusInfo = STATUS_META[config?.status || "BORRADOR"];

  return (
    <Layout>
      {/* Modal: Proponer material nuevo */}
      {showProponer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: PRIMARY }}>Proponer nuevo material</h3>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#6B7280" }}>
              El material quedará en estado <strong>PENDIENTE</strong> hasta que Logística lo valide y registre correctamente.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Nombre del material *</label>
                <input
                  autoFocus
                  value={proponerForm.nombre}
                  onChange={e => setProponerForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Cable THW 14AWG"
                  style={{ width: "100%", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Unidad</label>
                <input
                  value={proponerForm.unidad}
                  onChange={e => setProponerForm(f => ({ ...f, unidad: e.target.value }))}
                  placeholder="UND, ML, KG..."
                  style={{ width: "100%", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Categoría</label>
                <select
                  value={proponerForm.categoria}
                  onChange={e => setProponerForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ width: "100%", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
                >
                  {["Material", "Consumible", "Repuesto", "Herramienta", "Equipo", "EPP"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Precio referencial (S/)</label>
                <input
                  type="number" min="0" step="any"
                  value={proponerForm.precio_referencia}
                  onChange={e => setProponerForm(f => ({ ...f, precio_referencia: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: "100%", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Proveedor referencial</label>
                <input
                  value={proponerForm.proveedor_referencia}
                  onChange={e => setProponerForm(f => ({ ...f, proveedor_referencia: e.target.value }))}
                  placeholder="Nombre del proveedor donde cotizaste"
                  style={{ width: "100%", border: "1.5px solid #D1D5DB", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", marginBottom: 18, fontSize: 12, color: "#854D0E" }}>
              Logística recibirá una alerta para validar este material y completar los datos del proveedor.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowProponer(false)} disabled={proponiendo}
                style={{ background: "#F3F4F6", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                Cancelar
              </button>
              <button onClick={confirmarProponer} disabled={proponiendo || !proponerForm.nombre.trim()}
                style={{ background: proponiendo || !proponerForm.nombre.trim() ? "#9CA3AF" : "#EAB308", border: "none", borderRadius: 9, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "white" }}>
                {proponiendo ? "Proponiendo..." : "Proponer material"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button onClick={() => navigate(`/operations/plans/${planId}`)} style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 4 }}>
            ← Volver al plan
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, margin: 0 }}>
              Presupuesto / Cotización
            </h1>
            {config && (
              <span style={{ background: statusInfo.bg, color: statusInfo.text, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                {statusInfo.label}
              </span>
            )}
            {config?.numero_cotizacion && (
              <span style={{ background: LIGHT, color: ACCENT, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700, border: `1px solid ${ACCENT}30` }}>
                {config.numero_cotizacion}
              </span>
            )}
          </div>
          {plan && <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>{plan.code} — {plan.title}</p>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Botones de ciclo comercial */}
          {statusInfo.actions.map(a => (
            <button key={a.next} onClick={() => handleStatusChange(a.next)} disabled={changingStatus}
              style={{ background: a.color, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: changingStatus ? 0.7 : 1 }}>
              {changingStatus ? "..." : a.label}
            </button>
          ))}
          <button onClick={openConfig} style={btnSecondary}>⚙ Configurar</button>
          <button onClick={() => openNewPartida(true)} style={btnSecondary}>+ Capítulo</button>
          <button onClick={() => openNewPartida(false)} style={btnSecondary}>+ Partida</button>
          <button onClick={() => handleExport("pdf")} disabled={exporting === "pdf"} style={{ ...btnAction, background: "#DC2626" }}>
            {exporting === "pdf" ? "Generando..." : "⬇ PDF"}
          </button>
          <button onClick={() => handleExport("excel")} disabled={exporting === "excel"} style={{ ...btnAction, background: "#16A34A" }}>
            {exporting === "excel" ? "Generando..." : "⬇ Excel"}
          </button>
        </div>
      </div>

      {/* Banner de estado */}
      {config?.status === "APROBADA" && (
        <div style={{ background: "#D1FAE5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: "#065F46", fontSize: 14 }}>Cotización Aprobada por el cliente</div>
            <div style={{ fontSize: 12, color: "#059669" }}>
              {config.numero_cotizacion} · Aprobada el {config.fecha_respuesta ? new Date(config.fecha_respuesta).toLocaleDateString("es-PE") : "—"}
              · Ya puedes crear las Órdenes de Trabajo desde el plan
            </div>
          </div>
        </div>
      )}
      {config?.status === "ENVIADA" && (
        <div style={{ background: "#DBEAFE", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>📤</span>
          <div>
            <div style={{ fontWeight: 700, color: "#1D4ED8", fontSize: 14 }}>Cotización enviada al cliente — esperando respuesta</div>
            <div style={{ fontSize: 12, color: "#2563EB" }}>
              {config.numero_cotizacion} · Enviada el {config.fecha_envio ? new Date(config.fecha_envio).toLocaleDateString("es-PE") : "—"}
              {config.validez_dias ? ` · Válida por ${config.validez_dias} días` : ""}
            </div>
          </div>
        </div>
      )}

      {/* Layout 2 columnas */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Columna izquierda: partidas */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Info cliente */}
          {config && (
            <div style={{ background: LIGHT, border: `1px solid ${ACCENT}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <span><b style={{ color: PRIMARY }}>Cliente:</b> {config.cliente_nombre || "—"}</span>
                <span><b style={{ color: PRIMARY }}>RUC:</b> {config.cliente_ruc || "—"}</span>
                <span><b style={{ color: PRIMARY }}>Lugar:</b> {config.lugar_trabajo || "—"}</span>
                <span><b style={{ color: PRIMARY }}>Plazo:</b> {config.plazo_dias ? `${config.plazo_dias} días` : "—"}</span>
              </div>
            </div>
          )}

          {/* Tabla de partidas */}
          {partidas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF", border: "2px dashed #E5E7EB", borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontWeight: 600 }}>Sin partidas</p>
              <p style={{ fontSize: 13 }}>Agrega un capítulo o partida para comenzar el presupuesto</p>
            </div>
          ) : (
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              {/* Encabezado tabla */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px 80px 90px 90px 80px", background: PRIMARY, padding: "10px 14px" }}>
                {["Ítem", "Descripción", "Und", "Cant.", "P.U. APU", "Parcial", ""].map(h => (
                  <div key={h} style={{ color: "white", fontWeight: 700, fontSize: 12 }}>{h}</div>
                ))}
              </div>

              {partidas.map((p) => {
                const isOpen = activePartida === p.id;
                const items  = apuItems[p.id] || [];

                if (p.es_capitulo) {
                  return (
                    <div key={p.id}>
                      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px 80px 90px 90px 80px", padding: "10px 14px", background: "#1a4a52", alignItems: "center" }}>
                        <div style={{ color: "#B8E3E9", fontWeight: 700, fontSize: 12 }}>{p.codigo}</div>
                        <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{p.descripcion.toUpperCase()}</div>
                        <div /><div /><div /><div />
                        <div style={{ display: "flex", gap: 6 }}>
                          <ActionBtn onClick={() => openEditPartida(p)} label="✏" color="#B8E3E9" />
                          <ActionBtn onClick={() => deletePartida(p.id)} label="✕" color="#F87171" />
                        </div>
                      </div>
                    </div>
                  );
                }

                const parcial = p.cantidad * p.precio_unitario_apu;

                return (
                  <div key={p.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <div
                      style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px 80px 90px 90px 80px", padding: "10px 14px", background: isOpen ? LIGHT : "white", cursor: "pointer", alignItems: "center" }}
                      onClick={() => togglePartida(p.id)}
                    >
                      <div style={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>{p.codigo}</div>
                      <div style={{ fontSize: 13, color: "#1F2937" }}>{p.descripcion}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{p.unidad}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{p.cantidad.toFixed(3)}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{monedaSym} {p.precio_unitario_apu.toFixed(2)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: parcial > 0 ? "#059669" : "#9CA3AF" }}>{monedaSym} {parcial.toFixed(2)}</div>
                      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                        <ActionBtn onClick={() => openEditPartida(p)} label="✏" color={ACCENT} />
                        <ActionBtn onClick={() => deletePartida(p.id)} label="✕" color="#EF4444" />
                      </div>
                    </div>

                    {/* Panel APU expandido */}
                    {isOpen && (
                      <div style={{ background: "#F9FAFB", borderTop: "1px solid #E5E7EB", padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            APU — Análisis de Precios Unitarios
                          </span>
                          <button onClick={() => openApuEditor(p)} style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            + Agregar ítems
                          </button>
                        </div>

                        {items.length === 0 ? (
                          <p style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", padding: "12px 0" }}>Sin ítems APU — agrega materiales, mano de obra o equipos</p>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#E5E7EB" }}>
                                {["Tipo", "Descripción", "Und", "Cantidad", "P.U.", "Subtotal", ""].map(h => (
                                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#374151", fontWeight: 600 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(item => (
                                <tr key={item.id} style={{ borderBottom: "1px solid #E5E7EB", background: "white" }}>
                                  <td style={{ padding: "7px 10px" }}>
                                    {(() => { const { catColor, catBg, catLabel } = buildCatHelpers(categorias); return (
                                      <span style={{ background: catBg(item.tipo_recurso), color: catColor(item.tipo_recurso), borderRadius: 5, padding: "2px 7px", fontWeight: 600, fontSize: 11 }}>
                                        {catLabel(item.tipo_recurso)}
                                      </span>
                                    ); })()}
                                  </td>
                                  <td style={{ padding: "7px 10px", color: "#1F2937" }}>
                                    {item.material_nombre || item.recurso_mo_codigo || item.descripcion || "—"}
                                  </td>
                                  <td style={{ padding: "7px 10px", color: "#6B7280" }}>{item.unidad || "—"}</td>
                                  <td style={{ padding: "7px 10px" }}>{parseFloat(item.cantidad).toFixed(4)}</td>
                                  <td style={{ padding: "7px 10px" }}>{monedaSym} {parseFloat(item.precio_unitario).toFixed(2)}</td>
                                  <td style={{ padding: "7px 10px", fontWeight: 700, color: "#059669" }}>{monedaSym} {parseFloat(item.subtotal).toFixed(2)}</td>
                                  <td style={{ padding: "7px 10px" }}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <ActionBtn onClick={() => openEditApu(item, p.id)} label="✏" color={ACCENT} />
                                      <ActionBtn onClick={() => deleteApu(p.id, item.id)} label="✕" color="#EF4444" />
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
        </div>

        {/* Columna derecha: resumen económico */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", position: "sticky", top: 80 }}>
            <div style={{ background: PRIMARY, padding: "14px 16px" }}>
              <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>Resumen Económico</div>
              <div style={{ color: "#B8E3E9", fontSize: 11, marginTop: 2 }}>{monedaSym} — {config?.moneda ?? "PEN"}</div>
            </div>
            <div style={{ padding: 16 }}>
              {resumen && (
                <>
                  <ResumenRow label="Costo Directo" value={resumen.costo_directo} sym={monedaSym} />
                  <ResumenRow label={`GG (${resumen.gastos_generales_pct}%)`} value={resumen.gastos_generales} sym={monedaSym} muted />
                  <ResumenRow label={`Utilidad (${resumen.utilidad_pct}%)`} value={resumen.utilidad} sym={monedaSym} muted />
                  <div style={{ borderTop: "1px solid #E5E7EB", margin: "10px 0" }} />
                  <ResumenRow label="Valor Venta" value={resumen.valor_venta} sym={monedaSym} bold />
                  <ResumenRow label={`IGV (${resumen.igv_pct}%)`} value={resumen.igv} sym={monedaSym} muted />
                  <div style={{ background: PRIMARY, borderRadius: 10, padding: "12px 14px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#B8E3E9", fontWeight: 700, fontSize: 13 }}>PRECIO TOTAL</span>
                    <span style={{ color: "white", fontWeight: 900, fontSize: 16 }}>{monedaSym} {resumen.precio_total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => handleExport("pdf")} disabled={exporting === "pdf"} style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 9, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", opacity: exporting === "pdf" ? 0.7 : 1 }}>
                {exporting === "pdf" ? "Generando PDF..." : "⬇ Exportar PDF"}
              </button>
              <button onClick={() => handleExport("excel")} disabled={exporting === "excel"} style={{ background: "#16A34A", color: "white", border: "none", borderRadius: 9, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", opacity: exporting === "excel" ? 0.7 : 1 }}>
                {exporting === "excel" ? "Generando Excel..." : "⬇ Exportar Excel"}
              </button>
              <button onClick={openConfig} style={{ background: LIGHT, color: PRIMARY, border: `1px solid ${ACCENT}40`, borderRadius: 9, padding: "8px", fontWeight: 600, fontSize: 12, cursor: "pointer", width: "100%" }}>
                ⚙ Configurar presupuesto
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Partida ─────────────────────────────────────────────────────── */}
      {showPartidaModal && (
        <Modal title={editingPartida ? (editingPartida.es_capitulo ? "Editar Capítulo" : "Editar Partida") : (partidaForm.es_capitulo ? "Nuevo Capítulo" : "Nueva Partida")}
          onClose={() => setShowPartidaModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <FieldRow label="Código">
                <input value={partidaForm.codigo} onChange={e => setPartidaForm(f => ({ ...f, codigo: e.target.value }))} placeholder="01.01" style={inp()} />
              </FieldRow>
              <FieldRow label="Orden">
                <input type="number" value={partidaForm.orden} onChange={e => setPartidaForm(f => ({ ...f, orden: e.target.value }))} style={inp()} />
              </FieldRow>
            </div>
            <FieldRow label="Descripción">
              <input value={partidaForm.descripcion} onChange={e => setPartidaForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción de la partida..." style={inp()} />
            </FieldRow>
            {!partidaForm.es_capitulo && (
              <div style={{ display: "flex", gap: 12 }}>
                <FieldRow label="Unidad">
                  <select value={partidaForm.unidad} onChange={e => setPartidaForm(f => ({ ...f, unidad: e.target.value }))} style={inp()}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Cantidad">
                  <input type="number" min="0" step="0.001" value={partidaForm.cantidad} onChange={e => setPartidaForm(f => ({ ...f, cantidad: e.target.value }))} style={inp()} />
                </FieldRow>
              </div>
            )}
            {!editingPartida && capitulos.length > 0 && !partidaForm.es_capitulo && (
              <FieldRow label="Capítulo padre (opcional)">
                <select value={partidaForm.parent_id} onChange={e => setPartidaForm(f => ({ ...f, parent_id: e.target.value }))} style={inp()}>
                  <option value="">— Sin capítulo —</option>
                  {capitulos.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>)}
                </select>
              </FieldRow>
            )}
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 10 }}>{error}</p>}
          <ModalFooter onCancel={() => setShowPartidaModal(false)} onSave={savePartida} saving={saving} />
        </Modal>
      )}

      {/* ── Modal APU ────────────────────────────────────────────────────────── */}
      {showApuModal && (
        <Modal title={editingApu ? "Editar Ítem APU" : "Nuevo Ítem APU"} onClose={() => setShowApuModal(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow label="Tipo de Recurso">
              {(() => {
                const { catColor, catBg } = buildCatHelpers(categorias);
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {categorias.map(cat => (
                      <button key={cat.codigo}
                        onClick={() => setApuForm(f => ({ ...f, tipo_recurso: cat.codigo, material_id: "", recurso_mo_id: "" }))}
                        style={{ padding: "7px 12px", borderRadius: 8, border: `2px solid ${apuForm.tipo_recurso === cat.codigo ? catColor(cat.codigo) : "#E5E7EB"}`, background: apuForm.tipo_recurso === cat.codigo ? catBg(cat.codigo) : "white", color: apuForm.tipo_recurso === cat.codigo ? catColor(cat.codigo) : "#6B7280", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                        {cat.nombre}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </FieldRow>

            {apuForm.tipo_recurso === "MO" ? (
              <FieldRow label="Recurso de Mano de Obra">
                <select value={apuForm.recurso_mo_id} onChange={e => onMOSelect(e.target.value)} style={inp()}>
                  <option value="">— Seleccionar recurso MO —</option>
                  {recursosMO.map(m => <option key={m.id} value={m.id}>{m.codigo} — {m.descripcion} (S/ {m.tarifa_hora}/{m.unidad})</option>)}
                </select>
              </FieldRow>
            ) : (
              <FieldRow label="Material del catálogo (opcional)">
                <select value={apuForm.material_id} onChange={e => onMaterialSelect(e.target.value)} style={inp()}>
                  <option value="">— Seleccionar del catálogo (opcional) —</option>
                  {materiales.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit ?? ""})</option>)}
                </select>
              </FieldRow>
            )}

            <FieldRow label="Descripción libre (si no seleccionó del catálogo)">
              <input value={apuForm.descripcion} onChange={e => setApuForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción manual..." style={inp()} />
            </FieldRow>

            <div style={{ display: "flex", gap: 12 }}>
              <FieldRow label="Unidad">
                <input value={apuForm.unidad} onChange={e => setApuForm(f => ({ ...f, unidad: e.target.value }))} placeholder="HH, UND, KG..." style={inp()} />
              </FieldRow>
              <FieldRow label="Cantidad">
                <input type="number" min="0" step="0.0001" value={apuForm.cantidad} onChange={e => setApuForm(f => ({ ...f, cantidad: e.target.value }))} style={inp()} />
              </FieldRow>
              <FieldRow label="Precio Unitario (S/)">
                <input type="number" min="0" step="0.01" value={apuForm.precio_unitario} onChange={e => setApuForm(f => ({ ...f, precio_unitario: e.target.value }))} style={inp()} />
              </FieldRow>
            </div>

            {apuForm.cantidad && apuForm.precio_unitario && (
              <div style={{ background: LIGHT, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Subtotal:</span>
                <span style={{ fontWeight: 800, color: PRIMARY, fontSize: 14 }}>
                  {monedaSym} {(parseFloat(apuForm.cantidad || 0) * parseFloat(apuForm.precio_unitario || 0)).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 10 }}>{error}</p>}
          <ModalFooter onCancel={() => setShowApuModal(false)} onSave={saveApu} saving={saving} />
        </Modal>
      )}

      {/* ── Editor APU Multi-row ────────────────────────────────────────────── */}
      {showApuEditor && editorPartida && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "24px 16px", overflowY: "auto" }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 960, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
            {/* Header */}
            <div style={{ background: PRIMARY, borderRadius: "16px 16px 0 0", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#B8E3E9", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Editor APU</div>
                <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 2 }}>
                  {editorPartida.codigo} — {editorPartida.descripcion}
                </div>
              </div>
              <button onClick={() => setShowApuEditor(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Ítems existentes */}
              {(apuItems[editorPartida.id] || []).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Ítems ya guardados ({(apuItems[editorPartida.id] || []).length})
                  </div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB" }}>
                          {["Tipo", "Recurso / Descripción", "Und", "Cant", "P.U.", "Subtotal", ""].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#374151", fontWeight: 600, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(apuItems[editorPartida.id] || []).map(item => (
                          <tr key={item.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "7px 12px" }}>
                              {(() => { const { catColor, catBg } = buildCatHelpers(categorias); return (
                                <span style={{ background: catBg(item.tipo_recurso), color: catColor(item.tipo_recurso), borderRadius: 4, padding: "2px 7px", fontWeight: 700, fontSize: 10 }}>
                                  {item.tipo_recurso}
                                </span>
                              ); })()}
                            </td>
                            <td style={{ padding: "7px 12px", color: "#1F2937" }}>{item.material_nombre || item.recurso_mo_codigo || item.descripcion || "—"}</td>
                            <td style={{ padding: "7px 12px", color: "#6B7280" }}>{item.unidad}</td>
                            <td style={{ padding: "7px 12px" }}>{parseFloat(item.cantidad).toFixed(3)}</td>
                            <td style={{ padding: "7px 12px" }}>{monedaSym} {parseFloat(item.precio_unitario).toFixed(2)}</td>
                            <td style={{ padding: "7px 12px", fontWeight: 700, color: "#059669" }}>{monedaSym} {parseFloat(item.subtotal).toFixed(2)}</td>
                            <td style={{ padding: "7px 12px" }}>
                              <button onClick={() => { openEditApu(item, editorPartida.id); setShowApuEditor(false); }} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13 }}>✏</button>
                              <button onClick={async () => { await deleteApu(editorPartida.id, item.id); }} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 13 }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Agregar nuevos ítems */}
              <div style={{ borderTop: "2px dashed #E5E7EB", paddingTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>Nuevos ítems a agregar</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Insertar Baúl */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowBaulPicker(v => !v)}
                        style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Insertar Baúl ▾
                      </button>
                      {showBaulPicker && (
                        <div style={{ position: "absolute", top: "100%", right: 0, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, zIndex: 10, minWidth: 300, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Seleccionar baúl</div>
                          {baules.length === 0 ? (
                            <p style={{ fontSize: 12, color: "#9CA3AF" }}>No hay baúles creados. Ve a <strong>Cotizaciones → Baúles</strong> para crear uno.</p>
                          ) : (
                            <>
                              <select
                                value={selectedBaul || ""}
                                onChange={e => setSelectedBaul(e.target.value)}
                                style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 7, padding: "7px 10px", fontSize: 12, marginBottom: 8 }}
                              >
                                <option value="">— Elegir baúl —</option>
                                {baules.map(b => (
                                  <option key={b.id} value={b.id}>{b.nombre} ({b.items?.length ?? 0} ítems) · {b.categoria}</option>
                                ))}
                              </select>
                              {selectedBaul && (
                                <div style={{ marginBottom: 8 }}>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Multiplicador (¿cuántas unidades del baúl?)</label>
                                  <input
                                    type="number" min="0.01" step="0.01" value={baulMultiplier}
                                    onChange={e => setBaulMultiplier(e.target.value)}
                                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 7, padding: "7px 10px", fontSize: 12 }}
                                  />
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button onClick={() => setShowBaulPicker(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                                <button onClick={insertBaul} disabled={!selectedBaul} style={{ background: "#16A34A", color: "white", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: selectedBaul ? 1 : 0.5 }}>
                                  Insertar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={addEmptyRow} style={{ background: LIGHT, color: PRIMARY, border: `1px solid ${ACCENT}40`, borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      + Nueva fila
                    </button>
                  </div>
                </div>

                {/* Tabla de nuevas filas */}
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#EEF7F8" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", color: "#374151", fontWeight: 600, width: 100 }}>Tipo</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", color: "#374151", fontWeight: 600 }}>Recurso / Descripción</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", color: "#374151", fontWeight: 600, width: 70 }}>Und</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", color: "#374151", fontWeight: 600, width: 90 }}>Cantidad</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", color: "#374151", fontWeight: 600, width: 100 }}>P. Unitario</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", color: "#374151", fontWeight: 600, width: 90 }}>Subtotal</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newApuRows.map(row => {
                        const sub = (parseFloat(row.cantidad) || 0) * (parseFloat(row.precio_unitario) || 0);
                        return (
                          <tr key={row._key} style={{ borderTop: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "6px 8px" }}>
                              {(() => {
                                const { catColor, catBg } = buildCatHelpers(categorias);
                                return (
                                  <select
                                    value={row.tipo_recurso}
                                    onChange={e => updateRow(row._key, "tipo_recurso", e.target.value)}
                                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 6px", fontSize: 11, background: catBg(row.tipo_recurso), color: catColor(row.tipo_recurso), fontWeight: 700 }}
                                  >
                                    {categorias.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                                  </select>
                                );
                              })()}
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              {row.tipo_recurso === "MO" ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  {/* Selector de rol de la matriz */}
                                  <select
                                    value={row.tp_rol}
                                    onChange={e => {
                                      updateRow(row._key, "tp_rol", e.target.value);
                                      fetchTarifaForRow(row._key, e.target.value, row.tp_contexto, row.tp_ubicacion, row.tp_modalidad);
                                    }}
                                    style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 6px", fontSize: 11, fontWeight: 600 }}
                                  >
                                    <option value="">— Rol de personal —</option>
                                    {rolesPersonal.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                  {/* Contexto / Ubicación / Modalidad */}
                                  <div style={{ display: "flex", gap: 3 }}>
                                    {[
                                      { field: "tp_contexto",  opts: CONTEXTOS },
                                      { field: "tp_ubicacion", opts: UBICACIONES },
                                      { field: "tp_modalidad", opts: MODALIDADES },
                                    ].map(({ field, opts }) => (
                                      <select key={field}
                                        value={row[field]}
                                        onChange={e => {
                                          const next = { ...row, [field]: e.target.value };
                                          updateRow(row._key, field, e.target.value);
                                          if (next.tp_rol) fetchTarifaForRow(row._key, next.tp_rol, next.tp_contexto, next.tp_ubicacion, next.tp_modalidad);
                                        }}
                                        style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 5, padding: "3px 4px", fontSize: 10 }}
                                      >
                                        {opts.map(o => <option key={o}>{o}</option>)}
                                      </select>
                                    ))}
                                  </div>
                                  {/* Badge de tarifa encontrada */}
                                  {row.tp_rol && (
                                    <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                                      background: row.tp_tarifa ? "#D1FAE5" : "#FEF3C7",
                                      color: row.tp_tarifa ? "#059669" : "#92400E" }}>
                                      {row.tp_tarifa
                                        ? `✓ ${monedaSym}${Number(row.tp_tarifa.tarifa).toFixed(2)}/${row.tp_tarifa.modalidad}${row.tp_tarifa._fallback ? " (general)" : ""}`
                                        : "⚠ Sin tarifa — precio manual"}
                                    </div>
                                  )}
                                  {/* Fallback: selector recurso MO legacy */}
                                  {!row.tp_rol && (
                                    <select value={row.recurso_mo_id} onChange={e => updateRow(row._key, "recurso_mo_id", e.target.value)}
                                      style={{ width: "100%", border: "1px dashed #D1D5DB", borderRadius: 6, padding: "4px 6px", fontSize: 10, color: "#6B7280" }}>
                                      <option value="">— O seleccionar recurso MO legacy —</option>
                                      {recursosMO.map(m => <option key={m.id} value={m.id}>{m.codigo} · {m.descripcion}</option>)}
                                    </select>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                                  <select value={row.material_id} onChange={e => updateRow(row._key, "material_id", e.target.value)}
                                    style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 6px", fontSize: 11 }}>
                                    <option value="">— Catálogo (opcional) —</option>
                                    {materiales.map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.name}{m.estado === "PENDIENTE" ? " ⚠" : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => openProponerModal(row._key)}
                                    title="Proponer nuevo material al catálogo"
                                    style={{ background: "#FEF9C3", border: "1px solid #FDE68A", color: "#854D0E", borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                                  >
                                    + Proponer
                                  </button>
                                </div>
                              )}
                              <input
                                placeholder="Descripción libre..."
                                value={row.descripcion}
                                onChange={e => updateRow(row._key, "descripcion", e.target.value)}
                                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 6px", fontSize: 11, boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input value={row.unidad} onChange={e => updateRow(row._key, "unidad", e.target.value)}
                                placeholder="UND" style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 6px", fontSize: 11 }} />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input type="number" min="0" step="0.001" value={row.cantidad} onChange={e => updateRow(row._key, "cantidad", e.target.value)}
                                style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 6px", fontSize: 11 }} />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input type="number" min="0" step="0.01" value={row.precio_unitario} onChange={e => updateRow(row._key, "precio_unitario", e.target.value)}
                                style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 6px", fontSize: 11 }} />
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: sub > 0 ? "#059669" : "#9CA3AF", whiteSpace: "nowrap" }}>
                              {monedaSym} {sub.toFixed(2)}
                            </td>
                            <td style={{ padding: "6px 4px" }}>
                              <button onClick={() => removeRow(row._key)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total preview */}
                {newApuRows.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>
                      Total nuevos: <strong style={{ color: PRIMARY }}>
                        {monedaSym} {newApuRows.reduce((s, r) => s + (parseFloat(r.cantidad) || 0) * (parseFloat(r.precio_unitario) || 0), 0).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                )}

                {error && <p style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{error}</p>}

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                  <button onClick={addEmptyRow} style={{ background: "none", color: ACCENT, border: `1px dashed ${ACCENT}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
                    + agregar otra fila
                  </button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowApuEditor(false)} style={{ background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      Cerrar
                    </button>
                    <button onClick={saveBulkApu} disabled={savingBulk} style={{ background: PRIMARY, color: "white", border: "none", borderRadius: 9, padding: "9px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: savingBulk ? 0.7 : 1 }}>
                      {savingBulk ? "Guardando..." : `Guardar ${newApuRows.filter(r => r.descripcion || r.material_id || r.recurso_mo_id).length} ítem(s)`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Configuración ──────────────────────────────────────────────── */}
      {showConfig && (
        <Modal title="Configuración del Presupuesto" onClose={() => setShowConfig(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>Estos valores se reflejan en el resumen económico y en el PDF/Excel exportado.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <FieldRow label="GG (%)"><input type="number" step="0.01" value={configForm.gastos_generales_pct} onChange={e => setConfigForm(f => ({ ...f, gastos_generales_pct: e.target.value }))} style={inp()} /></FieldRow>
              <FieldRow label="Utilidad (%)"><input type="number" step="0.01" value={configForm.utilidad_pct} onChange={e => setConfigForm(f => ({ ...f, utilidad_pct: e.target.value }))} style={inp()} /></FieldRow>
              <FieldRow label="IGV (%)"><input type="number" step="0.01" value={configForm.igv_pct} onChange={e => setConfigForm(f => ({ ...f, igv_pct: e.target.value }))} style={inp()} /></FieldRow>
              <FieldRow label="Moneda">
                <select value={configForm.moneda} onChange={e => setConfigForm(f => ({ ...f, moneda: e.target.value }))} style={inp()}>
                  <option value="PEN">PEN (S/)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </FieldRow>
            </div>
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8 }}>Datos del cliente</p>
              <FieldRow label="Vincular cliente del catálogo">
                <select value={configForm.cliente_id || ""} onChange={e => onClienteSelect(e.target.value)} style={inp()}>
                  <option value="">— Sin vincular (ingresar manualmente) —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razon_social}{c.ruc ? ` · RUC ${c.ruc}` : ""}
                    </option>
                  ))}
                </select>
              </FieldRow>
              {configForm.cliente_id && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Persona de contacto
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={configForm.contacto_id || ""}
                      onChange={e => setConfigForm(f => ({ ...f, contacto_id: e.target.value }))}
                      style={{ ...inp(), flex: 1 }}
                    >
                      <option value="">— Seleccionar contacto —</option>
                      {(clientes.find(c => c.id === configForm.cliente_id)?.contactos || []).map(cc => (
                        <option key={cc.id} value={cc.id}>
                          {cc.nombre} {cc.cargo ? `(${cc.cargo})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setContactError(""); setShowAddContact(true); }}
                      style={{
                        background: LIGHT,
                        color: PRIMARY,
                        border: `1px solid ${ACCENT}40`,
                        borderRadius: 8,
                        padding: "0 14px",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      + Nuevo
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <FieldRow label="Nombre del cliente"><input value={configForm.cliente_nombre} onChange={e => setConfigForm(f => ({ ...f, cliente_nombre: e.target.value }))} style={inp()} /></FieldRow>
                <FieldRow label="RUC"><input value={configForm.cliente_ruc} onChange={e => setConfigForm(f => ({ ...f, cliente_ruc: e.target.value }))} style={inp()} /></FieldRow>
              </div>
              <FieldRow label="Lugar de trabajo"><input value={configForm.lugar_trabajo} onChange={e => setConfigForm(f => ({ ...f, lugar_trabajo: e.target.value }))} style={inp()} /></FieldRow>
              <div style={{ display: "flex", gap: 12 }}>
                <FieldRow label="Plazo (días)"><input type="number" value={configForm.plazo_dias} onChange={e => setConfigForm(f => ({ ...f, plazo_dias: e.target.value }))} style={inp()} /></FieldRow>
                <FieldRow label="Validez cotización (días)"><input type="number" value={configForm.validez_dias} onChange={e => setConfigForm(f => ({ ...f, validez_dias: e.target.value }))} style={inp()} /></FieldRow>
              </div>
              <FieldRow label="Notas técnicas / condiciones">
                <textarea value={configForm.notas} onChange={e => setConfigForm(f => ({ ...f, notas: e.target.value }))} rows={2} style={{ ...inp(), resize: "vertical" }} />
              </FieldRow>
              <FieldRow label="Notas comerciales (internas)">
                <textarea value={configForm.notas_comerciales} onChange={e => setConfigForm(f => ({ ...f, notas_comerciales: e.target.value }))} rows={2} style={{ ...inp(), resize: "vertical" }} placeholder="Negociaciones, condiciones especiales, historial comercial..." />
              </FieldRow>
            </div>
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 10 }}>{error}</p>}
          <ModalFooter onCancel={() => setShowConfig(false)} onSave={saveConfig} saving={saving} saveLabel="Guardar configuración" />
        </Modal>
      )}

      {/* Modal Inline Agregar Contacto */}
      {showAddContact && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: PRIMARY, marginTop: 0, marginBottom: 4 }}>
              Nuevo Contacto de Empresa
            </h3>
            <p style={{ color: "#6B7280", fontSize: 11, margin: "0 0 16px" }}>
              Registra una persona de contacto para {clientes.find(c => c.id === configForm.cliente_id)?.razon_social}
            </p>

            {contactError && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{contactError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Nombre Completo *", key: "nombre" },
                { label: "Cargo / Puesto", key: "cargo" },
                { label: "Teléfono", key: "telefono" },
                { label: "Correo Electrónico", key: "email" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 }}>{label}</label>
                  <input
                    value={contactForm[key] || ""}
                    onChange={e => setContactForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inp()}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddContact(false)} style={{ background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleAddContactInline} disabled={addingContact} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: addingContact ? "not-allowed" : "pointer", opacity: addingContact ? 0.7 : 1 }}>
                {addingContact ? "Registrando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: wide ? 600 : 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0B2E33", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, saveLabel = "Guardar" }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
      <button onClick={onCancel} style={{ background: "#F3F4F6", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{ background: "#0B2E33", color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Guardando..." : saveLabel}
      </button>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, label, color }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "2px 6px", borderRadius: 5 }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      {label}
    </button>
  );
}

function ResumenRow({ label, value, sym, muted = false, bold = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ fontSize: 12, color: muted ? "#9CA3AF" : "#374151", fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: bold ? 800 : 600, color: bold ? "#0B2E33" : (muted ? "#9CA3AF" : "#1F2937") }}>
        {sym} {parseFloat(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function inp() {
  return {
    border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none",
  };
}

const btnSecondary = {
  background: "white", border: "1px solid #D1D5DB", borderRadius: 9,
  padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151",
};
const btnAction = {
  color: "white", border: "none", borderRadius: 9,
  padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
};
