import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import ExportExcelButton from "../../components/ExportExcelButton";
import { apiFetch, BASE_URL } from "../../services/api";
import { useAuth, formatUsername } from "../../hooks/useAuth";

const PRIORIDADES = ["Alta", "Media", "Baja"];
const ESTADOS     = ["En Progreso", "En espera", "Retraso", "Completado", "Cancelado"];
const ETAPAS      = [
  "COTIZACIÓN", "COORDINACIÓN (OP)", "COORDINACIÓN (AD)",
  "EJECUCIÓN", "CIERRE", "FACTURACIÓN",
];

const PRIORIDAD_COLOR = { Alta: "#DC2626", Media: "#CA8A04", Baja: "#16A34A" };
const ESTADO_COLOR    = {
  "Completado":  "#16A34A",
  "Retraso":     "#DC2626",
  "En espera":   "#CA8A04",
  "En Progreso": "var(--primary)",
  "Cancelado":   "#6B7280",
};

// Cabeceras y anchos mínimos de columna
const COLS = [
  { label: "Acción",       minW: 55  },
  { label: "Item",         minW: 50  },
  { label: "Prioridad",    minW: 100 },
  { label: "Tarea ✱",      minW: 240 },
  { label: "Cliente",      minW: 150 },
  { label: "Contacto",     minW: 140 },
  { label: "F. Solicitud", minW: 112 },
  { label: "Responsable",  minW: 155 },
  { label: "Etapa",        minW: 165 },
  { label: "Estado",       minW: 120 },
  { label: "F. Límite",    minW: 112 },
  { label: "Seguimiento",  minW: 155 },
  { label: "Notas",        minW: 170 },
  { label: "Progreso",     minW: 80  },
];

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function ProgressBar({ pct }) {
  const p = Math.min(pct || 0, 100);
  return (
    <div style={{ background: "#E5E7EB", borderRadius: 99, height: 5 }}>
      <div style={{
        width: `${p}%`, height: "100%", borderRadius: 99,
        background: p >= 100 ? "#22C55E" : "var(--primary)", transition: "width 0.4s",
      }} />
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 3000,
      background: isErr ? "#FEE2E2" : "#DCFCE7",
      color: isErr ? "#DC2626" : "#15803D",
      border: `1px solid ${isErr ? "#FCA5A5" : "#86EFAC"}`,
      borderRadius: 12, padding: "12px 20px", fontSize: 13, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
    }}>
      {isErr ? "✗ " : "✓ "}{toast.msg}
    </div>
  );
}

const emptyRow = () => ({
  id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  prioridad: "Media", tarea: "", cliente: "", contacto: "",
  fecha_solicitud: new Date().toISOString().slice(0, 10), responsable_id: "", etapa: "",
  estado: "En Progreso", fecha_limite: "", seguimiento_id: "",
  responsables_ids: "", seguimientos_ids: "", contactos_ids: "",
  notas: "", progreso_pct: 0, subtareas: [],
  isNew: true, isDirty: false,
});

const CELL = {
  border: "none", background: "transparent", width: "100%",
  fontSize: 12, padding: "5px 6px", fontFamily: "inherit",
  color: "#111827", boxSizing: "border-box",
};

const COMPACT_INPUT = {
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "#192A2C",
  background: "#FFFFFF",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.15s ease",
};

function cleanTaskTitle(title, client) {
  if (!title) return "";
  let clean = title.trim();
  if (client) {
    const escapedClient = client.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^\\[${escapedClient}\\]\\s*`, 'i');
    if (regex.test(clean)) {
      return clean.replace(regex, "").trim();
    }
  }
  return clean.replace(/^\[[A-Za-z0-9_\-\s.]+\]\s*/, "").trim();
}

// ── Custom Dropdown MultiSelect para Usuarios ─────────────────────────────────
function MultiSelectUser({ selectedIds, users, onChange, placeholder = "Seleccionar..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedList = useMemo(() => {
    if (!selectedIds) return [];
    return selectedIds.split(",").map(id => id.trim()).filter(Boolean);
  }, [selectedIds]);

  const toggleUser = (id) => {
    let newList;
    if (selectedList.includes(id)) {
      newList = selectedList.filter(x => x !== id);
    } else {
      newList = [...selectedList, id];
    }
    onChange(newList.join(","));
  };

  const displayText = useMemo(() => {
    if (selectedList.length === 0) return placeholder;
    const names = selectedList.map(id => {
      const u = users.find(usr => usr.id === id);
      return u ? formatUsername(u.username) : "";
    }).filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.length} asignados`;
  }, [selectedList, users, placeholder]);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          border: "1px solid #D1D5DB", borderRadius: 8, padding: "5px 10px",
          fontSize: 12, background: "white", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", minHeight: 28,
          boxSizing: "border-box"
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: selectedList.length ? "#111827" : "#9CA3AF" }}>
          {displayText}
        </span>
        <span style={{ fontSize: 9, color: "#6B7280" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "white", border: "1px solid #D1D5DB", borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 180, overflowY: "auto",
          marginTop: 4, padding: "4px 0"
        }}>
          {users.map(u => {
            const checked = selectedList.includes(u.id);
            return (
              <label
                key={u.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                  fontSize: 12, cursor: "pointer", transition: "background 0.1s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleUser(u.id)}
                  style={{ width: 14, height: 14, cursor: "pointer" }}
                />
                <span style={{ color: "#374151", fontWeight: checked ? 700 : 400 }}>
                  {formatUsername(u.username)}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MultiSelect Contactos del Cliente ─────────────────────────────────────────
function MultiSelectContact({ selectedIds, contacts, onChange, placeholder = "Seleccionar contactos..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedList = useMemo(() => {
    if (!selectedIds) return [];
    return selectedIds.split(",").map(id => id.trim()).filter(Boolean);
  }, [selectedIds]);

  const toggleContact = (id) => {
    const newList = selectedList.includes(id)
      ? selectedList.filter(x => x !== id)
      : [...selectedList, id];
    onChange(newList.join(","));
  };

  const displayText = useMemo(() => {
    if (selectedList.length === 0) return placeholder;
    const names = selectedList.map(id => contacts.find(c => c.id === id)?.nombre).filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.length} contactos`;
  }, [selectedList, contacts, placeholder]);

  if (!contacts.length) {
    return (
      <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>Sin contactos</span>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div onClick={() => setOpen(!open)} style={{
        border: "1px solid #D1D5DB", borderRadius: 8, padding: "5px 10px",
        fontSize: 12, background: "white", cursor: "pointer", minHeight: 28,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selectedList.length ? "#111827" : "#9CA3AF" }}>
          {displayText}
        </span>
        <span style={{ fontSize: 9, color: "#6B7280" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "white", border: "1px solid #D1D5DB", borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 180, overflowY: "auto", marginTop: 4,
        }}>
          {contacts.map(c => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={selectedList.includes(c.id)} onChange={() => toggleContact(c.id)} />
              <span>{c.nombre}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Menú de 3 puntos (Opciones de Fila) ────────────────────────────────────────
function RowActionsMenu({ row, onEdit, onDuplicate, onCarryOver, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 16,
          color: "#6B7280", padding: "4px 8px", borderRadius: 4, transition: "background 0.1s"
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#E5E7EB"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}
      >
        ⋮
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, zIndex: 100,
          background: "white", border: "1px solid #E5E7EB", borderRadius: 8,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
          minWidth: 165, marginTop: 4, overflow: "hidden", display: "flex", flexDirection: "column",
          textAlign: "left"
        }}>
          <button
            onClick={() => { onEdit(row); setOpen(false); }}
            style={{ border: "none", background: "none", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", color: "#374151" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            ✏️ Editar en Formulario
          </button>
          <button
            onClick={() => { onDuplicate(row); setOpen(false); }}
            style={{ border: "none", background: "none", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", color: "#374151" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            📋 Duplicar Actividad
          </button>
          <button
            onClick={() => { onCarryOver(row); setOpen(false); }}
            style={{ border: "none", background: "none", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", color: "var(--primary)", fontWeight: 600 }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--primary-soft)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
            title="Marca la actual como completada y crea una copia idéntica"
          >
            🔄 Arrastrar (Siguiente Sem.)
          </button>
          <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid #F3F4F6" }} />
          <button
            onClick={() => { onDelete(row); setOpen(false); }}
            style={{ border: "none", background: "none", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", color: "#EF4444" }}
            onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            🗑️ Eliminar Fila
          </button>
        </div>
      )}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function AdminPlanificacion() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isMaster = auth.role === "admin";
  const [lastImport, setLastImport] = useState(null);

  const [gridData, setGridData]       = useState([]);
  const [users, setUsers]             = useState([]);
  const [clientesList, setClientesList] = useState([]);
  const [deletedIds, setDeletedIds]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, setToast]             = useState(null);
  const fileRef = useRef();

  // Vistas y navegación
  const [viewMode, setViewMode]       = useState("table");
  const [activeTabFilter, setActiveTabFilter] = useState("activas"); // activas | completadas | canceladas
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    fechaInicio: "", fechaFin: "", prioridad: "", estado: "", cliente: "", responsable: "",
  });
  const [activityHistorial, setActivityHistorial] = useState([]);

  // Filtro de Rango de Fechas Principal
  const [fechaInicioRango, setFechaInicioRango] = useState("");
  const [fechaFinRango, setFechaFinRango]       = useState("");
  const [busqueda, setBusqueda]                 = useState("");

  // Filtros por columna
  const [colFilters, setColFilters] = useState({
    prioridad: "", tarea: "", cliente: "", contacto: "", fecha_solicitud: "",
    responsable: "", etapa: "", estado: "", fecha_limite: "", seguimiento: "", notas: ""
  });

  // Estados de Modales Overlay
  const [activityDetailModal, setActivityDetailModal] = useState(null);
  const [cancelModalData, setCancelModalData] = useState(null);

  // Estados de tarjetas colapsables en compact view
  const [expandedCards, setExpandedCards] = useState({});

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const [acts, usrs, clis] = await Promise.all([
        apiFetch("/planificacion/actividades"),
        apiFetch("/admin/users"),
        apiFetch("/clientes"),
      ]);
      setGridData(acts.map(a => ({
        ...a,
        tarea: cleanTaskTitle(a.tarea, a.cliente),
        isDirty: false,
        isNew: false
      })));
      setUsers(usrs);
      setClientesList(clis);
      setDeletedIds([]);
      setSaveAttempted(false);
      if (isMaster) {
        apiFetch("/planificacion/last-import")
          .then(data => setLastImport(data))
          .catch(() => setLastImport(null));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function updateRow(rowId, field, value) {
    if (field === "estado" && value === "Cancelado") {
      const matched = gridData.find(r => r.id === rowId);
      if (matched) {
        setCancelModalData({ row: matched, motivo: "" });
      }
      return;
    }
    setGridData(prev =>
      prev.map(r => r.id === rowId ? { ...r, [field]: value, isDirty: true } : r)
    );
  }

  function addNewRow() {
    setGridData(prev => [...prev, emptyRow()]);
    setTimeout(() => {
      document.getElementById("grid-bottom")?.scrollIntoView({ behavior: "smooth" });
    }, 60);
  }

  function duplicateRow(row) {
    const dup = {
      ...row,
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isNew: true,
      isDirty: true
    };
    setGridData(prev => [...prev, dup]);
    showToast("Actividad duplicada localmente en la lista.");
  }

  function carryOverRow(row) {
    // 1. Mark current completed
    setGridData(prev =>
      prev.map(r => r.id === row.id ? { ...r, estado: "Completado", isDirty: true } : r)
    );
    // 2. Clone for next week
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = nextWeekDate.toISOString().slice(0, 10);

    const dup = {
      ...row,
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fecha_solicitud: new Date().toISOString().slice(0, 10),
      fecha_limite: nextWeekStr,
      estado: "En Progreso",
      progreso_pct: 0,
      subtareas: [],
      isNew: true,
      isDirty: true
    };
    setGridData(prev => [...prev, dup]);
    showToast("Tarea arrastrada: original Completada, nueva creada para la siguiente semana.");
  }

  function deleteRow(row) {
    setGridData(prev => prev.filter(r => r.id !== row.id));
    if (!row.isNew) setDeletedIds(prev => [...prev, row.id]);
    showToast("Actividad marcada para eliminar. Guarda los cambios para procesar.");
  }

  const hasDirty = gridData.some(r => r.isNew || r.isDirty) || deletedIds.length > 0;

  async function handleBulkSave() {
    setSaveAttempted(true);
    const invalids = gridData.filter(r => (r.isNew || r.isDirty) && !r.tarea?.trim());
    if (invalids.length > 0) {
      showToast(`${invalids.length} fila(s) sin tarea obligatoria`, "error");
      return;
    }

    const upsert = gridData
      .filter(r => r.isNew || r.isDirty)
      .map(r => ({
        id:              r.isNew ? null : r.id,
        prioridad:       r.prioridad || "Media",
        tarea:           r.tarea.trim(),
        cliente:         r.cliente || null,
        contacto:        r.contacto || null,
        fecha_solicitud: r.fecha_solicitud || null,
        responsable_id:  r.responsable_id || null,
        etapa:           r.etapa || null,
        estado:          r.estado || "En Progreso",
        fecha_limite:    r.fecha_limite || null,
        seguimiento_id:  r.seguimiento_id || null,
        responsables_ids: r.responsables_ids || null,
        seguimientos_ids: r.seguimientos_ids || null,
        contactos_ids:    r.contactos_ids || null,
        notas:           r.notas || null,
      }));

    if (upsert.length === 0 && deletedIds.length === 0) return;

    setSaving(true);
    try {
      const result = await apiFetch("/planificacion/actividades/bulk", {
        method: "POST",
        body: JSON.stringify({ upsert, delete: deletedIds }),
      });
      await load();
      showToast(`${result.upserted} guardadas · ${result.deleted} eliminadas`);
    } catch (e) {
      showToast("Error al guardar los cambios.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${BASE_URL}/planificacion/import-excel`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const data = await res.json();
      setImportResult(data);
      if (data.inserted > 0) {
        await load();
      }
    } catch {
      setImportResult({ error: "Error al importar el archivo." });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function handleRevertImport() {
    if (!lastImport) return;
    const dateStr = lastImport.imported_at ? new Date(lastImport.imported_at).toLocaleString("es-PE") : "Desconocido";
    const confirmMsg = `¿Estás seguro de que deseas deshacer la última importación de Excel?\n\n` +
                       `Fecha: ${dateStr}\n` +
                       `Actividades a eliminar: ${lastImport.count}\n\n` +
                       `Esta acción es irreversible y eliminará de forma permanente todas las actividades cargadas en ese lote. ¿Deseas continuar?`;
    
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await apiFetch("/planificacion/revert-import", { method: "POST" });
      showToast(`Se eliminaron ${res.deleted_count} actividades de la última importación.`);
      await load();
    } catch (e) {
      showToast(e.message || "Error al deshacer la importación.", "error");
    } finally {
      setLoading(false);
    }
  }

  function buildExportParams(cfg) {
    const p = new URLSearchParams();
    if (cfg.fechaInicio) p.set("fecha_inicio", cfg.fechaInicio);
    if (cfg.fechaFin) p.set("fecha_fin", cfg.fechaFin);
    if (cfg.prioridad) p.set("prioridad", cfg.prioridad);
    if (cfg.estado) p.set("estado", cfg.estado);
    if (cfg.cliente) p.set("cliente", cfg.cliente);
    if (cfg.responsable) p.set("responsable", cfg.responsable);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  function applyPeriodPreset(preset) {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    if (preset === "semana") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      setFechaInicioRango(start.toISOString().slice(0, 10));
      setFechaFinRango(end);
    } else if (preset === "mes") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFechaInicioRango(start.toISOString().slice(0, 10));
      setFechaFinRango(end);
    } else if (preset === "anio") {
      const start = new Date(now.getFullYear(), 0, 1);
      setFechaInicioRango(start.toISOString().slice(0, 10));
      setFechaFinRango(end);
    }
  }

  function getClientContacts(clientName) {
    if (!clientName) return [];
    const matched = clientesList.find(c => c.razon_social.trim().toLowerCase() === clientName.trim().toLowerCase());
    return matched?.contactos || [];
  }

  // ── Modales overlays ────────────────────────────────────────────────────────
  const handleClientClick = (clientName) => {
    if (!clientName) return;
    const matched = clientesList.find(c => c.razon_social.trim().toLowerCase() === clientName.trim().toLowerCase());
    if (matched) {
      navigate(`/clientes?id=${matched.id}`);
    } else {
      const confirmGo = window.confirm(
        `El cliente "${clientName}" no está registrado en la base de datos de Clientes.\n¿Deseas ir al módulo comercial para registrarlo?`
      );
      if (confirmGo) {
        navigate("/clientes");
      }
    }
  };

  const handleContactClick = (clientName, contactId) => {
    if (!clientName) {
      navigate("/clientes");
      return;
    }
    const matched = clientesList.find(c => c.razon_social.trim().toLowerCase() === clientName.trim().toLowerCase());
    if (matched) {
      const q = contactId ? `&contacto=${contactId}` : "";
      navigate(`/clientes?id=${matched.id}${q}`);
    } else {
      const confirmGo = window.confirm(
        `El cliente "${clientName}" no está registrado en la base de datos de Clientes.\n¿Deseas ir al módulo comercial para registrarlo?`
      );
      if (confirmGo) {
        navigate("/clientes");
      }
    }
  };

  async function openActivityDetail(row) {
    // Filas guardadas → página dedicada (/admin/planificacion/:id).
    // Filas nuevas (temp-) → modal, porque aún no existen en la base de datos.
    if (row.id && !row.isNew && !String(row.id).startsWith("temp-")) {
      if (hasDirty && !window.confirm("Tienes cambios sin guardar en la grilla. ¿Ir al detalle de todas formas? (se perderán los cambios no guardados)")) return;
      navigate(`/admin/planificacion/${row.id}`);
      return;
    }
    setActivityDetailModal({ ...row });
    setActivityHistorial([]);
  }

  // Gestión de subtareas
  async function addSubtask(desc) {
    if (!desc.trim()) return;
    try {
      const newSub = await apiFetch(`/planificacion/actividades/${activityDetailModal.id}/subtareas`, {
        method: "POST",
        body: JSON.stringify({ descripcion: desc.trim() })
      });
      const updatedSubs = [...(activityDetailModal.subtareas || []), newSub];
      const newProgress = updatedSubs.length > 0 ? Math.round((updatedSubs.filter(s => s.culminado).length / updatedSubs.length) * 100) : 0;

      setActivityDetailModal(prev => ({
        ...prev,
        subtareas: updatedSubs,
        progreso_pct: newProgress
      }));

      setGridData(gd => gd.map(r => r.id === activityDetailModal.id ? {
        ...r,
        subtareas: updatedSubs,
        progreso_pct: newProgress
      } : r));
    } catch (err) {
      showToast("Error al agregar subtarea", "error");
    }
  }

  async function toggleSubtask(subId) {
    try {
      const updatedSub = await apiFetch(`/planificacion/actividades/${activityDetailModal.id}/subtareas/${subId}/toggle`, {
        method: "PATCH"
      });
      const updatedSubs = activityDetailModal.subtareas.map(s => s.id === subId ? updatedSub : s);
      const newProgress = updatedSubs.length > 0 ? Math.round((updatedSubs.filter(s => s.culminado).length / updatedSubs.length) * 100) : 0;

      setActivityDetailModal(prev => ({
        ...prev,
        subtareas: updatedSubs,
        progreso_pct: newProgress
      }));

      setGridData(gd => gd.map(r => r.id === activityDetailModal.id ? {
        ...r,
        subtareas: updatedSubs,
        progreso_pct: newProgress
      } : r));
    } catch (err) {
      showToast("Error al cambiar estado de subtarea", "error");
    }
  }

  async function assignSubtaskUser(subId, userId) {
    try {
      const updatedSub = await apiFetch(`/planificacion/actividades/${activityDetailModal.id}/subtareas/${subId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ responsable_id: userId || null })
      });
      const updatedSubs = activityDetailModal.subtareas.map(s => s.id === subId ? updatedSub : s);

      setActivityDetailModal(prev => ({
        ...prev,
        subtareas: updatedSubs
      }));

      setGridData(gd => gd.map(r => r.id === activityDetailModal.id ? {
        ...r,
        subtareas: updatedSubs
      } : r));
    } catch (err) {
      showToast("Error al asignar subtarea", "error");
    }
  }

  async function deleteSubtask(subId) {
    try {
      await apiFetch(`/planificacion/actividades/${activityDetailModal.id}/subtareas/${subId}`, {
        method: "DELETE"
      });
      const updatedSubs = activityDetailModal.subtareas.filter(s => s.id !== subId);
      const newProgress = updatedSubs.length > 0
        ? Math.round((updatedSubs.filter(s => s.culminado).length / updatedSubs.length) * 100)
        : 0;

      setActivityDetailModal(prev => ({
        ...prev,
        subtareas: updatedSubs,
        progreso_pct: newProgress
      }));

      setGridData(gd => gd.map(r => r.id === activityDetailModal.id ? {
        ...r,
        subtareas: updatedSubs,
        progreso_pct: newProgress
      } : r));
    } catch (err) {
      showToast("Error al eliminar subtarea", "error");
    }
  }

  function handleApplyChanges() {
    if (!activityDetailModal.tarea?.trim()) {
      showToast("La descripción de la tarea es obligatoria.", "error");
      return;
    }
    setGridData(gd => gd.map(r => r.id === activityDetailModal.id ? { ...activityDetailModal, isDirty: true } : r));
    setActivityDetailModal(null);
    showToast("Detalles aplicados localmente en la grilla. Recuerda Guardar Cambios para persistirlos.");
  }

  function confirmCancel() {
    if (!cancelModalData.motivo.trim()) return;
    const { row, motivo } = cancelModalData;
    const dateStr = new Date().toLocaleDateString("es-PE");
    const updatedNotas = `[Cancelado el ${dateStr} - Motivo: ${motivo.trim()}]${row.notas ? `\n${row.notas}` : ""}`;
    
    setGridData(prev =>
      prev.map(r => r.id === row.id ? { ...r, estado: "Cancelado", notas: updatedNotas, isDirty: true } : r)
    );
    setCancelModalData(null);
    showToast("Actividad cancelada y archivada. Recuerda guardar cambios.");
  }

  function toggleCardExpansion(id) {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // ── FILTRADO Y ORDENAMIENTO EN FRONTEND ──────────────────────────────────────
  const filteredGrid = useMemo(() => {
    return gridData.filter(a => {
      // 1. Filtrado por Pestaña Activa
      if (activeTabFilter === "activas" && (a.estado === "Completado" || a.estado === "Cancelado")) return false;
      if (activeTabFilter === "completadas" && a.estado !== "Completado") return false;
      if (activeTabFilter === "canceladas" && a.estado !== "Cancelado") return false;

      // 2. Filtro General de Búsqueda
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const matchesTarea = a.tarea.toLowerCase().includes(q);
        const matchesCliente = (a.cliente || "").toLowerCase().includes(q);
        const matchesContacto = (a.contacto || "").toLowerCase().includes(q);
        if (!matchesTarea && !matchesCliente && !matchesContacto) return false;
      }

      // 3. Filtro de Rango de Fechas Principal
      if (fechaInicioRango) {
        const fTarget = a.fecha_limite || a.fecha_solicitud;
        if (!fTarget || fTarget < fechaInicioRango) return false;
      }
      if (fechaFinRango) {
        const fTarget = a.fecha_limite || a.fecha_solicitud;
        if (!fTarget || fTarget > fechaFinRango) return false;
      }

      // 4. Filtros Inline por Columna
      if (colFilters.prioridad && a.prioridad !== colFilters.prioridad) return false;
      if (colFilters.tarea && !a.tarea.toLowerCase().includes(colFilters.tarea.toLowerCase())) return false;
      if (colFilters.cliente && !(a.cliente || "").toLowerCase().includes(colFilters.cliente.toLowerCase())) return false;
      if (colFilters.contacto && !(a.contacto || "").toLowerCase().includes(colFilters.contacto.toLowerCase())) return false;
      if (colFilters.fecha_solicitud && !fmtDate(a.fecha_solicitud).toLowerCase().includes(colFilters.fecha_solicitud.toLowerCase())) return false;
      if (colFilters.fecha_limite && !fmtDate(a.fecha_limite).toLowerCase().includes(colFilters.fecha_limite.toLowerCase())) return false;
      if (colFilters.estado && a.estado !== colFilters.estado) return false;
      if (colFilters.notas && !(a.notas || "").toLowerCase().includes(colFilters.notas.toLowerCase())) return false;

      if (colFilters.responsable) {
        const respList = (a.responsables_ids || "").split(",").map(id => id.trim()).filter(Boolean);
        if (!respList.includes(colFilters.responsable) && a.responsable_id !== colFilters.responsable) return false;
      }
      if (colFilters.seguimiento) {
        const segList = (a.seguimientos_ids || "").split(",").map(id => id.trim()).filter(Boolean);
        if (!segList.includes(colFilters.seguimiento) && a.seguimiento_id !== colFilters.seguimiento) return false;
      }
      if (colFilters.etapa && a.etapa !== colFilters.etapa) return false;

      return true;
    });
  }, [gridData, busqueda, fechaInicioRango, fechaFinRango, colFilters, activeTabFilter]);

  // ORDENAMIENTO REQUERIDO:
  // 1. Prioridad: Alta > Media > Baja
  // 2. Estado: Retraso > En Progreso > En espera > Completado > Cancelado
  const sortedGrid = useMemo(() => {
    const priorityRank = { Alta: 3, Media: 2, Baja: 1 };
    const statusRank = { "Retraso": 4, "En Progreso": 3, "En espera": 2, "Completado": 1, "Cancelado": 0 };

    return [...filteredGrid].sort((a, b) => {
      const aPrio = priorityRank[a.prioridad] || 0;
      const bPrio = priorityRank[b.prioridad] || 0;
      if (aPrio !== bPrio) return bPrio - aPrio; // High priority first

      const aStat = statusRank[a.estado] || 0;
      const bStat = statusRank[b.estado] || 0;
      return bStat - aStat; // Status priority
    });
  }, [filteredGrid]);

  const hiddenDirtyCount = gridData.filter(
    r => (r.isNew || r.isDirty) && !sortedGrid.some(f => f.id === r.id)
  ).length;

  const saveLabel = saving
    ? "Guardando..."
    : hasDirty
    ? `💾 Guardar Cambios${hiddenDirtyCount > 0 ? ` (+${hiddenDirtyCount} ocultas)` : ""}`
    : "💾 Sin cambios";

  return (
    <Layout>
      {/* Estilos para focus de celdas y hover */}
      <style>{`
        .gc { transition: background 0.1s; }
        .gc:focus {
          background: #F0FDFE !important;
          outline: 1px solid var(--primary) !important;
          border-radius: 3px;
        }
        .gc::placeholder { color: #D1D5DB; }
        .compact-input { transition: all 0.15s ease; }
        .compact-input:focus {
          border-color: var(--primary) !important;
          background-color: #FFFFFF !important;
          box-shadow: 0 0 0 2px rgba(79, 124, 130, 0.15) !important;
        }
        .cell-link { color: var(--primary); cursor: pointer; text-decoration: underline; font-weight: 600; }
        .cell-link:hover { color: #0b2e33; }
      `}</style>

      {/* Datalists para recomendaciones */}
      <datalist id="clients-list">
        {clientesList.map(c => <option key={c.id} value={c.razon_social} />)}
      </datalist>

      <div style={{ padding: "0 4px" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              Planificación Semanal
            </h1>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0" }}>
              {gridData.length} actividades en total · Mostrando {sortedGrid.length}
              {hasDirty && <span style={{ color: "#EAB308", fontWeight: 700, marginLeft: 8 }}>· Cambios pendientes</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
            <button
              onClick={() => fileRef.current.click()}
              disabled={importing}
              style={{
                background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid #D1D5DB",
                borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {importing ? "Importando..." : "⬆ Importar Excel"}
            </button>
            {isMaster && lastImport && (
              <button
                onClick={handleRevertImport}
                disabled={loading || importing}
                style={{
                  background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5",
                  borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#FEE2E2"}
                onMouseLeave={e => e.currentTarget.style.background = "#FEF2F2"}
              >
                ↩ Deshacer Importación ({lastImport.count} filas)
              </button>
            )}
            <button
              onClick={() => {
                setExportFilters({
                  fechaInicio: fechaInicioRango,
                  fechaFin: fechaFinRango,
                  prioridad: colFilters.prioridad,
                  estado: colFilters.estado,
                  cliente: colFilters.cliente,
                  responsable: colFilters.responsable,
                });
                setShowExportModal(true);
              }}
              style={{
                background: "white", color: "var(--primary)", border: "1px solid #D1D5DB",
                borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              ⬇ Exportar Excel
            </button>
            <button
              onClick={addNewRow}
              style={{
                background: "#F0FDF4", color: "#16A34A", border: "1px solid #86EFAC",
                borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              + Nueva Actividad
            </button>
            <button
              onClick={handleBulkSave}
              disabled={saving || !hasDirty}
              style={{
                background: hasDirty ? "var(--primary)" : "#9CA3AF",
                color: "white", border: "none", borderRadius: 9,
                padding: "8px 18px", fontSize: 13, fontWeight: 700,
                cursor: hasDirty && !saving ? "pointer" : "default",
                boxShadow: hasDirty ? "0 0 0 3px rgba(0,31,84,0.18)" : "none",
                transition: "all 0.2s",
              }}
            >
              {saveLabel}
            </button>
          </div>
        </div>

        {/* Toggle de Vistas */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, borderBottom: "1px solid #E5E7EB", paddingBottom: 1 }}>
          <button
            onClick={() => setViewMode("table")}
            style={{
              background: "none", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 700,
              color: viewMode === "table" ? "var(--primary)" : "#9CA3AF",
              borderBottom: viewMode === "table" ? "3px solid var(--primary)" : "3px solid transparent", cursor: "pointer",
            }}
          >
            📋 Vista Cuadrícula
          </button>
          <button
            onClick={() => setViewMode("compact")}
            style={{
              background: "none", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 700,
              color: viewMode === "compact" ? "var(--primary)" : "#9CA3AF",
              borderBottom: viewMode === "compact" ? "3px solid var(--primary)" : "3px solid transparent", cursor: "pointer",
            }}
          >
            📱 Tarjetas Colapsables
          </button>

          {/* Separator / Spacer */}
          <div style={{ flex: 1 }} />

          {/* Tabs para Activas / Archivadas */}
          <div style={{ display: "flex", gap: 6, paddingRight: 4 }}>
            <button
              onClick={() => setActiveTabFilter("activas")}
              style={{
                border: "none", borderRadius: "6px 6px 0 0", padding: "6px 12px", fontSize: 12, fontWeight: 700,
                background: activeTabFilter === "activas" ? "var(--primary-soft)" : "transparent",
                color: activeTabFilter === "activas" ? "var(--primary)" : "#9CA3AF", cursor: "pointer"
              }}
            >
              🚀 Actividades Activas
            </button>
            <button
              onClick={() => setActiveTabFilter("completadas")}
              style={{
                border: "none", borderRadius: "6px 6px 0 0", padding: "6px 12px", fontSize: 12, fontWeight: 700,
                background: activeTabFilter === "completadas" ? "var(--primary-soft)" : "transparent",
                color: activeTabFilter === "completadas" ? "var(--primary)" : "#9CA3AF", cursor: "pointer"
              }}
            >
              ✅ Completadas
            </button>
            <button
              onClick={() => setActiveTabFilter("canceladas")}
              style={{
                border: "none", borderRadius: "6px 6px 0 0", padding: "6px 12px", fontSize: 12, fontWeight: 700,
                background: activeTabFilter === "canceladas" ? "#FEE2E2" : "transparent",
                color: activeTabFilter === "canceladas" ? "#991B1B" : "#9CA3AF", cursor: "pointer"
              }}
            >
              🚫 Canceladas
            </button>
          </div>
        </div>

        {/* ── Resultados de Importación ───────────────────────────────────── */}
        {importResult && (
          <div style={{
            background: importResult.error ? "#FEE2E2" : "#DCFCE7",
            border: `1px solid ${importResult.error ? "#FCA5A5" : "#86EFAC"}`,
            borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 13,
            color: importResult.error ? "#DC2626" : "#15803D",
          }}>
            {importResult.error
              || `✓ ${importResult.inserted} tarea(s) importadas desde: ${(importResult.sheets_procesadas || []).join(", ")}`}
            <button onClick={() => setImportResult(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* ── Filtros Principales (Top Bar) ───────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar tarea, cliente o contacto..."
            style={{ flex: 1, minWidth: 200, border: "1px solid #E5E7EB", borderRadius: 9, padding: "7px 12px", fontSize: 13 }}
          />
          
          {["semana", "mes", "anio"].map(p => (
            <button key={p} onClick={() => applyPeriodPreset(p)}
              style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {p === "semana" ? "Esta semana" : p === "mes" ? "Este mes" : "Este año"}
            </button>
          ))}

          <div style={{ display: "flex", gap: 6, alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 9, padding: "3px 10px", background: "white" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Rango:</span>
            <input type="date" value={fechaInicioRango} onChange={e => setFechaInicioRango(e.target.value)}
              style={{ border: "none", fontSize: 12, outline: "none" }} />
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>a</span>
            <input type="date" value={fechaFinRango} onChange={e => setFechaFinRango(e.target.value)}
              style={{ border: "none", fontSize: 12, outline: "none" }} />
          </div>

          {(busqueda || fechaInicioRango || fechaFinRango || Object.values(colFilters).some(Boolean)) && (
            <button
              onClick={() => {
                setBusqueda("");
                setFechaInicioRango("");
                setFechaFinRango("");
                setColFilters({
                  prioridad: "", tarea: "", cliente: "", contacto: "", fecha_solicitud: "",
                  responsable: "", etapa: "", estado: "", fecha_limite: "", seguimiento: "", notas: ""
                });
              }}
              style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
            >
              × Limpiar Filtros
            </button>
          )}
        </div>

        {/* ── Grilla editable ─────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9CA3AF" }}>Cargando planificación...</div>
        ) : viewMode === "compact" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sortedGrid.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", background: "#F9FAFB", borderRadius: 12, border: "1.5px dashed #D1D5DB" }}>
                Ninguna actividad coincide con los filtros activos.
              </div>
            ) : (
              sortedGrid.map(row => {
                const invalidTarea = saveAttempted && !row.tarea?.trim();
                const vencida = row.fecha_limite && new Date(row.fecha_limite) < new Date() && row.estado !== "Completado";
                const isExpanded = !!expandedCards[row.id];

                return (
                  <div
                    key={row.id}
                    style={{
                      background: row.isNew ? "#F0FFF4" : row.isDirty ? "#FEFCE8" : "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderLeft: `6px solid ${PRIORIDAD_COLOR[row.prioridad] || "#9CA3AF"}`,
                      borderRadius: 12, padding: 14, boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                      display: "flex", flexDirection: "column", gap: 10
                    }}
                  >
                    {/* Fila colapsada por defecto: Tarea, Prioridad, Estado y Expand button */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: `${PRIORIDAD_COLOR[row.prioridad]}15`, color: PRIORIDAD_COLOR[row.prioridad], padding: "2px 6px", borderRadius: 4 }}>
                          {row.prioridad}
                        </span>
                        <div onClick={() => openActivityDetail(row)} style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--primary)", textDecoration: "underline" }}>
                          {row.tarea}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: ESTADO_COLOR[row.estado] }}>
                          {row.estado}
                        </span>
                        <button
                          onClick={() => toggleCardExpansion(row.id)}
                          style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          {isExpanded ? "▲ Colapsar" : "▼ Detalles"}
                        </button>
                        <RowActionsMenu
                          row={row}
                          onEdit={openActivityDetail}
                          onDuplicate={duplicateRow}
                          onCarryOver={carryOverRow}
                          onDelete={deleteRow}
                        />
                      </div>
                    </div>

                    {/* Fila expandida con todos los datos */}
                    {isExpanded && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>Cliente</label>
                          <span onClick={() => handleClientClick(row.cliente)} className="cell-link" style={{ fontSize: 12 }}>{row.cliente || "—"}</span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>Contacto</label>
                          <span onClick={() => handleContactClick(row.cliente, row.contacto)} className="cell-link" style={{ fontSize: 12 }}>{row.contacto || "—"}</span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>F. Solicitud</label>
                          <span style={{ fontSize: 12, color: "#374151" }}>{row.fecha_solicitud ? fmtDate(row.fecha_solicitud) : "—"}</span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>F. Límite</label>
                          <span style={{ fontSize: 12, fontWeight: vencida ? 700 : 400, color: vencida ? "#EF4444" : "#4B5563" }}>
                            {row.fecha_limite ? fmtDate(row.fecha_limite) : "—"}
                          </span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>Responsables</label>
                          <span style={{ fontSize: 12, color: "#374151" }}>
                            {(row.responsables_ids || "").split(",").map(id => {
                              const u = users.find(usr => usr.id === id.trim());
                              return u ? formatUsername(u.username) : "";
                            }).filter(Boolean).join(", ") || row.responsable || "—"}
                          </span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>Etapa</label>
                          <span style={{ fontSize: 12, color: "#374151" }}>{row.etapa || "—"}</span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block" }}>Notas</label>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{row.notas || "—"}</span>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 3 }}>Progreso Subtareas ({Math.round(row.progreso_pct || 0)}%)</label>
                          <ProgressBar pct={row.progreso_pct} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div id="grid-bottom" />
          </div>
        ) : (
          /* VISTA CUADRÍCULA */
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #E5E7EB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1780 }}>
              <thead>
                <tr style={{ background: "var(--primary)" }}>
                  {COLS.map((c, i) => (
                    <th key={i} style={{
                      color: "white", fontSize: 11, fontWeight: 700, textAlign: "left",
                      padding: "10px 8px", whiteSpace: "nowrap", minWidth: c.minW,
                      borderRight: i < COLS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    }}>
                      {c.label}
                    </th>
                  ))}
                </tr>

                {/* Filtros inline por columna */}
                <tr style={{ background: "var(--primary)", borderBottom: "1.5px solid rgba(255,255,255,0.08)" }}>
                  {/* Acción (sin filtro) */}
                  <td style={{ padding: "4px" }}></td>
                  {/* Item (sin filtro) */}
                  <td style={{ padding: "4px" }}></td>
                  {/* Prioridad */}
                  <td style={{ padding: "4px" }}>
                    <select
                      value={colFilters.prioridad}
                      onChange={e => setColFilters(prev => ({ ...prev, prioridad: e.target.value }))}
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px", borderRadius: 4, width: "100%", outline: "none" }}
                    >
                      <option value="" style={{ color: "black" }}>Todos</option>
                      {PRIORIDADES.map(p => <option key={p} value={p} style={{ color: "black" }}>{p}</option>)}
                    </select>
                  </td>
                  {/* Tarea */}
                  <td style={{ padding: "4px" }}>
                    <input
                      value={colFilters.tarea} onChange={e => setColFilters(prev => ({ ...prev, tarea: e.target.value }))}
                      placeholder="Buscar..."
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px 8px", borderRadius: 4, width: "100%", outline: "none" }}
                    />
                  </td>
                  {/* Cliente */}
                  <td style={{ padding: "4px" }}>
                    <input
                      value={colFilters.cliente} onChange={e => setColFilters(prev => ({ ...prev, cliente: e.target.value }))}
                      placeholder="Buscar..."
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px 8px", borderRadius: 4, width: "100%", outline: "none" }}
                    />
                  </td>
                  {/* Contacto */}
                  <td style={{ padding: "4px" }}>
                    <input
                      value={colFilters.contacto} onChange={e => setColFilters(prev => ({ ...prev, contacto: e.target.value }))}
                      placeholder="Buscar..."
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px 8px", borderRadius: 4, width: "100%", outline: "none" }}
                    />
                  </td>
                  {/* F. Solicitud */}
                  <td style={{ padding: "4px" }}>
                    <input
                      value={colFilters.fecha_solicitud} onChange={e => setColFilters(prev => ({ ...prev, fecha_solicitud: e.target.value }))}
                      placeholder="Buscar..."
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px 8px", borderRadius: 4, width: "100%", outline: "none" }}
                    />
                  </td>
                  {/* Responsable */}
                  <td style={{ padding: "4px" }}>
                    <select
                      value={colFilters.responsable} onChange={e => setColFilters(prev => ({ ...prev, responsable: e.target.value }))}
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px", borderRadius: 4, width: "100%", outline: "none" }}
                    >
                      <option value="" style={{ color: "black" }}>Todos</option>
                      {users.map(u => <option key={u.id} value={u.id} style={{ color: "black" }}>{formatUsername(u.username)}</option>)}
                    </select>
                  </td>
                  {/* Etapa */}
                  <td style={{ padding: "4px" }}>
                    <select
                      value={colFilters.etapa} onChange={e => setColFilters(prev => ({ ...prev, etapa: e.target.value }))}
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px", borderRadius: 4, width: "100%", outline: "none" }}
                    >
                      <option value="" style={{ color: "black" }}>Todos</option>
                      {ETAPAS.map(et => <option key={et} value={et} style={{ color: "black" }}>{et}</option>)}
                    </select>
                  </td>
                  {/* Estado */}
                  <td style={{ padding: "4px" }}>
                    <select
                      value={colFilters.estado} onChange={e => setColFilters(prev => ({ ...prev, estado: e.target.value }))}
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px", borderRadius: 4, width: "100%", outline: "none" }}
                    >
                      <option value="" style={{ color: "black" }}>Todos</option>
                      {ESTADOS.map(es => <option key={es} value={es} style={{ color: "black" }}>{es}</option>)}
                    </select>
                  </td>
                  {/* F. Límite */}
                  <td style={{ padding: "4px" }}>
                    <input
                      value={colFilters.fecha_limite} onChange={e => setColFilters(prev => ({ ...prev, fecha_limite: e.target.value }))}
                      placeholder="Buscar..."
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px 8px", borderRadius: 4, width: "100%", outline: "none" }}
                    />
                  </td>
                  {/* Seguimiento */}
                  <td style={{ padding: "4px" }}>
                    <select
                      value={colFilters.seguimiento} onChange={e => setColFilters(prev => ({ ...prev, seguimiento: e.target.value }))}
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px", borderRadius: 4, width: "100%", outline: "none" }}
                    >
                      <option value="" style={{ color: "black" }}>Todos</option>
                      {users.map(u => <option key={u.id} value={u.id} style={{ color: "black" }}>{formatUsername(u.username)}</option>)}
                    </select>
                  </td>
                  {/* Notas */}
                  <td style={{ padding: "4px" }}>
                    <input
                      value={colFilters.notas} onChange={e => setColFilters(prev => ({ ...prev, notas: e.target.value }))}
                      placeholder="Buscar..."
                      style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 11, padding: "4px 8px", borderRadius: 4, width: "100%", outline: "none" }}
                    />
                  </td>
                  {/* Spacer */}
                  <td></td>
                </tr>
              </thead>
              <tbody>
                {sortedGrid.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 13 }}>
                      Ninguna actividad coincide con los filtros activos.
                    </td>
                  </tr>
                )}
                {sortedGrid.map((row, idx) => {
                  const invalidTarea = saveAttempted && !row.tarea?.trim();
                  const vencida = row.fecha_limite && new Date(row.fecha_limite) < new Date() && row.estado !== "Completado";
                  const rowBg = row.isNew ? "#F0FFF4" : row.isDirty ? "#FEFCE8" : idx % 2 === 0 ? "white" : "#F9FAFB";

                  return (
                    <tr key={row.id} style={{ background: rowBg, borderBottom: "1px solid #F0F0F0" }}>
                      
                      {/* Acciones */}
                      <td style={{ padding: "2px 6px", textAlign: "center" }}>
                        <RowActionsMenu
                          row={row}
                          onEdit={openActivityDetail}
                          onDuplicate={duplicateRow}
                          onCarryOver={carryOverRow}
                          onDelete={deleteRow}
                        />
                      </td>

                      {/* Item */}
                      <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>
                        {idx + 1}
                      </td>

                      {/* Prioridad */}
                      <td style={{ padding: "2px 4px" }}>
                        <select
                          className="gc"
                          value={row.prioridad || ""}
                          onChange={e => updateRow(row.id, "prioridad", e.target.value)}
                          style={{ ...CELL, fontWeight: 700, color: PRIORIDAD_COLOR[row.prioridad] || "#6B7280" }}
                        >
                          <option value="">—</option>
                          {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>

                      {/* Tarea */}
                      <td style={{ padding: "2px 4px" }}>
                        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                          <input
                            className="gc"
                            value={row.tarea || ""}
                            onChange={e => updateRow(row.id, "tarea", e.target.value)}
                            placeholder="Descripción de la tarea..."
                            style={{ ...CELL, outline: invalidTarea ? "1px solid #EF4444" : undefined, background: invalidTarea ? "#FEF2F2" : "transparent" }}
                          />
                          {row.id && (
                            <button onClick={() => openActivityDetail(row)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--primary)" }} title="Ver detalles y subtareas">
                              📋
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td style={{ padding: "2px 4px" }}>
                        <div style={{ display: "flex", alignItems: "center", width: "100%", position: "relative" }}>
                          <input
                            className="gc" list="clients-list" value={row.cliente || ""}
                            onChange={e => updateRow(row.id, "cliente", e.target.value)}
                            placeholder="Cliente..." style={{ ...CELL, paddingRight: 20 }}
                          />
                          {row.cliente && (
                            <button onClick={() => handleClientClick(row.cliente)} style={{ position: "absolute", right: 2, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--primary)" }} title="Ver ficha de cliente">
                              🏢
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Contacto (multi) */}
                      <td style={{ padding: "2px 4px" }}>
                        <MultiSelectContact
                          selectedIds={row.contactos_ids}
                          contacts={getClientContacts(row.cliente)}
                          onChange={val => {
                            const names = val.split(",").map(id => getClientContacts(row.cliente).find(c => c.id === id.trim())?.nombre).filter(Boolean).join(", ");
                            setGridData(prev => prev.map(r => r.id === row.id ? { ...r, contactos_ids: val, contacto: names, isDirty: true } : r));
                          }}
                          placeholder={row.cliente ? "Contactos..." : "Elegir cliente"}
                        />
                      </td>

                      {/* F. Solicitud */}
                      <td style={{ padding: "2px 4px" }}>
                        <input type="date" className="gc" value={row.fecha_solicitud || ""} onChange={e => updateRow(row.id, "fecha_solicitud", e.target.value)} style={CELL} />
                      </td>

                      {/* Responsable (Multi-Select) */}
                      <td style={{ padding: "2px 4px" }}>
                        <MultiSelectUser
                          selectedIds={row.responsables_ids}
                          users={users}
                          onChange={val => updateRow(row.id, "responsables_ids", val)}
                          placeholder="Sin asignar"
                        />
                      </td>

                      {/* Etapa */}
                      <td style={{ padding: "2px 4px" }}>
                        <select className="gc" value={row.etapa || ""} onChange={e => updateRow(row.id, "etapa", e.target.value)} style={CELL}>
                          <option value="">—</option>
                          {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </td>

                      {/* Estado */}
                      <td style={{ padding: "2px 4px" }}>
                        <select
                          className="gc" value={row.estado || ""}
                          onChange={e => updateRow(row.id, "estado", e.target.value)}
                          style={{ ...CELL, color: ESTADO_COLOR[row.estado] || "#374151", fontWeight: 700 }}
                        >
                          <option value="">—</option>
                          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* F. Límite */}
                      <td style={{ padding: "2px 4px" }}>
                        <input
                          type="date" className="gc" value={row.fecha_limite || ""}
                          onChange={e => updateRow(row.id, "fecha_limite", e.target.value)}
                          style={{ ...CELL, color: vencida ? "#EF4444" : "#111827", fontWeight: vencida ? 700 : 400 }}
                        />
                      </td>

                      {/* Seguimiento (Multi-Select) */}
                      <td style={{ padding: "2px 4px" }}>
                        <MultiSelectUser
                          selectedIds={row.seguimientos_ids}
                          users={users}
                          onChange={val => updateRow(row.id, "seguimientos_ids", val)}
                          placeholder="Sin asignar"
                        />
                      </td>

                      {/* Notas */}
                      <td style={{ padding: "2px 4px" }}>
                        <input className="gc" value={row.notes || row.notas || ""} onChange={e => updateRow(row.id, "notas", e.target.value)} placeholder="Notas..." style={CELL} />
                      </td>

                      {/* Progreso */}
                      <td style={{ padding: "4px 8px" }}>
                        <div style={{ fontSize: 10, color: "#6B7280", textAlign: "center", marginBottom: 2 }}>{Math.round(row.progreso_pct || 0)}%</div>
                        <ProgressBar pct={row.progreso_pct} />
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div id="grid-bottom" />
          </div>
        )}

        {/* ── LEYENDA ────────────────────────────────────────────────────── */}
        {hasDirty && (
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "#9CA3AF" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#F0FFF4", border: "1px solid #86EFAC", borderRadius: 2, marginRight: 4 }} />Fila nueva</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#FEFCE8", border: "1px solid #FDE047", borderRadius: 2, marginRight: 4 }} />Fila modificada</span>
          </div>
        )}
      </div>

      {/* ── MODALES OVERLAY GLASSMORPHIC ─────────────────────────────────── */}

      {/* Unified Activity Detail & Subtasks Modal */}
      {activityDetailModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(11, 46, 51, 0.4)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "white", borderRadius: 16, width: "95%", maxWidth: 1000,
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            {/* Modal Header */}
            <div style={{
              background: "var(--primary)", padding: "18px 24px", color: "white",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Detalle y Gestión de Actividad
                </h3>
                <span style={{ fontSize: 12, color: "rgba(199,210,229,0.85)" }}>
                  {activityDetailModal.isNew ? "Nueva Actividad (Sin guardar en la base de datos)" : `ID Actividad: ${activityDetailModal.id}`}
                </span>
              </div>
              <button
                onClick={() => setActivityDetailModal(null)}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 24, lineHeight: "24px" }}
              >
                ×
              </button>
            </div>

            {/* Modal Content - Two Columns */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: window.innerWidth < 768 ? "column" : "row" }}>
              
              {/* Left Column: Form Details */}
              <div style={{
                flex: 1.2, padding: 24, overflowY: "auto", borderRight: "1px solid #E5E7EB",
                display: "flex", flexDirection: "column", gap: 14
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>
                    📝 Detalles de la Actividad
                  </h4>
                  <span style={{
                    background: "#FEF9C3", color: "#854D0E", border: "1px solid #FEF08A",
                    borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700
                  }}>
                    ⚠️ Guardado manual (requiere guardar en pantalla principal)
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Descripción de Tarea ✱</label>
                  <textarea
                    value={activityDetailModal.tarea || ""}
                    onChange={e => setActivityDetailModal(prev => ({ ...prev, tarea: e.target.value }))}
                    rows={2}
                    style={{ ...COMPACT_INPUT, resize: "none" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Prioridad</label>
                    <select
                      value={activityDetailModal.prioridad || ""}
                      onChange={e => setActivityDetailModal(prev => ({ ...prev, prioridad: e.target.value }))}
                      style={COMPACT_INPUT}
                    >
                      {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Estado</label>
                    <select
                      value={activityDetailModal.estado || ""}
                      onChange={e => setActivityDetailModal(prev => ({ ...prev, estado: e.target.value }))}
                      style={COMPACT_INPUT}
                    >
                      {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Cliente</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={activityDetailModal.cliente || ""} list="clients-list"
                        onChange={e => setActivityDetailModal(prev => ({ ...prev, cliente: e.target.value }))}
                        style={COMPACT_INPUT}
                      />
                      {activityDetailModal.cliente && (
                        <button
                          onClick={() => handleClientClick(activityDetailModal.cliente)}
                          style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid #D1D5DB", borderRadius: 8, padding: "0 10px", fontSize: 12, cursor: "pointer" }}
                          title="Ver y editar en módulo comercial"
                        >
                          🏢
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Contacto</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={activityDetailModal.contacto || ""}
                        onChange={e => setActivityDetailModal(prev => ({ ...prev, contacto: e.target.value }))}
                        style={COMPACT_INPUT}
                      />
                      {activityDetailModal.contacto && (
                        <button
                          onClick={() => handleContactClick(activityDetailModal.cliente, activityDetailModal.contacto)}
                          style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid #D1D5DB", borderRadius: 8, padding: "0 10px", fontSize: 12, cursor: "pointer" }}
                          title="Ver y editar en módulo comercial"
                        >
                          👤
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Responsables (Múltiples)</label>
                  <MultiSelectUser
                    selectedIds={activityDetailModal.responsables_ids}
                    users={users}
                    onChange={val => setActivityDetailModal(prev => ({ ...prev, responsables_ids: val }))}
                    placeholder="Selecciona responsables..."
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>F. Solicitud</label>
                    <input
                      type="date" value={activityDetailModal.fecha_solicitud || ""}
                      onChange={e => setActivityDetailModal(prev => ({ ...prev, fecha_solicitud: e.target.value }))}
                      style={COMPACT_INPUT}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>F. Límite</label>
                    <input
                      type="date" value={activityDetailModal.fecha_limite || ""}
                      onChange={e => setActivityDetailModal(prev => ({ ...prev, fecha_limite: e.target.value }))}
                      style={COMPACT_INPUT}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Etapa</label>
                    <select
                      value={activityDetailModal.etapa || ""}
                      onChange={e => setActivityDetailModal(prev => ({ ...prev, etapa: e.target.value }))}
                      style={COMPACT_INPUT}
                    >
                      <option value="">— Sin etapa —</option>
                      {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Seguimiento (Múltiples)</label>
                    <MultiSelectUser
                      selectedIds={activityDetailModal.seguimientos_ids}
                      users={users}
                      onChange={val => setActivityDetailModal(prev => ({ ...prev, seguimientos_ids: val }))}
                      placeholder="Selecciona seguimiento..."
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", display: "block", marginBottom: 4 }}>Notas</label>
                  <input
                    value={activityDetailModal.notas || ""}
                    onChange={e => setActivityDetailModal(prev => ({ ...prev, notas: e.target.value }))}
                    placeholder="Notas adicionales..."
                    style={COMPACT_INPUT}
                  />
                </div>
              </div>

              {/* Right Column: Checklist Subtasks */}
              <div style={{
                flex: 1, padding: 24, overflowY: "auto", background: "#F9FAFB",
                display: "flex", flexDirection: "column", gap: 14
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>
                    📋 Checklist y Subtareas
                  </h4>
                  <span style={{
                    background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0",
                    borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700
                  }}>
                    ⚡ Sincronización en tiempo real
                  </span>
                </div>

                {activityDetailModal.isNew ? (
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", border: "2px dashed #E5E7EB", borderRadius: 12,
                    padding: 24, textAlign: "center", background: "white", minHeight: 250
                  }}>
                    <span style={{ fontSize: 32, marginBottom: 10 }}>🔒</span>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#4B5563", margin: "0 0 6px 0" }}>
                      Actividad No Guardada
                    </p>
                    <p style={{ fontSize: 12, color: "#6B7280", margin: 0, maxWidth: 300 }}>
                      Esta es una nueva fila local. Para poder agregar subtareas en la base de datos, primero debes guardar la actividad haciendo clic en "Guardar Cambios" en la pantalla principal.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                        <span>Progreso de Subtareas</span>
                        <span>{Math.round(activityDetailModal.progreso_pct || 0)}%</span>
                      </div>
                      <ProgressBar pct={activityDetailModal.progreso_pct} />
                    </div>

                    {/* Checklist list */}
                    <div style={{
                      flex: 1, display: "flex", flexDirection: "column", gap: 8,
                      maxHeight: 320, overflowY: "auto", border: "1px solid #E5E7EB",
                      borderRadius: 10, padding: 12, background: "white"
                    }}>
                      {(!activityDetailModal.subtareas || activityDetailModal.subtareas.length === 0) ? (
                        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", margin: "auto 0", padding: "20px 0" }}>
                          No hay subtareas registradas para esta actividad.
                        </p>
                      ) : (
                        activityDetailModal.subtareas.map(sub => (
                          <div key={sub.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            background: "#F9FAFB", padding: "8px 10px", borderRadius: 8,
                            border: "1px solid #E5E7EB"
                          }}>
                            <input
                              type="checkbox" checked={!!sub.culminado}
                              onChange={() => toggleSubtask(sub.id)}
                              style={{ width: 16, height: 16, cursor: "pointer" }}
                            />
                            
                            <span style={{
                              fontSize: 12, flex: 1,
                              textDecoration: sub.culminado ? "line-through" : "none",
                              color: sub.culminado ? "#9CA3AF" : "#111827",
                              fontWeight: sub.culminado ? 400 : 600
                            }}>
                              {sub.descripcion}
                            </span>

                            {/* Subtask Assignee selector */}
                            <select
                              value={sub.responsable_id || ""}
                              onChange={e => assignSubtaskUser(sub.id, e.target.value)}
                              style={{ border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11, padding: "2px 4px", background: "white" }}
                            >
                              <option value="">Responsable...</option>
                              {users.map(u => <option key={u.id} value={u.id}>{formatUsername(u.username)}</option>)}
                            </select>

                            <button
                              onClick={() => deleteSubtask(sub.id)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "#EF4444", fontSize: 13 }}
                              title="Borrar subtarea"
                            >
                              🗑
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Subtask Input */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="new-subtask-desc"
                        placeholder="Escribe una nueva subtarea..."
                        style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            addSubtask(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById("new-subtask-desc");
                          if (input && input.value.trim()) {
                            addSubtask(input.value);
                            input.value = "";
                          }
                        }}
                        style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        + Añadir
                      </button>
                    </div>

                    {activityHistorial.length > 0 && (
                      <div style={{ marginTop: 8, background: "white", borderRadius: 10, border: "1px solid #E5E7EB", padding: 12 }}>
                        <h5 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 800, color: "#374151" }}>📜 Historial de versiones</h5>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                          {activityHistorial.map(h => (
                            <div key={h.id} style={{ fontSize: 11, color: "#6B7280", borderBottom: "1px solid #F3F4F6", paddingBottom: 4 }}>
                              <strong style={{ color: "var(--primary)" }}>{new Date(h.created_at).toLocaleString("es-PE")}</strong>
                              {" · "}{h.guardado_por || "sistema"}
                              {" — "}{h.snapshot?.tarea || "—"} ({h.snapshot?.estado || "—"})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              background: "#F3F4F6", padding: "14px 24px", borderTop: "1px solid #E5E7EB",
              display: "flex", justifyContent: "flex-end", gap: 10
            }}>
              <button
                onClick={() => setActivityDetailModal(null)}
                style={{ border: "1px solid #D1D5DB", background: "white", color: "#374151", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar / Cerrar
              </button>
              <button
                onClick={handleApplyChanges}
                disabled={!activityDetailModal.tarea?.trim()}
                style={{
                  border: "none", background: "var(--primary)", color: "white", borderRadius: 8,
                  padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: activityDetailModal.tarea?.trim() ? "pointer" : "not-allowed",
                  opacity: activityDetailModal.tarea?.trim() ? 1 : 0.6
                }}
              >
                Aplicar Detalles a la Grilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exportar Excel */}
      {showExportModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(11, 46, 51, 0.4)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000
        }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>Exportar Planificación</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "#6B7280" }}>Filtra qué actividades incluir en el Excel. Por defecto se usan tus filtros activos.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" value={exportFilters.fechaInicio} onChange={e => setExportFilters(p => ({ ...p, fechaInicio: e.target.value }))}
                  style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
                <span style={{ alignSelf: "center", fontSize: 12, color: "#9CA3AF" }}>a</span>
                <input type="date" value={exportFilters.fechaFin} onChange={e => setExportFilters(p => ({ ...p, fechaFin: e.target.value }))}
                  style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
              </div>
              <select value={exportFilters.prioridad} onChange={e => setExportFilters(p => ({ ...p, prioridad: e.target.value }))}
                style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={exportFilters.estado} onChange={e => setExportFilters(p => ({ ...p, estado: e.target.value }))}
                style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                <option value="">Todos los estados</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={exportFilters.cliente} onChange={e => setExportFilters(p => ({ ...p, cliente: e.target.value }))}
                placeholder="Filtrar por cliente..."
                style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
              <select value={exportFilters.responsable} onChange={e => setExportFilters(p => ({ ...p, responsable: e.target.value }))}
                style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                <option value="">Todos los responsables</option>
                <option value="__none__">Sin responsable asignado</option>
                {users.map(u => <option key={u.id} value={u.id}>{formatUsername(u.username)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowExportModal(false)}
                style={{ border: "1px solid #D1D5DB", background: "white", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <div onClick={() => setShowExportModal(false)}>
                <ExportExcelButton
                  url="/planificacion/actividades/export"
                  filename={`planificacion_${new Date().toISOString().slice(0, 10)}.xlsx`}
                  label="Descargar Excel"
                  params={buildExportParams(exportFilters)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt de Motivo de Cancelación */}
      {cancelModalData && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(11, 46, 51, 0.4)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 450,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 800, color: "#DC2626" }}>
              ⚠️ Cancelar Actividad
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#4B5563" }}>
              Por favor, ingresa el motivo de la cancelación de la tarea <strong style={{ color: "var(--primary)" }}>"{cancelModalData.row.tarea}"</strong>. Esto quedará registrado en las notas:
            </p>

            <textarea
              value={cancelModalData.motivo}
              onChange={e => setCancelModalData(prev => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ej. El cliente decidió posponer el servicio indefinidamente..."
              rows={3}
              style={{ ...COMPACT_INPUT, resize: "none" }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setCancelModalData(null)}
                style={{ border: "1px solid #D1D5DB", background: "white", color: "#374151", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Volver
              </button>
              <button
                onClick={confirmCancel}
                disabled={!cancelModalData.motivo.trim()}
                style={{
                  border: "none", background: "#DC2626", color: "white", borderRadius: 8,
                  padding: "8px 18px", fontSize: 13, fontWeight: 700,
                  cursor: cancelModalData.motivo.trim() ? "pointer" : "not-allowed",
                  opacity: cancelModalData.motivo.trim() ? 1 : 0.5
                }}
              >
                Cancelar y Archivar Actividad
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </Layout>
  );
}
