import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const STATUS_CFG = {
  DRAFT:     { label: "Borrador",   bg: "#FEF9C3", color: "#854D0E" },
  ACTIVE:    { label: "Activo",     bg: "#DBEAFE", color: "#1D4ED8" },
  SUBMITTED: { label: "Enviado",    bg: "#DCFCE7", color: "#166534" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>{cfg.label}</span>
  );
}

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }).format(n ?? 0);
}

// ── New plan modal ─────────────────────────────────────────────────────────────
function NewPlanModal({ token, onClose, onCreate }) {
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!projectName.trim()) return setErr("El nombre del proyecto es obligatorio");
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API}/operations/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          custom_project_name: projectName.trim(),
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error al crear plan");
      onCreate(data.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, boxSizing: "border-box", marginBottom: 14 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 6px", color: "#0B2E33", fontSize: 17 }}>Nuevo plan de proyecto</h3>
        <p style={{ margin: "0 0 18px", color: "#64748B", fontSize: 13 }}>
          El código se genera automáticamente (ej: <strong>PRO-2026-0001</strong>).
        </p>

        <label style={{ fontSize: 13, color: "#4B5563", display: "block", marginBottom: 4 }}>Nombre del proyecto *</label>
        <input
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          placeholder="Ej: Proyecto Puente Intermodal Fase 1"
          style={inp}
          autoFocus
          onKeyDown={e => e.key === "Enter" && submit()}
        />

        <label style={{ fontSize: 13, color: "#4B5563", display: "block", marginBottom: 4 }}>Descripción / Alcance</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Describe brevemente el alcance del proyecto..."
          style={{ ...inp, resize: "vertical" }}
        />

        {err && <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#4F7C82", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {loading ? "Creando..." : "Crear plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit plan modal ────────────────────────────────────────────────────────────
function EditPlanModal({ token, plan, onClose, onSaved }) {
  const [title, setTitle] = useState(plan.title);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!title.trim()) return setErr("El nombre es obligatorio");
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API}/operations/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), custom_project_name: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error al guardar");
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 26, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 4px", color: "#0B2E33", fontSize: 16 }}>Editar nombre del plan</h3>
        <p style={{ margin: "0 0 16px", color: "#64748B", fontSize: 12 }}>
          Código: <strong style={{ fontFamily: "monospace", color: "#0F766E" }}>{plan.project_code}</strong>
        </p>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, boxSizing: "border-box", marginBottom: 14 }}
        />
        {err && <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#4F7C82", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ──────────────────────────────────────────────────────────────────
function PlanCard({ plan, onClick, onViewLogistics, onEdit, onDelete, onClone }) {
  const borderColor = { DRAFT: "#4F7C82", ACTIVE: "#3B82F6", SUBMITTED: "#22C55E" }[plan.status] ?? "#4F7C82";

  return (
    <div style={{
      background: "#fff", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      border: "1px solid #E5E7EB",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}>

      {/* Color bar */}
      <div style={{ height: 4, background: borderColor }} />

      <div style={{ padding: "18px 20px", cursor: "pointer" }} onClick={onClick}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0B2E33" }}>{plan.title}</div>
            <div style={{ color: "#64748B", fontSize: 12, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace", background: "#F0F9FA", color: "#0F766E", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{plan.project_code}</span>
              {plan.project_name}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <StatusBadge status={plan.status} />
            {/* Editar */}
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              title="Editar nombre"
              style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 7px", cursor: "pointer", color: "#64748B", fontSize: 13, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#4F7C82"; e.currentTarget.style.color = "#4F7C82"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#64748B"; }}
            >✏️</button>
            {/* Duplicar */}
            <button
              onClick={e => { e.stopPropagation(); onClone(); }}
              title="Duplicar proyecto"
              style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 7px", cursor: "pointer", color: "#64748B", fontSize: 13, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#0F766E"; e.currentTarget.style.color = "#0F766E"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#64748B"; }}
            >⧉</button>
            {/* Eliminar */}
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              title="Eliminar plan"
              style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 7px", cursor: "pointer", color: "#64748B", fontSize: 13, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#EF4444"; e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#64748B"; }}
            >🗑️</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Materiales</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#4F7C82" }}>{plan.item_count}</div>
          </div>
          <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Costo est.</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0B2E33" }}>{fmtMoney(plan.total_cost)}</div>
          </div>
          <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Actualizado</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{fmt(plan.updated_at)}</div>
          </div>
        </div>
      </div>

      {/* Footer con link a logística */}
      {plan.project_id && (
        <div style={{ padding: "10px 20px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={e => { e.stopPropagation(); onViewLogistics(plan.project_id); }}
            style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", background: "#0B2E33", color: "white", border: "none", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            📦 Ver en Logística →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MyProjects() {
  const token = localStorage.getItem("access_token");
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cloningPlan, setCloningPlan] = useState(null);
  const [cloneLoading, setCloneLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/operations/plans");
      setPlans(Array.isArray(data) ? data : []);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClone = async () => {
    if (!cloningPlan) return;
    setCloneLoading(true);
    try {
      const res = await fetch(`${API}/operations/plans/${cloningPlan.id}/clone`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Error al duplicar");
      setCloningPlan(null);
      navigate(`/operations/plans/${data.id}/presupuesto`);
    } catch (e) {
      alert(e.message);
    } finally {
      setCloneLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    setDeleteLoading(true);
    try {
      await fetch(`${API}/operations/plans/${deletingPlan.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeletingPlan(null);
      load();
    } catch { /* silent */ }
    finally { setDeleteLoading(false); }
  };

  const palette = { deep: "#0B2E33", dark: "#4F7C82" };
  const drafts = plans.filter(p => p.status === "DRAFT");
  const active  = plans.filter(p => ["ACTIVE", "SUBMITTED"].includes(p.status));

  const renderCard = (p) => (
    <PlanCard key={p.id} plan={p}
      onClick={() => navigate(`/operations/plans/${p.id}`)}
      onViewLogistics={(projId) => navigate(`/logistics/projects/${projId}`)}
      onEdit={() => setEditingPlan(p)}
      onDelete={() => setDeletingPlan(p)}
      onClone={() => setCloningPlan(p)}
    />
  );

  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F0F9FA" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: palette.deep }}>Mis proyectos</h1>
            <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>
              Planes de materiales, equipos y herramientas por proyecto
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{ background: palette.dark, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            + Nuevo plan
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total planes",          value: plans.length,   color: "#4F7C82" },
            { label: "En borrador",            value: drafts.length,  color: "#EAB308" },
            { label: "Con requerimientos",     value: active.length,  color: "#1D4ED8" },
          ].map(k => (
            <div key={k.label} style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Cargando...</div>
        ) : plans.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#374151", fontSize: 16, marginBottom: 6 }}>Sin planes todavía</div>
            <div style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 20 }}>Crea un plan para comenzar a planificar los materiales de tu proyecto</div>
            <button onClick={() => setShowNew(true)} style={{ background: palette.dark, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>
              Crear primer plan
            </button>
          </div>
        ) : (
          <>
            {drafts.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.8px", marginBottom: 12 }}>BORRADORES</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                  {drafts.map(renderCard)}
                </div>
              </section>
            )}
            {active.length > 0 && (
              <section>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.8px", marginBottom: 12 }}>CON REQUERIMIENTOS ENVIADOS A LOGÍSTICA</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                  {active.map(renderCard)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showNew && (
        <NewPlanModal
          token={token}
          onClose={() => setShowNew(false)}
          onCreate={(id) => { setShowNew(false); navigate(`/operations/plans/${id}`); }}
        />
      )}

      {editingPlan && (
        <EditPlanModal
          token={token}
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => { setEditingPlan(null); load(); }}
        />
      )}

      {/* Confirm clone */}
      {cloningPlan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 26, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 8px", color: "#0B2E33", fontSize: 16 }}>Duplicar proyecto</h3>
            <p style={{ margin: "0 0 6px", color: "#374151", fontSize: 14 }}>
              ¿Estás seguro de duplicar <strong>"{cloningPlan.title}"</strong>?
            </p>
            <p style={{ margin: "0 0 20px", color: "#9CA3AF", fontSize: 12 }}>
              Se creará un clon en estado Borrador con todas las partidas, APUs y configuración de cotización. Serás redirigido al presupuesto del nuevo proyecto.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setCloningPlan(null)} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleClone} disabled={cloneLoading}
                style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#0F766E", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                {cloneLoading ? "Duplicando..." : "Sí, duplicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deletingPlan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 26, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 8px", color: "#0B2E33", fontSize: 16 }}>Eliminar plan</h3>
            <p style={{ margin: "0 0 6px", color: "#374151", fontSize: 14 }}>
              ¿Estás seguro de eliminar <strong>"{deletingPlan.title}"</strong>?
            </p>
            <p style={{ margin: "0 0 20px", color: "#9CA3AF", fontSize: 12 }}>
              Se eliminará el plan y todos sus ítems. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeletingPlan(null)} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleteLoading} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#DC2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                {deleteLoading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
