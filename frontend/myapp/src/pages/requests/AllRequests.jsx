import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch, BASE_URL as API } from "../../services/api";

const STATUS = {
  PENDING:  { label: "Pendiente",  bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308" },
  APPROVED: { label: "Aprobado",   bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
  REJECTED: { label: "Rechazado",  bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  ORDERED:  { label: "Ordenado",   bg: "#CCFBF1", color: "#0F766E", dot: "#14B8A6" },
};

const PRIORITY = {
  LOW:    { label: "Baja",   color: "#9CA3AF" },
  MEDIUM: { label: "Media",  color: "#D97706" },
  HIGH:   { label: "Alta",   color: "#DC2626" },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function SlaCell({ sla_due_at }) {
  if (!sla_due_at) return <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>;
  const due = new Date(sla_due_at);
  const now = new Date();
  const hoursLeft = (due - now) / 36e5;
  const label = due.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  if (hoursLeft < 0) return <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 11 }}>Vencido</span>;
  if (hoursLeft < 6) return <span style={{ color: "#D97706", fontWeight: 600, fontSize: 11 }}>{Math.floor(hoursLeft)}h</span>;
  return <span style={{ color: "#6B7280", fontSize: 11 }}>{label}</span>;
}

function ReserveModal({ request, onClose, onSuccess }) {
  const [warehouses, setWarehouses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ warehouse_id: "", project_id: "" });
  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [wRes, pRes] = await Promise.allSettled([
        apiFetch("/logistics/warehouses"),
        apiFetch("/logistics/projects"),
      ]);
      if (wRes.status === "fulfilled") setWarehouses(wRes.value);
      if (pRes.status === "fulfilled") setProjects(pRes.value);
      setLoadingMeta(false);
    }
    load();
  }, []);

  const selectStyle = {
    width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box",
  };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/requests/reservations", {
        method: "POST",
        body: JSON.stringify({
          material_request_id: request.id,
          material_id: request.material_id,
          warehouse_id: form.warehouse_id,
          quantity: request.quantity,
          project_id: form.project_id || null,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Error al crear la reserva");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Reservar stock" subtitle={`${request.material_name} · ${request.quantity} unidades`} onClose={onClose} maxWidth={480}>
      {loadingMeta ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando datos...</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Almacén de origen *</label>
            <select style={selectStyle} value={form.warehouse_id}
              onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              required>
              <option value="">Seleccionar almacén...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} {w.code ? `(${w.code})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Proyecto (opcional)</label>
            <select style={selectStyle} value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
              <option value="">Sin proyecto</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} {p.code ? `· ${p.code}` : ""}</option>)}
            </select>
          </div>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Reservando..." : "Confirmar reserva"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ConfirmModal({ action, materialName, onClose, onConfirm, loading }) {
  const isApprove = action === "approve";
  return (
    <Modal
      title={isApprove ? "Aprobar solicitud" : "Rechazar solicitud"}
      subtitle={isApprove ? "Se aprobará y permitirá reservar stock." : "Esta acción rechazará la solicitud permanentemente."}
      onClose={onClose} maxWidth={400}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 14, color: "#374151" }}>
          Material: <strong>{materialName}</strong>
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ flex: 1, padding: "10px 0", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, background: isApprove ? "#16A34A" : "#DC2626", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading ? "Procesando..." : isApprove ? "Confirmar aprobación" : "Confirmar rechazo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Submission item review row ────────────────────────────────────────────────
const ITEM_STATUS = {
  PENDING:  { label: "Pendiente", bg: "#F3F4F6", color: "#6B7280" },
  APPROVED: { label: "Aprobado",  bg: "#DCFCE7", color: "#166534" },
  PARTIAL:  { label: "Parcial",   bg: "#FEF9C3", color: "#854D0E" },
  REJECTED: { label: "Rechazado", bg: "#FEE2E2", color: "#991B1B" },
};

function ItemReviewRow({ item, onReview }) {
  const [action, setAction] = useState(null); // "APPROVED"|"PARTIAL"|"REJECTED"
  const [approvedQty, setApprovedQty] = useState(String(item.quantity));
  const [notes, setNotes] = useState(item.logistics_notes || "");
  const [saving, setSaving] = useState(false);

  const isPending = item.logistics_status === "PENDING";
  const cfg = ITEM_STATUS[item.logistics_status] ?? ITEM_STATUS.PENDING;
  const effCost = item.quantity * (item.unit_cost ?? 0) * (item.wear_percentage / 100);

  const save = async () => {
    if (!action) return;
    setSaving(true);
    await onReview(item.id, action, action === "PARTIAL" ? parseFloat(approvedQty) : null, notes);
    setSaving(false);
    setAction(null);
  };

  return (
    <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9", background: isPending ? "#fff" : cfg.bg + "22" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.8fr 0.8fr 1fr 1.4fr", gap: 8, alignItems: "center", fontSize: 13 }}>
        <div>
          <span style={{ fontWeight: 600, color: "#1E293B" }}>{item.material_name}</span>
          <span style={{ marginLeft: 8, fontSize: 11, color: "#94A3B8" }}>{item.material_code}</span>
          {item.category && <span style={{ marginLeft: 6, background: "var(--primary-soft)", color: "var(--primary)", padding: "1px 7px", borderRadius: 8, fontSize: 10, fontWeight: 600 }}>{item.category}</span>}
        </div>
        <div style={{ textAlign: "right", fontFamily: "monospace" }}>{item.quantity}</div>
        <div style={{ textAlign: "right", color: "#64748B", fontSize: 12 }}>
          {item.unit_cost != null ? `S/${item.unit_cost.toFixed(2)}` : "—"}
        </div>
        <div style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)", fontSize: 12 }}>
          S/{effCost.toFixed(2)}
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
          {item.approved_quantity != null && item.logistics_status === "PARTIAL" && (
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>aprobado: {item.approved_quantity}</div>
          )}
        </div>
        <div>
          {isPending && !action && (
            <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
              <button onClick={() => setAction("APPROVED")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#DCFCE7", color: "#166534", border: "1px solid #BBF7D0", fontWeight: 600, cursor: "pointer" }}>Aprobar</button>
              <button onClick={() => setAction("PARTIAL")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#FEF9C3", color: "#854D0E", border: "1px solid #FDE68A", fontWeight: 600, cursor: "pointer" }}>Parcial</button>
              <button onClick={() => setAction("REJECTED")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", fontWeight: 600, cursor: "pointer" }}>Rechazar</button>
            </div>
          )}
          {action && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {action === "PARTIAL" && (
                <input type="number" value={approvedQty} onChange={e => setApprovedQty(e.target.value)} placeholder="Cant. aprobada" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
              )}
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nota (opcional)" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setAction(null)} style={{ flex: 1, fontSize: 11, padding: "4px 0", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer" }}>×</button>
                <button onClick={save} disabled={saving} style={{ flex: 2, fontSize: 11, padding: "4px 0", borderRadius: 6, border: "none", background: action === "APPROVED" ? "#16A34A" : action === "REJECTED" ? "#DC2626" : "#D97706", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  {saving ? "..." : "Confirmar"}
                </button>
              </div>
            </div>
          )}
          {!isPending && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{item.logistics_notes || "—"}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Submission card (expandable) ──────────────────────────────────────────────
function SubmissionCard({ sub, onReviewItem, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const token = localStorage.getItem("access_token");
  const STATUS_CFG = {
    PENDING:  { label: "Pendiente de revisión", bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" },
    PARTIAL:  { label: "Revisado parcialmente", bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
    APPROVED: { label: "Aprobado",              bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
    REJECTED: { label: "Rechazado",             bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  };
  const cfg = STATUS_CFG[sub.status] ?? STATUS_CFG.PENDING;
  const reviewed = sub.approved + sub.rejected + sub.partial;

  const toggle = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`${API}/logistics/project-submissions/${sub.id}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setDetail(data);
      } catch { /* ignore */ }
      setLoadingDetail(false);
    }
    setExpanded(v => !v);
  };

  const handleReviewItem = async (itemId, status, approvedQty, notes) => {
    await fetch(`${API}/logistics/project-submissions/${sub.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ logistics_status: status, approved_quantity: approvedQty, logistics_notes: notes }),
    });
    // Refresh detail
    const res = await fetch(`${API}/logistics/project-submissions/${sub.id}`, { headers: { Authorization: `Bearer ${token}` } });
    setDetail(await res.json());
    onRefresh();
  };

  return (
    <div style={{ background: "white", border: `1px solid ${cfg.border}`, borderLeft: `4px solid ${cfg.border}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Header row */}
      <div onClick={toggle} style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
        onMouseLeave={e => e.currentTarget.style.background = "white"}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }}>Req. #{sub.submission_number}</span>
            <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
            <span style={{ fontSize: 12, color: "#64748B" }}>·  {sub.item_count} ítems · {reviewed}/{sub.item_count} revisados</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Proyecto: <strong style={{ color: "var(--primary)" }}>{sub.project_name}</strong> [{sub.project_code}]</span>
            <span>Ingeniero: <strong>{sub.engineer_name}</strong></span>
            <span>{new Date(sub.submitted_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</span>
            {sub.reason && <span>"{sub.reason}"</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {sub.approved  > 0 && <span style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>✓ {sub.approved}</span>}
          {sub.partial   > 0 && <span style={{ fontSize: 12, color: "#854D0E", fontWeight: 700 }}>~ {sub.partial}</span>}
          {sub.rejected  > 0 && <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 700 }}>✗ {sub.rejected}</span>}
          <span style={{ color: "#9CA3AF", fontSize: 16, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div style={{ borderTop: "1px solid #F1F5F9" }}>
          {/* Item table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.8fr 0.8fr 1fr 1.4fr", gap: 8, padding: "8px 20px", background: "#F8FAFC", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.6px" }}>
            <span>MATERIAL</span>
            <span style={{ textAlign: "right" }}>CANTIDAD</span>
            <span style={{ textAlign: "right" }}>COSTO UNIT.</span>
            <span style={{ textAlign: "right" }}>COSTO EFEC.</span>
            <span style={{ textAlign: "center" }}>ESTADO</span>
            <span style={{ textAlign: "right" }}>ACCIÓN</span>
          </div>
          {loadingDetail && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando ítems...</div>}
          {detail?.items?.map(item => (
            <ItemReviewRow key={item.id} item={item} onReview={handleReviewItem} />
          ))}
          {detail && (
            <div style={{ padding: "10px 20px", background: "var(--primary-soft)", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B" }}>
              <span>Total estimado: <strong style={{ color: "var(--primary)" }}>S/{detail.total_cost?.toFixed(2)}</strong></span>
              {detail.logistics_notes && <span>Nota: {detail.logistics_notes}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Por Proyecto view ─────────────────────────────────────────────────────────
function ByProjectView() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try { setSubmissions(await apiFetch("/logistics/project-submissions")); }
    catch { setSubmissions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS_FILTERS = [
    { key: "ALL",     label: "Todos" },
    { key: "PENDING", label: "Pendientes" },
    { key: "PARTIAL", label: "Parciales" },
    { key: "APPROVED",label: "Aprobados" },
    { key: "REJECTED",label: "Rechazados" },
  ];

  const filtered = statusFilter === "ALL" ? submissions : submissions.filter(s => s.status === statusFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.key;
          const count = f.key === "ALL" ? submissions.length : submissions.filter(s => s.status === f.key).length;
          return (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, border: "none", cursor: "pointer", fontWeight: active ? 600 : 500, background: active ? "white" : "transparent", color: active ? "#111827" : "#6B7280", boxShadow: active ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
              {f.label}
              <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 6px", borderRadius: 99, background: active ? "rgba(199,210,229,0.4)" : "#E5E7EB", color: active ? "var(--primary)" : "#6B7280" }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando requerimientos...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>No hay requerimientos de proyecto</p>
          <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 6 }}>Aparecerán aquí cuando los ingenieros envíen su lista de materiales</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(sub => <SubmissionCard key={sub.id} sub={sub} onRefresh={load} />)}
        </div>
      )}
    </div>
  );
}

export default function AllRequests() {
  const [view, setView] = useState("individual"); // "individual" | "project"
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reserving, setReserving] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/requests/material-requests");
      setRequests(data);
    } catch {
      showToast("Error al cargar las solicitudes", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await apiFetch(`/requests/material-requests/${confirm.id}/${confirm.action}`, { method: "POST" });
      showToast(confirm.action === "approve" ? "Solicitud aprobada correctamente." : "Solicitud rechazada.");
      setConfirm(null);
      load();
    } catch (err) {
      showToast(err.message || "Error al procesar la acción", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const counts = {
    ALL:      requests.length,
    PENDING:  requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  const tabs = [
    { key: "ALL",      label: "Todas" },
    { key: "PENDING",  label: "Pendientes" },
    { key: "APPROVED", label: "Aprobadas" },
    { key: "REJECTED", label: "Rechazadas" },
  ];

  const filtered = requests
    .filter((r) => filter === "ALL" || r.status === filter)
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.material_name?.toLowerCase().includes(q) || r.requested_by?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q);
    });

  return (
    <Layout>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "white",
          background: toast.type === "error" ? "#DC2626" : "#16A34A",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          {toast.type === "error" ? "✗ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Panel de Solicitudes
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Revisa y aprueba las solicitudes de material del equipo operativo
            </p>
          </div>
          <button
            onClick={load}
            style={{ flexShrink: 0, padding: "7px 16px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"}
            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
          >
            ↻ Actualizar
          </button>
        </div>

        {/* View selector — Individual vs Por Proyecto */}
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #E5E7EB", marginBottom: 4 }}>
          {[
            { key: "individual", label: "Solicitudes individuales" },
            { key: "project",    label: "Por proyecto" },
          ].map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              style={{ padding: "8px 22px", fontSize: 13, fontWeight: view === v.key ? 700 : 500, border: "none", background: "none", cursor: "pointer", color: view === v.key ? "var(--primary)" : "#6B7280", borderBottom: view === v.key ? "2px solid var(--primary)" : "2px solid transparent", marginBottom: -2, transition: "color 0.15s" }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Por Proyecto view */}
        {view === "project" && <ByProjectView />}

        {/* Individual view */}
        {view === "individual" && <>

        {/* Search + Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Buscador */}
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9CA3AF", pointerEvents: "none" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por material, usuario o motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%", border: `1.5px solid ${searchFocused ? "var(--primary)" : "#E5E7EB"}`,
                borderRadius: 10, paddingLeft: 38, paddingRight: search ? 36 : 12,
                paddingTop: 9, paddingBottom: 9, fontSize: 13, outline: "none",
                boxSizing: "border-box", background: "white",
                boxShadow: searchFocused ? "0 0 0 3px rgba(0,58,140,0.1)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 16, lineHeight: 1, padding: 2 }}
              >
                ×
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4, width: "fit-content" }}>
            {tabs.map((t) => {
              const active = filter === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 12, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                    fontWeight: active ? 600 : 500,
                    background: active ? "white" : "transparent",
                    color: active ? "#111827" : "#6B7280",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {t.label}
                  <span style={{
                    marginLeft: 6, fontSize: 11, padding: "2px 6px", borderRadius: 99,
                    ...(active ? { background: "rgba(199,210,229,0.4)", color: "var(--primary)" } : { background: "#E5E7EB", color: "#6B7280" })
                  }}>
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Cargando solicitudes...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 48, textAlign: "center" }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>📋</span>
            <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>
              {search ? "Sin resultados para esa búsqueda" : "No hay solicitudes con ese estado"}
            </p>
          </div>
        ) : (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px 1fr 80px 100px 160px", gap: 8, padding: "12px 20px", background: "var(--primary)" }}>
              {["Usuario", "Material", "Cant.", "Motivo", "SLA", "Estado", "Acciones"].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</div>
              ))}
            </div>

            <div>
              {filtered.map((r, idx) => {
                const pri = PRIORITY[r.priority] || PRIORITY.MEDIUM;
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid", gridTemplateColumns: "120px 1fr 70px 1fr 80px 100px 160px",
                      gap: 8, padding: "13px 20px", alignItems: "center",
                      borderBottom: idx < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                      background: idx % 2 === 0 ? "white" : "#FAFAFA",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-soft)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#FAFAFA"}
                  >
                    <div style={{ fontWeight: 500, color: "#374151", fontSize: 13 }}>{r.requested_by || "—"}</div>
                    <div>
                      <p style={{ fontWeight: 700, color: "#111827", fontSize: 13, margin: 0 }}>{r.material_name || "—"}</p>
                      <p style={{ fontSize: 11, marginTop: 2, color: pri.color, fontWeight: 600 }}>{pri.label}</p>
                    </div>
                    <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151" }}>{r.quantity}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.reason}>
                      {r.reason || "—"}
                    </div>
                    <div><SlaCell sla_due_at={r.sla_due_at} /></div>
                    <div><StatusBadge status={r.status} /></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      {r.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => setConfirm({ action: "approve", id: r.id, materialName: r.material_name })}
                            style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "#DCFCE7", color: "#166534", border: "1px solid #BBF7D0", fontWeight: 600, cursor: "pointer" }}
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => setConfirm({ action: "reject", id: r.id, materialName: r.material_name })}
                            style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA", fontWeight: 600, cursor: "pointer" }}
                          >
                            Rechazar
                          </button>
                        </>
                      ) : r.status === "APPROVED" ? (
                        <button
                          onClick={() => setReserving(r)}
                          style={{ fontSize: 11, padding: "5px 14px", borderRadius: 7, background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid #D1D5DB", fontWeight: 600, cursor: "pointer" }}
                        >
                          Reservar stock
                        </button>
                      ) : (
                        <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>
            {filtered.length} de {requests.length} solicitudes
          </p>
        )}
        </>}
      </div>

      {confirm && (
        <ConfirmModal
          action={confirm.action}
          materialName={confirm.materialName}
          loading={actionLoading}
          onClose={() => setConfirm(null)}
          onConfirm={handleAction}
        />
      )}
      {reserving && (
        <ReserveModal
          request={reserving}
          onClose={() => setReserving(null)}
          onSuccess={() => {
            setReserving(null);
            showToast("Reserva creada. El stock ha sido bloqueado.");
            load();
          }}
        />
      )}
    </Layout>
  );
}
