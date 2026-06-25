import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch, BASE_URL as API } from "../../services/api";
import ExportExcelButton from "../../components/ExportExcelButton";
const TOKEN = () => localStorage.getItem("access_token");

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  deep:  "#0B2E33",
  mid:   "#4F7C82",
  light: "#B8E3E9",
  sub:   "#93B1B5",
};

const STATUS_CFG = {
  PENDIENTE:    { label: "Pendiente",    bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
  EN_EJECUCION: { label: "En Ejecución", bg: "#DBEAFE", color: "#1E40AF", border: "#93C5FD" },
  PAUSADA:      { label: "Pausada",      bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
  COMPLETADA:   { label: "Completada",   bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
  CERRADA:      { label: "Cerrada",      bg: "#F3F4F6", color: "#374151", border: "#D1D5DB" },
  CANCELADA:    { label: "Cancelada",    bg: "#F3F4F6", color: "#6B7280", border: "#D1D5DB" },
};

const TIPO_CFG = {
  CORRECTIVO: { label: "Correctivo", color: "#DC2626" },
  PREVENTIVO: { label: "Preventivo", color: "#2563EB" },
  EMERGENCIA: { label: "Emergencia", color: "#7C3AED" },
};

const PRIO_CFG = {
  URGENTE: { label: "🔴 Urgente", color: "#DC2626" },
  ALTA:    { label: "🟠 Alta",    color: "#EA580C" },
  NORMAL:  { label: "🟡 Normal",  color: "#CA8A04" },
  BAJA:    { label: "🟢 Baja",    color: "#16A34A" },
};

const KANBAN_COLS = ["PENDIENTE", "EN_EJECUCION", "PAUSADA", "COMPLETADA", "CERRADA"];

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

// ── Modal nueva OT ─────────────────────────────────────────────────────────────
function NuevaOTModal({ plans, onClose, onCreate }) {
  const [form, setForm] = useState({
    titulo: "", tipo: "CORRECTIVO", prioridad: "NORMAL",
    plan_id: "", lugar_trabajo: "", horas_estimadas: "",
    fecha_inicio_plan: "", descripcion: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const inp = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box",
  };
  const lbl = { fontSize: 12, color: "#4B5563", display: "block", marginBottom: 3, fontWeight: 600 };

  const submit = async () => {
    if (!form.titulo.trim()) return setErr("El título es obligatorio");
    setLoading(true); setErr("");
    try {
      const body = {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        prioridad: form.prioridad,
        plan_id: form.plan_id || null,
        lugar_trabajo: form.lugar_trabajo || null,
        horas_estimadas: form.horas_estimadas ? parseFloat(form.horas_estimadas) : null,
        fecha_inicio_plan: form.fecha_inicio_plan || null,
        descripcion: form.descripcion || null,
      };
      const data = await apiFetch("/ot", { method: "POST", body: JSON.stringify(body) });
      onCreate(data.id);
    } catch (e) {
      setErr(e.message ?? "Error al crear OT");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 4px", color: C.deep, fontSize: 17, fontWeight: 800 }}>Nueva Orden de Trabajo</h3>
        <p style={{ margin: "0 0 18px", color: "#64748B", fontSize: 12 }}>
          El código se genera automáticamente (ej: <strong>OT-2026-0001</strong>)
        </p>

        <label style={lbl}>Título *</label>
        <input style={{ ...inp, marginBottom: 12 }} autoFocus
          value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          placeholder="Ej: Mantenimiento tablero eléctrico sala principal"
          onKeyDown={e => e.key === "Enter" && submit()}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Tipo</label>
            <select style={inp} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              <option value="CORRECTIVO">Correctivo</option>
              <option value="PREVENTIVO">Preventivo</option>
              <option value="EMERGENCIA">Emergencia</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Prioridad</label>
            <select style={inp} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
              <option value="URGENTE">🔴 Urgente</option>
              <option value="ALTA">🟠 Alta</option>
              <option value="NORMAL">🟡 Normal</option>
              <option value="BAJA">🟢 Baja</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Plan de proyecto</label>
            <select style={inp} value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}>
              <option value="">Sin plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Horas estimadas</label>
            <input style={inp} type="number" min="0" step="0.5"
              value={form.horas_estimadas} onChange={e => setForm(f => ({ ...f, horas_estimadas: e.target.value }))}
              placeholder="Ej: 4.5"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Lugar de trabajo</label>
            <input style={inp} value={form.lugar_trabajo}
              onChange={e => setForm(f => ({ ...f, lugar_trabajo: e.target.value }))}
              placeholder="Ej: Sala de máquinas piso 2"
            />
          </div>
          <div>
            <label style={lbl}>Fecha inicio planificada</label>
            <input style={inp} type="datetime-local" value={form.fecha_inicio_plan}
              onChange={e => setForm(f => ({ ...f, fecha_inicio_plan: e.target.value }))}
            />
          </div>
        </div>

        <label style={lbl}>Descripción</label>
        <textarea style={{ ...inp, marginBottom: 14, resize: "vertical" }} rows={2}
          value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          placeholder="Descripción del trabajo a realizar..."
        />

        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 10px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: C.mid, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {loading ? "Creando..." : "Crear OT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta OT ────────────────────────────────────────────────────────────────
function OTCard({ ot, onClick }) {
  const tipo   = TIPO_CFG[ot.tipo]   ?? { label: ot.tipo,     color: "#64748B" };
  const prio   = PRIO_CFG[ot.prioridad] ?? { label: ot.prioridad, color: "#64748B" };

  return (
    <div onClick={onClick} style={{
      background: "#fff", borderRadius: 10, padding: "12px 14px",
      border: "1px solid #E5E7EB", cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      transition: "box-shadow 0.15s, transform 0.15s",
      marginBottom: 8,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Code + priority */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: C.mid, background: "#F0F9FA", padding: "1px 6px", borderRadius: 4 }}>
          {ot.code}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: prio.color }}>{prio.label}</span>
      </div>

      {/* Título */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.deep, lineHeight: 1.35, marginBottom: 6 }}>
        {ot.titulo}
      </div>

      {/* Tipo + lugar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: tipo.color, background: tipo.color + "15", padding: "2px 7px", borderRadius: 20 }}>
          {tipo.label}
        </span>
        {ot.lugar_trabajo && (
          <span style={{ fontSize: 10, color: "#64748B" }}>📍 {ot.lugar_trabajo}</span>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>
          {ot.asignado_nombre ? `👤 ${ot.asignado_nombre}` : "Sin asignar"}
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>
          {ot.plan_code && <span style={{ background: "#F0FDF4", color: "#166534", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>{ot.plan_code}</span>}
          {ot.horas_estimadas && <span style={{ marginLeft: 4 }}>⏱ {ot.horas_estimadas}h</span>}
        </div>
      </div>
    </div>
  );
}

// ── Columna Kanban ────────────────────────────────────────────────────────────
function KanbanCol({ status, ots, onCardClick }) {
  const cfg = STATUS_CFG[status];
  return (
    <div style={{ flex: "0 0 260px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px", borderRadius: "8px 8px 0 0",
        background: cfg.bg, border: `1px solid ${cfg.border}`, borderBottom: "none",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color,
          background: cfg.color + "20", padding: "1px 7px", borderRadius: 20 }}>
          {ots.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1, padding: "8px 8px 8px",
        background: "#F9FAFB", border: `1px solid ${cfg.border}`,
        borderRadius: "0 0 8px 8px", minHeight: 120,
        overflowY: "auto", maxHeight: "calc(100vh - 260px)",
      }}>
        {ots.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB", fontSize: 12 }}>Sin OTs</div>
        ) : (
          ots.map(ot => <OTCard key={ot.id} ot={ot} onClick={() => onCardClick(ot.id)} />)
        )}
      </div>
    </div>
  );
}

// ── Vista lista ───────────────────────────────────────────────────────────────
function ListView({ ots, onRowClick }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.deep, color: "white" }}>
            {["Código", "Título", "Tipo", "Prioridad", "Estado", "Plan", "Asignado", "Creado"].map(h => (
              <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ots.map((ot, i) => {
            const scfg = STATUS_CFG[ot.status] ?? { label: ot.status, bg: "#F3F4F6", color: "#374151" };
            return (
              <tr key={ot.id}
                style={{ background: i % 2 === 0 ? "#fff" : "#F9FAFB", cursor: "pointer" }}
                onClick={() => onRowClick(ot.id)}
                onMouseEnter={e => e.currentTarget.style.background = "#EEF7F8"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#F9FAFB"}
              >
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, background: "#F0F9FA", color: C.mid, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>{ot.code}</span>
                </td>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: C.deep, maxWidth: 260 }}>{ot.titulo}</td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TIPO_CFG[ot.tipo]?.color ?? "#64748B" }}>{ot.tipo}</span>
                </td>
                <td style={{ padding: "8px 12px", fontSize: 11 }}>{PRIO_CFG[ot.prioridad]?.label ?? ot.prioridad}</td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ background: scfg.bg, color: scfg.color, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{scfg.label}</span>
                </td>
                <td style={{ padding: "8px 12px", fontSize: 11, color: "#64748B" }}>{ot.plan_code ?? "—"}</td>
                <td style={{ padding: "8px 12px", fontSize: 11, color: "#64748B" }}>{ot.asignado_nombre ?? "—"}</td>
                <td style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF" }}>{fmt(ot.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function OrdenesTrabajoView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [ots,     setOts]     = useState([]);
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view,    setView]    = useState("kanban"); // kanban | list
  const [showNew, setShowNew] = useState(false);
  const [filter,  setFilter]  = useState({
    status:  searchParams.get("status") || "",
    tipo:    "",
    search:  "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set("status", filter.status);
      if (filter.tipo)   params.set("tipo",   filter.tipo);
      const data = await apiFetch(`/ot${params.toString() ? "?" + params.toString() : ""}`);
      setOts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando OTs:", err);
      setLoadError(err.message || "No se pudieron cargar las órdenes de trabajo.");
      setOts([]);
    }
    finally { setLoading(false); }
  }, [filter.status, filter.tipo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch("/operations/plans").then(d => setPlans(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const filtered = ots.filter(ot => {
    if (!filter.search) return true;
    const s = filter.search.toLowerCase();
    return ot.titulo.toLowerCase().includes(s) || ot.code.toLowerCase().includes(s) ||
      (ot.lugar_trabajo ?? "").toLowerCase().includes(s);
  });

  const byStatus = (s) => filtered.filter(ot => ot.status === s);

  const totalesPorStatus = KANBAN_COLS.reduce((acc, s) => {
    acc[s] = byStatus(s).length;
    return acc;
  }, {});

  const inputStyle = { padding: "7px 10px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13 };
  const btnStyle = (active) => ({
    padding: "7px 14px", borderRadius: 7, border: `1px solid ${active ? C.mid : "#D1D5DB"}`,
    background: active ? C.mid : "#fff", color: active ? "#fff" : "#374151",
    cursor: "pointer", fontSize: 13, fontWeight: 600,
  });

  return (
    <Layout>
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: "#F0F9FA" }}>
        {loadError && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.deep }}>Órdenes de Trabajo</h1>
            <p style={{ margin: "3px 0 0", color: "#64748B", fontSize: 13 }}>
              Gestión SAP PM-style — {ots.length} OTs en total
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ExportExcelButton url="/ot/export" filename="ordenes_trabajo.xlsx" />
            <button
              onClick={() => setShowNew(true)}
              style={{ background: C.mid, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              + Nueva OT
            </button>
          </div>
        </div>

        {/* KPI chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {KANBAN_COLS.map(s => {
            const cfg = STATUS_CFG[s];
            const n   = byStatus(s).length;
            return (
              <div key={s} onClick={() => setFilter(f => ({ ...f, status: f.status === s ? "" : s }))}
                style={{
                  background: filter.status === s ? cfg.bg : "#fff",
                  border: `1px solid ${filter.status === s ? cfg.border : "#E5E7EB"}`,
                  borderRadius: 20, padding: "4px 14px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                  transition: "all 0.15s",
                }}>
                <span style={{ fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                <span style={{ background: cfg.color + "20", color: cfg.color, borderRadius: 20, padding: "0 6px", fontWeight: 800, fontSize: 11 }}>{n}</span>
              </div>
            );
          })}
        </div>

        {/* Filtros + vista */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input
            style={{ ...inputStyle, width: 240 }}
            placeholder="Buscar código, título o lugar..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
          <select style={inputStyle} value={filter.tipo} onChange={e => setFilter(f => ({ ...f, tipo: e.target.value }))}>
            <option value="">Todos los tipos</option>
            <option value="CORRECTIVO">Correctivo</option>
            <option value="PREVENTIVO">Preventivo</option>
            <option value="EMERGENCIA">Emergencia</option>
          </select>
          {(filter.status || filter.tipo || filter.search) && (
            <button
              onClick={() => setFilter({ status: "", tipo: "", search: "" })}
              style={{ ...inputStyle, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5", cursor: "pointer" }}>
              ✕ Limpiar
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button style={btnStyle(view === "kanban")} onClick={() => setView("kanban")}>⊞ Kanban</button>
            <button style={btnStyle(view === "list")}   onClick={() => setView("list")}>☰ Lista</button>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>Cargando órdenes de trabajo...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
            <div style={{ fontWeight: 600, color: "#374151", fontSize: 16, marginBottom: 6 }}>Sin órdenes de trabajo</div>
            <div style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 20 }}>
              {filter.search || filter.tipo || filter.status
                ? "No hay OTs que coincidan con los filtros."
                : "Crea la primera orden de trabajo para comenzar."}
            </div>
            {!filter.search && !filter.tipo && !filter.status && (
              <button onClick={() => setShowNew(true)} style={{ background: C.mid, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>
                Crear primera OT
              </button>
            )}
          </div>
        ) : view === "kanban" ? (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
            {KANBAN_COLS.map(s => (
              <KanbanCol key={s} status={s} ots={byStatus(s)} onCardClick={id => navigate(`/operaciones/ot/${id}`)} />
            ))}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF" }}>Sin resultados</div>
            ) : (
              <ListView ots={filtered} onRowClick={id => navigate(`/operaciones/ot/${id}`)} />
            )}
          </div>
        )}
      </div>

      {showNew && (
        <NuevaOTModal
          plans={plans}
          onClose={() => setShowNew(false)}
          onCreate={(id) => { setShowNew(false); navigate(`/operaciones/ot/${id}`); }}
        />
      )}
    </Layout>
  );
}
