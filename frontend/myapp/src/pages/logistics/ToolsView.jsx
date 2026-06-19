import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch } from "../../services/api";

const TABS = ["Asignados", "Asignar", "Mantenimiento", "Calibración"];

const CONDITION_OPTS = ["Bueno", "Regular", "Deteriorado", "Para mantenimiento"];

const CONDITION_STYLES = {
  Bueno:                { bg: "#DCFCE7", color: "#166534" },
  Regular:              { bg: "#FEF9C3", color: "#854D0E" },
  Deteriorado:          { bg: "#FEE2E2", color: "#991B1B" },
  "Para mantenimiento": { bg: "#FFEDD5", color: "#9A3412" },
};

function ConditionBadge({ value }) {
  const s = CONDITION_STYLES[value] || { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>
      {value || "—"}
    </span>
  );
}

function ReturnModal({ assignment, onClose, onSuccess }) {
  const [form, setForm] = useState({ condition_in: "Bueno", return_notes: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await apiFetch("/logistics/tools/return", {
        method: "POST",
        body: JSON.stringify({ assignment_id: assignment.id, ...form }),
      });
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al registrar devolución");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Registrar Devolución" subtitle={assignment.material_name} onClose={onClose} maxWidth={440}>
      <div className="space-y-4">
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Estado al devolver</label>
          <select
            value={form.condition_in}
            onChange={(e) => setForm((f) => ({ ...f, condition_in: e.target.value }))}
            style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box" }}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          >
            {CONDITION_OPTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Notas (opcional)</label>
          <textarea
            rows={3}
            placeholder="Observaciones sobre el estado del equipo..."
            value={form.return_notes}
            onChange={(e) => setForm((f) => ({ ...f, return_notes: e.target.value }))}
            style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box", resize: "none" }}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>
        {error && <p style={{ color: "#DC2626", fontSize: 13, background: "#FEF2F2", padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
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
            onClick={submit} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#4F7C82", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Guardando..." : "Registrar devolución"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const fieldStyle = {
  width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
  padding: "9px 12px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box",
};
const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
};

// ── Buscador de materiales con autocompletado ─────────────────────────────────
function MaterialSearchSelect({ materials, value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  const selected = materials.find(m => m.id === value);

  const filtered = !query.trim()
    ? materials.slice(0, 30)
    : materials.filter(m => {
        const q = query.toLowerCase();
        return (
          m.name?.toLowerCase().includes(q) ||
          m.code?.toLowerCase().includes(q) ||
          m.brand?.toLowerCase().includes(q) ||
          m.model?.toLowerCase().includes(q)
        );
      }).slice(0, 30);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayText = selected ? `${selected.code} — ${selected.name}` : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={open ? query : displayText}
          placeholder={placeholder || "Buscar por nombre, código, marca..."}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
          onFocus={e => { setOpen(true); setQuery(""); e.target.style.borderColor = "#4F7C82"; }}
          onBlur={e => { if (!open) e.target.style.borderColor = "#E5E7EB"; }}
          style={{ ...fieldStyle, paddingRight: value ? 30 : 12 }}
        />
        {value && (
          <button type="button"
            onMouseDown={e => { e.preventDefault(); onChange(""); setQuery(""); setOpen(false); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, lineHeight: 1, padding: 0 }}>
            ×
          </button>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1.5px solid #4F7C82", borderRadius: 10, maxHeight: 240, overflowY: "auto", zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "14px 16px", color: "#9CA3AF", fontSize: 13 }}>
              Sin resultados para "{query}"
            </div>
          ) : (
            filtered.map(m => (
              <div key={m.id}
                onMouseDown={e => { e.preventDefault(); onChange(m.id); setOpen(false); setQuery(""); }}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}
                onMouseEnter={e => e.currentTarget.style.background = "#F0F9FA"}
                onMouseLeave={e => e.currentTarget.style.background = "white"}
              >
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#4F7C82", background: "#EEF7F8", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>
                  {m.code}
                </span>
                <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}
                </span>
                {m.brand && (
                  <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{m.brand}</span>
                )}
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#F3F4F6", color: "#6B7280", flexShrink: 0 }}>
                  {m.category}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AssignTab({ materials, projects, onAssigned }) {
  const [form, setForm] = useState({
    material_id: "", project_id: "", assigned_to: "",
    expected_return: "", condition_out: "Bueno",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.material_id || !form.assigned_to.trim()) {
      setError("Equipo y responsable son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch("/logistics/tools/assign", {
        method: "POST",
        body: JSON.stringify({
          material_id:     form.material_id,
          project_id:      form.project_id || null,
          assigned_to:     form.assigned_to.trim(),
          expected_return: form.expected_return || null,
          condition_out:   form.condition_out,
        }),
      });
      setSuccess(true);
      setForm({ material_id: "", project_id: "", assigned_to: "", expected_return: "", condition_out: "Bueno" });
      onAssigned();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message || "Error al registrar asignación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>Equipo / Herramienta *</label>
        <MaterialSearchSelect
          materials={materials}
          value={form.material_id}
          onChange={v => setForm(f => ({ ...f, material_id: v }))}
          placeholder="Buscar por nombre, código, marca..."
        />
      </div>

      <div>
        <label style={labelStyle}>Asignado a (Responsable) *</label>
        <input type="text" placeholder="Nombre del responsable" value={form.assigned_to}
          onChange={set("assigned_to")} style={fieldStyle}
          onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>Proyecto (opcional)</label>
          <select value={form.project_id} onChange={set("project_id")} style={fieldStyle}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
            <option value="">Sin proyecto</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Fecha retorno esperada</label>
          <input type="date" value={form.expected_return} onChange={set("expected_return")} style={fieldStyle}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Estado al salir</label>
        <select value={form.condition_out} onChange={set("condition_out")} style={fieldStyle}
          onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
          {CONDITION_OPTS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {error   && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", color: "#166534", fontSize: 13 }}>Asignación registrada correctamente.</div>}

      <div>
        <button onClick={submit} disabled={loading}
          style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: "#4F7C82", color: "white", border: "none", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Registrando..." : "Registrar asignación"}
        </button>
      </div>
    </div>
  );
}

function MaintenanceTab({ materials }) {
  const [alerts, setAlerts]   = useState([]);
  const [form, setForm]       = useState({
    material_id: "", maintenance_type: "", last_maintenance: "",
    next_due: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/logistics/tools/maintenance/alerts")
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.material_id || !form.maintenance_type.trim() || !form.last_maintenance || !form.next_due) {
      setError("Equipo, tipo, última fecha y próxima fecha son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch("/logistics/tools/maintenance", {
        method: "POST",
        body: JSON.stringify({
          material_id:       form.material_id,
          maintenance_type:  form.maintenance_type.trim(),
          last_maintenance:  form.last_maintenance,
          next_due:          form.next_due,
          notes:             form.notes || null,
        }),
      });
      setSuccess(true);
      setForm({ material_id: "", maintenance_type: "", last_maintenance: "", next_due: "", notes: "" });
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message || "Error al programar mantenimiento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Alertas */}
      {alerts.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F97316", display: "inline-block" }} />
            Alertas de mantenimiento ({alerts.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 16px" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{a.material_name || a.material_id}</p>
                  <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{a.maintenance_type} — Vence: {a.next_due}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, background: "#FFEDD5", color: "#9A3412", border: "1px solid #FED7AA", padding: "3px 10px", borderRadius: 99 }}>
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Programar mantenimiento */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 16 }}>Programar mantenimiento</p>
        <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Equipo *</label>
            <MaterialSearchSelect
              materials={materials}
              value={form.material_id}
              onChange={v => setForm(f => ({ ...f, material_id: v }))}
              placeholder="Buscar por nombre, código, marca..."
            />
          </div>

          <div>
            <label style={labelStyle}>Tipo de mantenimiento *</label>
            <input type="text" placeholder="Ej: Calibración, Limpieza, Revisión general"
              value={form.maintenance_type} onChange={set("maintenance_type")} style={fieldStyle}
              onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Último mantenimiento *</label>
              <input type="date" value={form.last_maintenance} onChange={set("last_maintenance")} style={fieldStyle}
                onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={labelStyle}>Próximo vencimiento *</label>
              <input type="date" value={form.next_due} onChange={set("next_due")} style={fieldStyle}
                onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notas</label>
            <textarea rows={2} placeholder="Observaciones adicionales..."
              value={form.notes} onChange={set("notes")}
              style={{ ...fieldStyle, resize: "none" }}
              onFocus={(e) => e.target.style.borderColor = "#4F7C82"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
          </div>

          {error   && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{error}</div>}
          {success && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", color: "#166534", fontSize: 13 }}>Mantenimiento programado correctamente.</div>}

          <div>
            <button onClick={submit} disabled={loading}
              style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: "#4F7C82", color: "white", border: "none", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Guardando..." : "Programar mantenimiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalibrationTab({ allEquipment }) {
  const [alerts,  setAlerts]  = useState([]);
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ material_id: "", calibrated_at: "", expires_at: "", certificate_url: "", technician: "", notes: "" });
  const [fLoading, setFLoading] = useState(false);
  const [fError,   setFError]   = useState("");
  const [fSuccess, setFSuccess] = useState(false);
  const [histMat,  setHistMat]  = useState(null);
  const [history,  setHistory]  = useState([]);
  const [hLoading, setHLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ar, lr] = await Promise.allSettled([
      apiFetch("/logistics/calibrations/alerts"),
      apiFetch("/logistics/calibrations/list"),
    ]);
    if (ar.status === "fulfilled") setAlerts(Array.isArray(ar.value) ? ar.value : []);
    if (lr.status === "fulfilled") setList(Array.isArray(lr.value) ? lr.value : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const overdue = alerts.filter(a => !a.expires_at || a.days_left < 0);
  const weekly  = alerts.filter(a => a.days_left !== null && a.days_left >= 0 && a.days_left <= 7);
  const monthly = alerts.filter(a => a.days_left !== null && a.days_left > 7 && a.days_left <= 30);

  const handleCalibratedAt = (val) => {
    const d = new Date(val);
    d.setFullYear(d.getFullYear() + 1);
    setForm(f => ({ ...f, calibrated_at: val, expires_at: d.toISOString().slice(0, 10) }));
  };

  const submitCalibration = async () => {
    if (!form.material_id || !form.calibrated_at || !form.expires_at) {
      setFError("Equipo, fecha de calibración y vencimiento son obligatorios"); return;
    }
    setFLoading(true); setFError("");
    try {
      await apiFetch("/logistics/calibrations", {
        method: "POST",
        body: JSON.stringify({
          material_id: form.material_id, calibrated_at: form.calibrated_at,
          expires_at: form.expires_at, certificate_url: form.certificate_url || null,
          technician: form.technician || null, notes: form.notes || null,
        }),
      });
      // Auto-flag as calibration_required if not already in the list
      const alreadyTracked = list.some(i => i.material_id === form.material_id);
      if (!alreadyTracked) {
        await apiFetch(`/logistics/calibrations/flag/${form.material_id}`, {
          method: "PATCH",
          body: JSON.stringify({ required: true }),
        }).catch(() => {});
      }
      setFSuccess(true);
      setForm({ material_id: "", calibrated_at: "", expires_at: "", certificate_url: "", technician: "", notes: "" });
      load(); setShowForm(false);
      setTimeout(() => setFSuccess(false), 3000);
    } catch (e) { setFError(e.message || "Error"); }
    finally { setFLoading(false); }
  };

  const openHistory = async (item) => {
    if (histMat?.material_id === item.material_id) { setHistMat(null); return; }
    setHistMat(item); setHLoading(true); setHistory([]);
    try {
      const res = await apiFetch(`/logistics/calibrations/history/${item.material_id}`);
      setHistory(Array.isArray(res) ? res : []);
    } catch {}
    setHLoading(false);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString("es-PE");

    // Hoja 1: Lista completa
    const headers = ["#", "Equipo", "Código", "Intervalo (días)", "Última Calibración", "Vencimiento", "Días Restantes", "Estado", "Técnico", "Notas"];
    const rows = list.map((item, idx) => {
      const b = urgencyBadge(item.days_left, item.expires_at);
      return [
        idx + 1,
        item.material_name || "",
        item.material_code || "",
        item.interval_days || "",
        item.calibrated_at ? new Date(item.calibrated_at).toLocaleDateString("es-PE") : "Sin registro",
        item.expires_at    ? new Date(item.expires_at).toLocaleDateString("es-PE")    : "—",
        item.days_left !== null && item.days_left !== undefined ? item.days_left : "—",
        b.label,
        item.technician || "—",
        item.notes || "",
      ];
    });
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws1["!cols"] = [
      { wch: 5 }, { wch: 34 }, { wch: 12 }, { wch: 16 },
      { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Calibración");

    // Hoja 2: Alertas activas
    const alertRows = [
      ...overdue.map(a => ["VENCIDO / SIN REGISTRO", a.material_name, a.material_code, a.expires_at ? new Date(a.expires_at).toLocaleDateString("es-PE") : "Sin registro", a.days_left ?? "—"]),
      ...weekly.map(a  => ["Vence esta semana",       a.material_name, a.material_code, a.expires_at ? new Date(a.expires_at).toLocaleDateString("es-PE") : "—", a.days_left]),
      ...monthly.map(a => ["Vence este mes",          a.material_name, a.material_code, a.expires_at ? new Date(a.expires_at).toLocaleDateString("es-PE") : "—", a.days_left]),
    ];
    if (alertRows.length > 0) {
      const ws2 = XLSX.utils.aoa_to_sheet([
        ["Nivel de Urgencia", "Equipo", "Código", "Vencimiento", "Días Restantes"],
        ...alertRows,
      ]);
      ws2["!cols"] = [{ wch: 22 }, { wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Alertas");
    }

    XLSX.writeFile(wb, `calibracion_${today.replace(/\//g, "-")}.xlsx`);
  };

  const urgencyBadge = (daysLeft, expiresAt) => {
    if (!expiresAt)     return { label: "Sin registro",  bg: "#FEE2E2", color: "#991B1B" };
    if (daysLeft < 0)   return { label: `Vencido ${Math.abs(daysLeft)}d`, bg: "#FEE2E2", color: "#991B1B" };
    if (daysLeft <= 7)  return { label: `${daysLeft}d restantes`, bg: "#FFEDD5", color: "#9A3412" };
    if (daysLeft <= 30) return { label: `${daysLeft}d restantes`, bg: "#FEF9C3", color: "#854D0E" };
    return { label: `${daysLeft}d restantes`, bg: "#DCFCE7", color: "#166534" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Alert banners */}
      {(overdue.length > 0 || weekly.length > 0 || monthly.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {overdue.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🔴</span>
              <div>
                <p style={{ fontWeight: 700, color: "#991B1B", fontSize: 13, margin: 0 }}>
                  {overdue.length} equipo{overdue.length > 1 ? "s" : ""} con calibración VENCIDA o sin registro
                </p>
                <p style={{ fontSize: 12, color: "#DC2626", margin: "3px 0 0" }}>
                  {overdue.map(a => a.material_name).join(" · ")}
                </p>
              </div>
            </div>
          )}
          {weekly.length > 0 && (
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🟠</span>
              <div>
                <p style={{ fontWeight: 700, color: "#9A3412", fontSize: 13, margin: 0 }}>
                  {weekly.length} equipo{weekly.length > 1 ? "s" : ""} vence en menos de 1 semana
                </p>
                <p style={{ fontSize: 12, color: "#EA580C", margin: "3px 0 0" }}>
                  {weekly.map(a => `${a.material_name} (${a.days_left}d)`).join(" · ")}
                </p>
              </div>
            </div>
          )}
          {monthly.length > 0 && (
            <div style={{ background: "#FEFCE8", border: "1px solid #FDE047", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🟡</span>
              <div>
                <p style={{ fontWeight: 700, color: "#854D0E", fontSize: 13, margin: 0 }}>
                  {monthly.length} equipo{monthly.length > 1 ? "s" : ""} vence dentro de 1 mes
                </p>
                <p style={{ fontSize: 12, color: "#CA8A04", margin: "3px 0 0" }}>
                  {monthly.map(a => `${a.material_name} (${a.days_left}d)`).join(" · ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header + add button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontWeight: 700, color: "#374151", fontSize: 14, margin: 0 }}>
          Equipos con calibración requerida ({list.length})
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {list.length > 0 && (
            <button onClick={exportExcel}
              style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", borderRadius: 9, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#DCFCE7"}
              onMouseLeave={e => e.currentTarget.style.background = "#F0FDF4"}>
              ↓ Excel
            </button>
          )}
          <button onClick={() => setShowForm(f => !f)}
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: showForm ? "#F3F4F6" : "#4F7C82", color: showForm ? "#374151" : "white", border: "none", borderRadius: 9, cursor: "pointer" }}>
            {showForm ? "× Cancelar" : "+ Registrar calibración"}
          </button>
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 16px" }}>Nueva calibración</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 640 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Equipo * <span style={{ fontWeight: 400, fontSize: 10, color: "#9CA3AF", textTransform: "none", letterSpacing: 0 }}>— Equipo / Herramienta / Instrumento</span>
              </label>
              <MaterialSearchSelect
                materials={allEquipment}
                value={form.material_id}
                onChange={v => setForm(f => ({ ...f, material_id: v }))}
                placeholder="Buscar equipo por nombre, código, marca..."
              />
            </div>
            <div>
              <label style={labelStyle}>Fecha calibración *</label>
              <input type="date" value={form.calibrated_at} onChange={e => handleCalibratedAt(e.target.value)}
                style={fieldStyle} onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={labelStyle}>Vence *</label>
              <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                style={fieldStyle} onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Enlace certificado (URL)</label>
              <input type="url" placeholder="https://drive.google.com/..." value={form.certificate_url}
                onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))}
                style={fieldStyle} onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={labelStyle}>Técnico calibrador</label>
              <input type="text" placeholder="Nombre del técnico" value={form.technician}
                onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}
                style={fieldStyle} onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={labelStyle}>Notas</label>
              <input type="text" placeholder="Observaciones..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={fieldStyle} onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
          </div>
          {fError   && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginTop: 12 }}>{fError}</div>}
          {fSuccess && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", color: "#166534", fontSize: 13, marginTop: 12 }}>Calibración registrada correctamente.</div>}
          <div style={{ marginTop: 16 }}>
            <button onClick={submitCalibration} disabled={fLoading}
              style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: "#0B2E33", color: "white", border: "none", borderRadius: 9, cursor: fLoading ? "not-allowed" : "pointer", opacity: fLoading ? 0.6 : 1 }}>
              {fLoading ? "Guardando..." : "Registrar calibración"}
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      {histMat && (
        <div style={{ background: "#F0F9FA", border: "1px solid #B8E3E9", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontWeight: 700, color: "#0B2E33", fontSize: 14, margin: 0 }}>
              Historial: {histMat.material_name}
            </p>
            <button onClick={() => setHistMat(null)}
              style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#6B7280", lineHeight: 1 }}>×</button>
          </div>
          {hLoading ? (
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>Cargando...</p>
          ) : history.length === 0 ? (
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>Sin registros de calibración aún.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((h) => (
                <div key={h.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 110 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Calibrado</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "3px 0 0" }}>{h.calibrated_at ? new Date(h.calibrated_at).toLocaleDateString("es-PE") : "—"}</p>
                  </div>
                  <div style={{ minWidth: 110 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Vence</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "3px 0 0" }}>{h.expires_at ? new Date(h.expires_at).toLocaleDateString("es-PE") : "—"}</p>
                  </div>
                  <div style={{ minWidth: 120 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Técnico</p>
                    <p style={{ fontSize: 13, color: "#374151", margin: "3px 0 0" }}>{h.technician || "—"}</p>
                  </div>
                  {h.notes && (
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Notas</p>
                      <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0" }}>{h.notes}</p>
                    </div>
                  )}
                  {h.certificate_url && (
                    <a href={h.certificate_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, fontWeight: 700, color: "#4F7C82", textDecoration: "none", padding: "6px 12px", background: "#F0F9FA", border: "1px solid #B8E3E9", borderRadius: 7, flexShrink: 0 }}>
                      📄 Ver certificado
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main table */}
      <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px 130px 130px 110px 110px", gap: 8, padding: "11px 16px", background: "#0B2E33" }}>
          {["#", "Equipo", "Intervalo", "Última calibración", "Vencimiento", "Estado", "Acción"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Sin equipos con calibración requerida. Activa el flag en el catálogo de materiales.
          </div>
        ) : (
          list.map((item, idx) => {
            const badge = urgencyBadge(item.days_left, item.expires_at);
            const isSelected = histMat?.material_id === item.material_id;
            return (
              <div key={item.material_id}
                style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px 130px 130px 110px 110px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: idx < list.length - 1 ? "1px solid #F3F4F6" : "none", background: isSelected ? "#F0F9FA" : idx % 2 === 0 ? "white" : "#FAFAFA" }}>
                <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>{idx + 1}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{item.material_name}</p>
                  <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4F7C82", margin: "2px 0 0" }}>{item.material_code}</p>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  {item.interval_days ? `${item.interval_days} días` : "—"}
                </div>
                <div style={{ fontSize: 12, color: "#374151" }}>
                  {item.calibrated_at ? new Date(item.calibrated_at).toLocaleDateString("es-PE") : <span style={{ color: "#D1D5DB" }}>Sin registro</span>}
                </div>
                <div style={{ fontSize: 12, color: "#374151" }}>
                  {item.expires_at ? new Date(item.expires_at).toLocaleDateString("es-PE") : <span style={{ color: "#D1D5DB" }}>—</span>}
                </div>
                <div>
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => openHistory(item)}
                    style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", background: isSelected ? "#B8E3E9" : "#F3F4F6", color: isSelected ? "#0B2E33" : "#374151", border: "none", borderRadius: 7, cursor: "pointer" }}>
                    {isSelected ? "▲ Hist." : "📋 Hist."}
                  </button>
                  {item.certificate_url && (
                    <a href={item.certificate_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, fontWeight: 600, padding: "5px 8px", background: "#F0F9FA", color: "#4F7C82", border: "1px solid #B8E3E9", borderRadius: 7, textDecoration: "none" }}>
                      Cert.
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ToolsView() {
  const navigate = useNavigate();
  const [tab,           setTab]        = useState(0);
  const [assigned,      setAssigned]   = useState([]);
  const [materials,     setMaterials]  = useState([]);
  const [projects,      setProjects]   = useState([]);
  const [loading,       setLoading]    = useState(true);
  const [returning,     setReturning]  = useState(null);
  const [projectFilter, setProjectFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [assignRes, matRes, projRes] = await Promise.allSettled([
      apiFetch("/logistics/tools/assigned"),
      apiFetch("/logistics/materials"),
      apiFetch("/logistics/projects"),
    ]);
    if (assignRes.status === "fulfilled") setAssigned(Array.isArray(assignRes.value) ? assignRes.value : []);
    if (matRes.status    === "fulfilled") setMaterials(Array.isArray(matRes.value) ? matRes.value : []);
    if (projRes.status   === "fulfilled") setProjects(Array.isArray(projRes.value) ? projRes.value : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toolMaterials = materials.filter(
    (m) => m.category === "Equipo" || m.category === "Herramienta" || m.category === "Instrumento"
  );

  const filteredAssigned = projectFilter
    ? assigned.filter(a => a.project_id === projectFilter)
    : assigned;

  return (
    <Layout>
      {returning && (
        <ReturnModal
          assignment={returning}
          onClose={() => setReturning(null)}
          onSuccess={() => { setReturning(null); load(); }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
            Equipos y Herramientas
          </h1>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
            {assigned.length} asignaciones activas
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              style={{
                padding: "7px 18px", borderRadius: 7, fontSize: 13,
                fontWeight: tab === i ? 700 : 500,
                background: tab === i ? "#0B2E33" : "transparent",
                color: tab === i ? "white" : "#6B7280",
                border: "none", cursor: "pointer",
                boxShadow: tab === i ? "0 2px 6px rgba(11,46,51,0.35)" : "none",
              }}
            >
              {t}
              {i === 0 && assigned.length > 0 && (
                <span
                  className="ml-1.5 text-xs rounded-full px-1.5 py-0.5"
                  style={{ background: "#4F7C82", color: "white" }}
                >
                  {assigned.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab 0: Assigned tools */}
        {tab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Filtro por proyecto */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Filtrar por proyecto:</span>
                <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                  style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "white", color: "#374151", cursor: "pointer" }}>
                  <option value="">Todos los proyectos</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              {projectFilter && (
                <button onClick={() => navigate(`/logistics/projects/${projectFilter}`)}
                  style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", background: "#0B2E33", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
                  Ver detalle 360° →
                </button>
              )}
              <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: "auto" }}>
                {filteredAssigned.length} de {assigned.length} asignaciones
              </span>
            </div>

            <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 160px 100px 100px 80px", gap: 8, padding: "11px 16px", background: "#0B2E33" }}>
                {["#","Equipo","Responsable","Proyecto","Condición","Retorno","Acción"].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
              ) : filteredAssigned.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  {projectFilter ? "Sin herramientas asignadas a este proyecto." : "No hay equipos asignados actualmente."}
                </div>
              ) : (
                <div>
                  {filteredAssigned.map((a, idx) => (
                    <div key={a.id}
                      style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 160px 100px 100px 80px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: idx < filteredAssigned.length - 1 ? "1px solid #F3F4F6" : "none", background: idx % 2 === 0 ? "white" : "#FAFAFA" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F0F9FA"}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#FAFAFA"}>
                      <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>{idx + 1}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{a.material_name}</p>
                        <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4F7C82", margin: "2px 0 0" }}>{a.material_code}</p>
                      </div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{a.assigned_to}</div>
                      <div>
                        {a.project_name ? (
                          <button onClick={() => navigate(`/logistics/projects/${a.project_id}`)}
                            style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "#F0FDFA", color: "#0F766E", border: "1px solid #99F6E4", cursor: "pointer" }}>
                            {a.project_name}
                          </button>
                        ) : <span style={{ color: "#D1D5DB", fontSize: 13 }}>—</span>}
                      </div>
                      <div><ConditionBadge value={a.condition_out} /></div>
                      <div style={{ fontSize: 12, color: a.expected_return && new Date(a.expected_return) < new Date() ? "#DC2626" : "#6B7280", fontWeight: a.expected_return && new Date(a.expected_return) < new Date() ? 700 : 400 }}>
                        {a.expected_return ? new Date(a.expected_return).toLocaleDateString("es-PE") : "—"}
                      </div>
                      <div>
                        <button onClick={() => setReturning(a)}
                          style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", background: "#4F7C82", color: "white", border: "none", borderRadius: 7, cursor: "pointer" }}>
                          Devolver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Assign */}
        {tab === 1 && (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 20 }}>Nueva asignación de equipo</p>
            <AssignTab
              materials={toolMaterials.length > 0 ? toolMaterials : materials}
              projects={projects}
              onAssigned={() => { load(); setTab(0); }}
            />
          </div>
        )}

        {/* Tab 2: Maintenance */}
        {tab === 2 && (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24 }}>
            <MaintenanceTab materials={toolMaterials.length > 0 ? toolMaterials : materials} />
          </div>
        )}

        {/* Tab 3: Calibration */}
        {tab === 3 && (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24 }}>
            <CalibrationTab allEquipment={toolMaterials.length > 0 ? toolMaterials : materials} />
          </div>
        )}
      </div>
    </Layout>
  );
}
