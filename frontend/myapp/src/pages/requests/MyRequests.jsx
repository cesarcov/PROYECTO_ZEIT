import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch } from "../../services/api";

const STATUS_STYLES = {
  PENDING:  { label: "Pendiente",  bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308" },
  APPROVED: { label: "Aprobado",   bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
  REJECTED: { label: "Rechazado",  bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  ORDERED:  { label: "Ordenado",   bg: "#CCFBF1", color: "#0F766E", dot: "#14B8A6" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status, bg: "#F3F4F6", color: "#4B5563", dot: "#9CA3AF" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 99 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function NewRequestModal({ materials, onClose, onSuccess }) {
  const [form, setForm] = useState({ related_material_id: "", quantity: "", reason: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/requests/material-requests", {
        method: "POST",
        body: JSON.stringify({
          related_material_id: form.related_material_id,
          quantity: parseFloat(form.quantity),
          reason: form.reason,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, color: "#111827",
    background: "#FAFAFA", outline: "none", boxSizing: "border-box",
  };

  return (
    <Modal title="Nueva solicitud de material" subtitle="La solicitud quedará en estado Pendiente" onClose={onClose} maxWidth={480}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Material *
          </label>
          <select
            style={inputStyle}
            value={form.related_material_id}
            onChange={(e) => setForm({ ...form, related_material_id: e.target.value })}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
            required
          >
            <option value="">Seleccionar material...</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>{m.name} {m.code ? `(${m.code})` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Cantidad requerida *
          </label>
          <input
            type="number" min="0.01" step="0.01"
            style={inputStyle}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
            placeholder="ej: 10"
            required
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Motivo / Justificación *
          </label>
          <textarea
            style={{ ...inputStyle, resize: "none" }}
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
            placeholder="Describe por qué necesitas este material..."
            required
          />
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ flex: 1, padding: "10px 0", background: "#4F7C82", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Requerimientos de Proyecto (submissions del ingeniero) ────────────────────
const SUB_CFG = {
  PENDING:  { label: "Pendiente de revisión", bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" },
  PARTIAL:  { label: "Revisado parcialmente", bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  APPROVED: { label: "Aprobado",              bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
  REJECTED: { label: "Rechazado",             bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
};

function MyProjectSubmissions() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try { setSubmissions(await apiFetch("/operations/submissions")); }
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

  const filtered = filterStatus === "ALL" ? submissions : submissions.filter(s => s.status === filterStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {STATUS_FILTERS.map(f => {
          const active = filterStatus === f.key;
          const count  = f.key === "ALL" ? submissions.length : submissions.filter(s => s.status === f.key).length;
          return (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, border: "none", cursor: "pointer",
                fontWeight: active ? 600 : 500, background: active ? "white" : "transparent",
                color: active ? "#111827" : "#6B7280", boxShadow: active ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
              {f.label}
              <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 6px", borderRadius: 99,
                background: active ? "rgba(184,227,233,0.4)" : "#E5E7EB", color: active ? "#4F7C82" : "#6B7280" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          Cargando requerimientos...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <span style={{ fontSize: 36, display: "block", marginBottom: 12 }}>📋</span>
          <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>
            No hay requerimientos {filterStatus !== "ALL" ? "con ese estado" : "enviados"}
          </p>
          <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>
            Entra a un proyecto desde "Mis proyectos" y usa "Enviar Req." para mandar la lista a logística.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(s => {
            const cfg = SUB_CFG[s.status] ?? SUB_CFG.PENDING;
            const reviewed = s.approved + s.rejected + s.partial;
            return (
              <div key={s.id} style={{ background: "white", border: `1px solid ${cfg.border}`, borderLeft: `4px solid ${cfg.border}`, borderRadius: 10, padding: "14px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#0B2E33" }}>Req. #{s.submission_number}</span>
                      <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                      <strong style={{ color: "#0B2E33" }}>{s.project_name}</strong>
                      {s.project_code && <span style={{ marginLeft: 6, color: "#94A3B8" }}>[{s.project_code}]</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <span>{new Date(s.submitted_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      <span>{s.item_count} ítem(s) · {reviewed}/{s.item_count} revisados</span>
                      {s.reason && <span>"{s.reason}"</span>}
                    </div>
                    {s.logistics_notes && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#64748B", fontStyle: "italic", background: "#F8FAFC", borderRadius: 6, padding: "5px 10px" }}>
                        Nota de logística: {s.logistics_notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                      {s.approved > 0 && <span style={{ color: "#166534", fontWeight: 700 }}>✓ {s.approved}</span>}
                      {s.partial  > 0 && <span style={{ color: "#854D0E", fontWeight: 700 }}>~ {s.partial}</span>}
                      {s.rejected > 0 && <span style={{ color: "#991B1B", fontWeight: 700 }}>✗ {s.rejected}</span>}
                    </div>
                    <button
                      onClick={() => navigate(`/operations/plans/${s.plan_id}`)}
                      style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid #CBD5E1", background: "white", color: "#4F7C82", cursor: "pointer", fontWeight: 600 }}>
                      Ver plan →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyRequests() {
  const [view, setView] = useState("individual"); // "individual" | "project"
  const [requests, setRequests] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [reqRes, matRes] = await Promise.allSettled([
      apiFetch("/requests/material-requests/my"),
      apiFetch("/logistics/materials"),
    ]);
    if (reqRes.status === "fulfilled") setRequests(reqRes.value);
    if (matRes.status === "fulfilled") setMaterials(matRes.value);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);

  const counts = {
    ALL:      requests.length,
    PENDING:  requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  const tabs = [
    { key: "ALL",      label: "Todas"     },
    { key: "PENDING",  label: "Pendientes" },
    { key: "APPROVED", label: "Aprobadas"  },
    { key: "REJECTED", label: "Rechazadas" },
  ];

  return (
    <Layout>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 50,
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "white",
          background: toast.type === "error" ? "#DC2626" : "#16A34A",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          {toast.type === "error" ? "✗ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Mis Solicitudes
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Solicitudes puntuales y requerimientos de materiales por proyecto
            </p>
          </div>
          {view === "individual" && (
            <button
              onClick={() => setShowNew(true)}
              style={{ flexShrink: 0, padding: "8px 18px", background: "#4F7C82", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Nueva solicitud
            </button>
          )}
        </div>

        {/* View selector */}
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #E5E7EB" }}>
          {[
            { key: "individual", label: "Solicitudes individuales" },
            { key: "project",    label: "Requerimientos de proyecto" },
          ].map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              padding: "9px 18px", fontSize: 13, border: "none", cursor: "pointer", background: "transparent",
              fontWeight: view === v.key ? 700 : 500,
              color: view === v.key ? "#0B2E33" : "#6B7280",
              borderBottom: view === v.key ? "2px solid #4F7C82" : "2px solid transparent",
              marginBottom: -2,
            }}>{v.label}</button>
          ))}
        </div>

        {/* Requerimientos de Proyecto */}
        {view === "project" && <MyProjectSubmissions />}

        {/* Solicitudes individuales */}
        {view === "individual" && <>
          {/* Tabs de filtro */}
          <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 4, width: "fit-content" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  padding: "6px 14px", borderRadius: 7, fontSize: 12, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  fontWeight: filter === t.key ? 600 : 500,
                  background: filter === t.key ? "white" : "transparent",
                  color: filter === t.key ? "#111827" : "#6B7280",
                  boxShadow: filter === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {t.label}
                <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 6px", borderRadius: 99, ...(filter === t.key ? { background: "rgba(184,227,233,0.4)", color: "#4F7C82" } : { background: "#E5E7EB", color: "#6B7280" }) }}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Lista */}
          {loading ? (
            <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Cargando solicitudes...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 48, textAlign: "center" }}>
              <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>📋</span>
              <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>
                No hay solicitudes {filter !== "ALL" ? "con ese estado" : "registradas"}
              </p>
              {filter === "ALL" && (
                <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>Usa el botón "Nueva solicitud" para comenzar.</p>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((r) => (
                <div
                  key={r.id}
                  style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 20 }}>📦</span>
                        <div>
                          <p style={{ fontWeight: 700, color: "#111827", fontSize: 14, margin: 0 }}>
                            {r.material_name || "—"}
                          </p>
                          <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>
                            Cantidad: <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#374151" }}>{r.quantity}</span>
                          </p>
                        </div>
                      </div>
                      {r.reason && (
                        <p style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic", marginLeft: 30, marginBottom: 6 }}>
                          "{r.reason}"
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 30 }}>
                        Creada: {formatDate(r.created_at)}
                        {r.approved_at && <span style={{ marginLeft: 12, color: "#16A34A" }}>· Aprobada: {formatDate(r.approved_at)}</span>}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}
      </div>

      {showNew && (
        <NewRequestModal
          materials={materials}
          onClose={() => setShowNew(false)}
          onSuccess={() => {
            setShowNew(false);
            showToast("Solicitud enviada. El equipo de logística la revisará pronto.");
            loadData();
          }}
        />
      )}
    </Layout>
  );
}
