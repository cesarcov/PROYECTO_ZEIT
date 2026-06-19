import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import * as XLSX from "xlsx";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "#4F7C82", icon }) {
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 140 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "4px 0 0" }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: color, fontWeight: 700, margin: "2px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Status badges ─────────────────────────────────────────────────────────────
const TOOL_STATUS = {
  ASSIGNED: { label: "En campo", bg: "#DBEAFE", color: "#1E40AF" },
  RETURNED: { label: "Devuelto",  bg: "#DCFCE7", color: "#166534" },
};
const REQ_STATUS = {
  PENDING:  { label: "Pendiente",  bg: "#FEF9C3", color: "#854D0E" },
  APPROVED: { label: "Aprobado",   bg: "#DCFCE7", color: "#166534" },
  REJECTED: { label: "Rechazado",  bg: "#FEE2E2", color: "#991B1B" },
  ORDERED:  { label: "Ordenado",   bg: "#CCFBF1", color: "#0F766E" },
};
const DISP_STATUS = {
  PENDING:    { label: "Pendiente",    bg: "#FEF9C3", color: "#854D0E" },
  READY:      { label: "Preparado",    bg: "#DBEAFE", color: "#1E40AF" },
  IN_TRANSIT: { label: "En tránsito",  bg: "#FEE2E2", color: "#991B1B" },
  DELIVERED:  { label: "Entregado",    bg: "#DCFCE7", color: "#166534" },
};
const PLAN_STATUS = {
  DRAFT:     { label: "Borrador",  bg: "#F3F4F6", color: "#4B5563" },
  ACTIVE:    { label: "Activo",    bg: "#DBEAFE", color: "#1D4ED8" },
  SUBMITTED: { label: "Enviado",   bg: "#DCFCE7", color: "#166534" },
};
const PRIORITY = {
  LOW:    { label: "Baja",  bg: "#F3F4F6", color: "#6B7280" },
  MEDIUM: { label: "Media", bg: "#FEF9C3", color: "#854D0E" },
  HIGH:   { label: "Alta",  bg: "#FEE2E2", color: "#991B1B" },
};

function Badge({ map, value, fallback }) {
  const cfg = map[value] || { label: fallback || value || "—", bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <p style={{ color: "#9CA3AF", fontSize: 13 }}>{text}</p>
    </div>
  );
}

// ── Tab: Herramientas ─────────────────────────────────────────────────────────
function ToolsTab({ tools }) {
  const inField  = tools.filter(t => t.status === "ASSIGNED");
  const returned = tools.filter(t => t.status !== "ASSIGNED");

  if (tools.length === 0) return <Empty icon="🔧" text="Sin herramientas asignadas a este proyecto" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {inField.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
            En campo ({inField.length})
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Herramienta", "Código", "Asignado a", "Desde", "Devolución esperada", "Estado salida"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", textAlign: "left", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inField.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{t.tool_name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", color: "#4F7C82" }}>{t.tool_code || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151" }}>{t.assigned_to || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{fmt(t.assigned_at)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: t.expected_return && new Date(t.expected_return) < new Date() ? "#DC2626" : "#6B7280", fontWeight: t.expected_return && new Date(t.expected_return) < new Date() ? 700 : 400 }}>
                    {fmtDate(t.expected_return)}
                    {t.expected_return && new Date(t.expected_return) < new Date() && <span style={{ marginLeft: 6, fontSize: 10, color: "#DC2626" }}>VENCIDA</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge map={{}} value={t.condition_out} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {returned.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
            Devueltas ({returned.length})
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Herramienta", "Asignado a", "Devuelto", "Estado entrada"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", textAlign: "left", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {returned.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#374151" }}>{t.tool_name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151" }}>{t.assigned_to || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{fmt(t.returned_at)}</td>
                  <td style={{ padding: "12px 14px" }}><Badge map={{}} value={t.condition_in} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Solicitudes ──────────────────────────────────────────────────────────
function RequestsTab({ requests }) {
  if (requests.length === 0) return <Empty icon="📋" text="Sin solicitudes de materiales para este proyecto" />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#F9FAFB" }}>
          {["Material", "Cantidad", "Solicitado por", "Prioridad", "Se necesita", "Estado"].map(h => (
            <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", textAlign: "left", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {requests.map((r, i) => (
          <tr key={r.id} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
            <td style={{ padding: "12px 14px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{r.material_name || "—"}</p>
              {r.material_code && <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4F7C82", margin: "2px 0 0" }}>{r.material_code}</p>}
            </td>
            <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#374151" }}>{r.quantity ?? "—"}</td>
            <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151" }}>{r.requested_by}</td>
            <td style={{ padding: "12px 14px" }}><Badge map={PRIORITY} value={r.priority} /></td>
            <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{fmtDate(r.needed_by)}</td>
            <td style={{ padding: "12px 14px" }}><Badge map={REQ_STATUS} value={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Tab: Despachos ────────────────────────────────────────────────────────────
function DispatchesTab({ dispatches }) {
  if (dispatches.length === 0) return <Empty icon="🚚" text="Sin despachos registrados para este proyecto" />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#F9FAFB" }}>
          {["Destinatario", "Despachado por", "Ítems", "Fecha creación", "Fecha despacho", "Estado"].map(h => (
            <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", textAlign: "left", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dispatches.map((d, i) => (
          <tr key={d.id} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
            <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{d.recipient_name || "—"}</td>
            <td style={{ padding: "12px 14px", fontSize: 13, color: "#374151" }}>{d.dispatched_by || "—"}</td>
            <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#4F7C82", textAlign: "center" }}>{d.items_count}</td>
            <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{fmt(d.created_at)}</td>
            <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{d.dispatched_at ? fmt(d.dispatched_at) : <span style={{ color: "#D1D5DB" }}>—</span>}</td>
            <td style={{ padding: "12px 14px" }}><Badge map={DISP_STATUS} value={d.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Tab: Planes de Operaciones ────────────────────────────────────────────────
function PlansTab({ plans }) {
  if (plans.length === 0) return <Empty icon="📐" text="Sin planes de operaciones vinculados a este proyecto" />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#F9FAFB" }}>
          {["Plan / Título", "Ingeniero responsable", "Ítems", "Creado", "Estado"].map(h => (
            <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", textAlign: "left", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {plans.map((p, i) => (
          <tr key={p.id} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
            <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.title || "Sin título"}</td>
            <td style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#4F7C82", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>{p.engineer_name?.charAt(0).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 13, color: "#374151" }}>{p.engineer_name}</span>
              </div>
            </td>
            <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#4F7C82", textAlign: "center" }}>{p.items_count}</td>
            <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{fmt(p.created_at)}</td>
            <td style={{ padding: "12px 14px" }}><Badge map={PLAN_STATUS} value={p.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Excel export ──────────────────────────────────────────────────────────────
function exportToExcel(project) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumen = [
    ["REPORTE DE PROYECTO", "", "", ""],
    ["", "", "", ""],
    ["Código:", project.code, "Nombre:", project.name],
    ["Fecha creación:", fmtDate(project.created_at), "Exportado:", new Date().toLocaleString("es-PE")],
    ["", "", "", ""],
    ["RESUMEN DE INDICADORES", "", "", ""],
    ["Herramientas en campo:", project.kpis.tools_in_field, "Total herramientas:", project.kpis.tools_total],
    ["Solicitudes pendientes:", project.kpis.requests_pending, "Total solicitudes:", project.kpis.requests_total],
    ["Despachos entregados:", project.kpis.dispatches_delivered, "Total despachos:", project.kpis.dispatches_total],
    ["Planes de operación:", project.kpis.plans_total, "", ""],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumen);
  ws1["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Sheet 2: Herramientas
  const toolHeaders = ["Herramienta", "Código", "Estado", "Asignado a", "Fecha asignación", "Devolución esperada", "Estado al salir", "Devuelto", "Estado al entrar"];
  const toolRows = project.tools.map(t => [
    t.tool_name, t.tool_code || "",
    t.status === "ASSIGNED" ? "En campo" : "Devuelto",
    t.assigned_to || "",
    t.assigned_at ? new Date(t.assigned_at).toLocaleString("es-PE") : "",
    t.expected_return ? new Date(t.expected_return).toLocaleDateString("es-PE") : "",
    t.condition_out || "",
    t.returned_at ? new Date(t.returned_at).toLocaleString("es-PE") : "",
    t.condition_in || "",
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([toolHeaders, ...toolRows]);
  ws2["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Herramientas");

  // Sheet 3: Solicitudes
  const reqHeaders = ["Material", "Código", "Cantidad", "Solicitado por", "Prioridad", "Se necesita", "Estado", "Notas"];
  const reqRows = project.requests.map(r => [
    r.material_name || "", r.material_code || "",
    r.quantity ?? "",
    r.requested_by || "",
    r.priority || "",
    r.needed_by ? new Date(r.needed_by).toLocaleDateString("es-PE") : "",
    r.status || "",
    r.notes || "",
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([reqHeaders, ...reqRows]);
  ws3["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Solicitudes");

  // Sheet 4: Despachos
  const dispHeaders = ["Destinatario", "Despachado por", "Ítems", "Fecha creación", "Fecha despacho", "Estado"];
  const dispRows = project.dispatches.map(d => [
    d.recipient_name || "",
    d.dispatched_by || "",
    d.items_count,
    d.created_at ? new Date(d.created_at).toLocaleString("es-PE") : "",
    d.dispatched_at ? new Date(d.dispatched_at).toLocaleString("es-PE") : "",
    d.status || "",
  ]);
  const ws4 = XLSX.utils.aoa_to_sheet([dispHeaders, ...dispRows]);
  ws4["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Despachos");

  // Sheet 5: Planes
  const planHeaders = ["Título del plan", "Ingeniero responsable", "Ítems", "Creado", "Estado"];
  const planRows = project.plans.map(p => [
    p.title || "",
    p.engineer_name || "",
    p.items_count,
    p.created_at ? new Date(p.created_at).toLocaleString("es-PE") : "",
    p.status || "",
  ]);
  const ws5 = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  ws5["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 8 }, { wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws5, "Planes");

  XLSX.writeFile(wb, `Proyecto_${project.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Tab: Requerimientos Gap ───────────────────────────────────────────────────
function RequirementsGapTab({ projectId }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult]   = useState(null);

  useEffect(() => {
    setLoading(true); setError("");
    apiFetch(`/logistics/projects/${projectId}/requirements-gap`)
      .then(res => { setData(res); setLoading(false); })
      .catch(e => { setError(e.message || "Error al cargar el análisis"); setLoading(false); });
  }, [projectId]);

  const addShortageToList = async () => {
    const shortItems = data.items.filter(i => i.shortage > 0 && !i.in_purchase_list);
    if (shortItems.length === 0) return;
    setBulkLoading(true); setBulkResult(null);
    try {
      const items = shortItems.map(i => ({
        material_id: i.material_id,
        material_name_free: i.material_name,
        qty_needed: i.shortage,
        unit: i.unit,
        project_id: projectId,
        reason: `Faltante en proyecto ${data.project.code}`,
        priority: i.priority === "HIGH" ? "URGENT" : "NORMAL",
      }));
      const res = await apiFetch("/logistics/purchases/bulk", {
        method: "POST", body: JSON.stringify({ items }),
      });
      setBulkResult(res);
      const fresh = await apiFetch(`/logistics/projects/${projectId}/requirements-gap`);
      setData(fresh);
    } catch (e) { setError(e.message || "Error al agregar a lista de compras"); }
    finally { setBulkLoading(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Analizando requerimientos...</div>;
  if (error)   return <div style={{ padding: 20, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, color: "#DC2626", fontSize: 13 }}>{error}</div>;
  if (!data)   return null;

  const { items, summary } = data;
  const shortageItems = items.filter(i => i.shortage > 0);
  const notInList     = shortageItems.filter(i => !i.in_purchase_list);

  const coverageBadge = (item) => {
    if (item.shortage === 0)          return { label: "✅ Cubierto",  bg: "#DCFCE7", color: "#166534" };
    if (item.stock_available === 0)   return { label: "❌ Sin stock", bg: "#FEE2E2", color: "#991B1B" };
    return { label: "⚠️ Parcial",    bg: "#FEF9C3", color: "#854D0E" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total materiales", value: summary.total_materials,  color: "#374151" },
          { label: "Cubiertos",        value: summary.fully_covered,    color: "#166534" },
          { label: "Cobertura parcial",value: summary.partial_coverage, color: "#854D0E" },
          { label: "Sin stock",        value: summary.not_in_stock,     color: "#991B1B" },
        ].map(k => (
          <div key={k.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
            <p style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, margin: "5px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Bulk action */}
      {notInList.length > 0 && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontWeight: 700, color: "#9A3412", fontSize: 13, margin: 0 }}>
              {notInList.length} material{notInList.length > 1 ? "es" : ""} con faltante sin agregar a lista de compras
            </p>
            <p style={{ fontSize: 12, color: "#EA580C", margin: "3px 0 0" }}>
              Se agregarán con la cantidad exacta faltante (duplicados se omiten automáticamente)
            </p>
          </div>
          <button onClick={addShortageToList} disabled={bulkLoading}
            style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#9A3412", color: "white", border: "none", borderRadius: 9, cursor: bulkLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: bulkLoading ? 0.6 : 1 }}>
            {bulkLoading ? "Procesando..." : "🛒 Agregar faltantes a compras"}
          </button>
        </div>
      )}
      {notInList.length === 0 && shortageItems.length > 0 && (
        <div style={{ background: "#DBEAFE", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#1E40AF", fontWeight: 600 }}>
          ✓ Todos los faltantes ya están en la lista de compras
        </div>
      )}
      {bulkResult && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", color: "#166534", fontSize: 13, fontWeight: 600 }}>
          ✓ {bulkResult.inserted} ítem{bulkResult.inserted !== 1 ? "s" : ""} agregados a la lista de compras
        </div>
      )}

      {/* Gap table */}
      <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 90px 90px 90px 90px 90px 80px", gap: 8, padding: "11px 16px", background: "#0B2E33" }}>
          {["#", "Material", "Solicitado", "Disponible", "Faltante", "Cobertura", "Estado", "En compras"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
          ))}
        </div>
        {items.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Sin solicitudes de materiales para este proyecto. Operaciones aún no ha generado requerimientos.
          </div>
        ) : (
          items.map((item, idx) => {
            const badge = coverageBadge(item);
            return (
              <div key={item.material_id || idx}
                style={{ display: "grid", gridTemplateColumns: "36px 1fr 90px 90px 90px 90px 90px 80px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: idx < items.length - 1 ? "1px solid #F3F4F6" : "none", background: item.shortage > 0 ? (idx % 2 === 0 ? "#FFFBF5" : "#FFF8F0") : (idx % 2 === 0 ? "white" : "#FAFAFA") }}>
                <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>{idx + 1}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{item.material_name}</p>
                  {item.material_code && <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4F7C82", margin: "2px 0 0" }}>{item.material_code}</p>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{item.total_requested} {item.unit || ""}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.stock_available >= item.total_requested ? "#166534" : "#374151" }}>
                  {item.stock_available} {item.unit || ""}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.shortage > 0 ? "#DC2626" : "#166534" }}>
                  {item.shortage > 0 ? `−${item.shortage}` : "✓"}
                </div>
                <div>
                  <div style={{ background: "#E5E7EB", borderRadius: 99, height: 6, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ height: "100%", borderRadius: 99, background: item.covered_pct === 100 ? "#22C55E" : item.covered_pct > 0 ? "#F59E0B" : "#EF4444", width: `${item.covered_pct}%` }} />
                  </div>
                  <p style={{ fontSize: 11, color: "#6B7280", margin: 0, textAlign: "center" }}>{item.covered_pct}%</p>
                </div>
                <div>
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                <div>
                  {item.in_purchase_list
                    ? <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>En lista</span>
                    : <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>
                  }
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
const TABS = [
  { key: "tools",     label: "🔧 Herramientas",   countKey: "tools_total" },
  { key: "requests",  label: "📋 Solicitudes",    countKey: "requests_total" },
  { key: "dispatches",label: "🚚 Despachos",      countKey: "dispatches_total" },
  { key: "plans",     label: "📐 Planes Operac.", countKey: "plans_total" },
  { key: "gap",       label: "📦 Requerimientos", countKey: null },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [activeTab, setActiveTab] = useState("tools");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await apiFetch(`/logistics/projects/${projectId}/summary`);
      setData(res);
    } catch (e) {
      setError(e.message || "Error al cargar el proyecto");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p style={{ color: "#6B7280", fontWeight: 600 }}>Cargando proyecto...</p>
        </div>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: "#DC2626", fontWeight: 700 }}>{error}</p>
          <button onClick={() => navigate("/logistics/projects")} style={{ marginTop: 14, padding: "8px 20px", background: "#4F7C82", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ← Volver a Proyectos
          </button>
        </div>
      </div>
    </Layout>
  );

  const { kpis, tools, requests, dispatches, plans } = data;

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => navigate("/logistics/projects")}
              style={{ width: 36, height: 36, borderRadius: 10, background: "#F3F4F6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#374151", flexShrink: 0 }}>
              ←
            </button>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #0B2E33, #4F7C82)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "white", fontSize: 22, fontWeight: 900 }}>📁</span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0 }}>{data.name}</h1>
                <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 8, background: "#F0FDFA", color: "#0F766E", fontFamily: "monospace", border: "1px solid #99F6E4" }}>{data.code}</span>
              </div>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 0" }}>Proyecto creado el {fmtDate(data.created_at)}</p>
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={load}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer" }}>
              🔄 Actualizar
            </button>
            <button
              onClick={() => {
                const win = window.open("", "_blank");
                win.document.write(buildPrintHTML(data));
                win.document.close();
                win.print();
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, background: "#EDE9FE", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: 10, cursor: "pointer" }}>
              🖨 Imprimir
            </button>
            <button onClick={() => exportToExcel(data)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 22px", fontSize: 13, fontWeight: 700, background: "#166534", color: "white", border: "none", borderRadius: 10, cursor: "pointer", boxShadow: "0 2px 8px rgba(22,101,52,0.3)" }}>
              📊 Exportar Excel
            </button>
          </div>
        </div>

        {/* ── KPI Banner ── */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <KpiCard icon="🔧" label="Herramientas en campo" value={kpis.tools_in_field} sub={`${kpis.tools_total} total`} color="#1E40AF" />
          <KpiCard icon="📋" label="Solicitudes pendientes" value={kpis.requests_pending} sub={`${kpis.requests_total} total`} color="#854D0E" />
          <KpiCard icon="🚚" label="Despachos entregados" value={kpis.dispatches_delivered} sub={`${kpis.dispatches_total} total`} color="#166534" />
          <KpiCard icon="📐" label="Planes de operación" value={kpis.plans_total} sub="vinculados" color="#4F7C82" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
          {/* Tab nav */}
          <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", overflowX: "auto" }}>
            {TABS.map(t => {
              const count = t.countKey ? (kpis[t.countKey] ?? 0) : null;
              const isActive = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ padding: "14px 22px", fontSize: 13, fontWeight: isActive ? 700 : 500, border: "none", background: "transparent", cursor: "pointer", whiteSpace: "nowrap", color: isActive ? "#0B2E33" : "#6B7280", borderBottom: isActive ? "2.5px solid #4F7C82" : "2.5px solid transparent", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
                  {t.label}
                  {count !== null && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: isActive ? "#0B2E33" : "#E5E7EB", color: isActive ? "white" : "#6B7280" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: "20px 24px", overflowX: "auto" }}>
            {activeTab === "tools"      && <ToolsTab tools={tools} />}
            {activeTab === "requests"   && <RequestsTab requests={requests} />}
            {activeTab === "dispatches" && <DispatchesTab dispatches={dispatches} />}
            {activeTab === "plans"      && <PlansTab plans={plans} />}
            {activeTab === "gap"        && <RequirementsGapTab projectId={projectId} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ── Print HTML builder ────────────────────────────────────────────────────────
function buildPrintHTML(project) {
  const toolRows = project.tools.map(t => `
    <tr>
      <td>${t.tool_name}</td><td>${t.tool_code || "—"}</td>
      <td>${t.status === "ASSIGNED" ? "En campo" : "Devuelto"}</td>
      <td>${t.assigned_to || "—"}</td>
      <td>${t.assigned_at ? new Date(t.assigned_at).toLocaleDateString("es-PE") : "—"}</td>
      <td>${t.expected_return ? new Date(t.expected_return).toLocaleDateString("es-PE") : "—"}</td>
      <td>${t.condition_out || "—"}</td>
    </tr>`).join("");

  const reqRows = project.requests.map(r => `
    <tr>
      <td>${r.material_name || "—"}</td><td>${r.quantity ?? "—"}</td>
      <td>${r.requested_by}</td><td>${r.priority || "—"}</td>
      <td>${r.needed_by ? new Date(r.needed_by).toLocaleDateString("es-PE") : "—"}</td>
      <td>${r.status}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Proyecto ${project.code}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
    h1 { font-size: 20px; color: #0B2E33; margin-bottom: 4px; }
    .subtitle { color: #6B7280; margin-bottom: 16px; font-size: 11px; }
    .kpis { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px 16px; min-width: 120px; }
    .kpi-val { font-size: 22px; font-weight: bold; color: #0B2E33; }
    .kpi-lbl { font-size: 11px; color: #666; }
    h2 { font-size: 14px; color: #0B2E33; border-bottom: 2px solid #4F7C82; padding-bottom: 4px; margin: 20px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #F0FDFA; text-align: left; padding: 8px; font-size: 11px; color: #374151; border-bottom: 2px solid #4F7C82; }
    td { padding: 7px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #F9FAFB; }
    .footer { margin-top: 30px; font-size: 10px; color: #9CA3AF; border-top: 1px solid #eee; padding-top: 8px; }
    @media print { @page { margin: 15mm; } }
  </style></head><body>
  <h1>📁 ${project.name}</h1>
  <p class="subtitle">Código: ${project.code} · Creado: ${project.created_at ? new Date(project.created_at).toLocaleDateString("es-PE") : "—"} · Impreso: ${new Date().toLocaleString("es-PE")}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${project.kpis.tools_in_field}</div><div class="kpi-lbl">Herramientas en campo</div></div>
    <div class="kpi"><div class="kpi-val">${project.kpis.requests_pending}</div><div class="kpi-lbl">Solicitudes pendientes</div></div>
    <div class="kpi"><div class="kpi-val">${project.kpis.dispatches_delivered}</div><div class="kpi-lbl">Despachos entregados</div></div>
    <div class="kpi"><div class="kpi-val">${project.kpis.plans_total}</div><div class="kpi-lbl">Planes vinculados</div></div>
  </div>
  <h2>🔧 Herramientas</h2>
  <table><thead><tr><th>Herramienta</th><th>Código</th><th>Estado</th><th>Asignado a</th><th>Desde</th><th>Devolución</th><th>Condición</th></tr></thead>
  <tbody>${toolRows || "<tr><td colspan='7' style='color:#aaa;text-align:center'>Sin registros</td></tr>"}</tbody></table>
  <h2>📋 Solicitudes de Materiales</h2>
  <table><thead><tr><th>Material</th><th>Cantidad</th><th>Solicitado por</th><th>Prioridad</th><th>Se necesita</th><th>Estado</th></tr></thead>
  <tbody>${reqRows || "<tr><td colspan='6' style='color:#aaa;text-align:center'>Sin registros</td></tr>"}</tbody></table>
  <div class="footer">CeShark ERP Modular · Documento generado automáticamente · ${new Date().toLocaleString("es-PE")}</div>
  </body></html>`;
}
