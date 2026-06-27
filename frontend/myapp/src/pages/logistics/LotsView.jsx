import { useState, useEffect } from "react";
import Layout from "../../components/Layout";

import { BASE_URL as API } from "../../services/api";
const token = () => localStorage.getItem("access_token");

const STATUS_LABELS = { ACTIVE: "Activo", DEPLETED: "Agotado", EXPIRED: "Vencido", QUARANTINE: "Cuarentena" };
const STATUS_COLORS = { ACTIVE: "#4A7C59", DEPLETED: "#9CA3AF", EXPIRED: "#DC2626", QUARANTINE: "#B45309" };

export default function LotsView() {
  const [lots, setLots] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filterMat, setFilterMat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [tab, setTab] = useState("lots");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ material_id: "", lot_number: "", warehouse_id: "", quantity: "", unit_cost: "", expiry_date: "", supplier_name: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (filterMat) params.set("material_id", filterMat);
    if (filterStatus) params.set("status", filterStatus);
    const [lotsRes, expiringRes, matsRes, whRes] = await Promise.all([
      fetch(`${API}/logistics/lots?${params}`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/logistics/lots/alerts/expiring?days=30`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/logistics/materials`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/logistics/warehouses`, { headers: { Authorization: `Bearer ${token()}` } }),
    ]);
    if (lotsRes.ok) setLots(await lotsRes.json());
    if (expiringRes.ok) setExpiring(await expiringRes.json());
    if (matsRes.ok) setMaterials(await matsRes.json());
    if (whRes.ok) setWarehouses(await whRes.json());
  };

  useEffect(() => { load(); }, [filterMat, filterStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/logistics/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...form, quantity: parseFloat(form.quantity), unit_cost: parseFloat(form.unit_cost || 0) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setShowForm(false);
      setForm({ material_id: "", lot_number: "", warehouse_id: "", quantity: "", unit_cost: "", expiry_date: "", supplier_name: "", notes: "" });
      load();
      setMsg("Lote creado correctamente");
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const downloadQR = (lot) => {
    window.open(`${API}/logistics/advanced/qr/lot/${lot.id}?token=${token()}`, "_blank");
  };

  const col = { fontSize: 12, color: "#6B7280", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #F3F4F6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };
  const td  = { fontSize: 13, color: "#1F2937", padding: "10px 12px", borderBottom: "1px solid #F9FAFB" };

  return (
    <Layout>
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)", margin: 0 }}>Trazabilidad por Lote</h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>Gestión y seguimiento de lotes de stock</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Nuevo Lote
        </button>
      </div>

      {msg && <div style={{ background: msg.startsWith("Error") ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${msg.startsWith("Error") ? "#FECACA" : "#BBF7D0"}`, borderRadius: 8, padding: "10px 14px", color: msg.startsWith("Error") ? "#DC2626" : "#166534", fontSize: 13, marginBottom: 16 }}>{msg}</div>}

      {/* Alerta vencimientos */}
      {expiring.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#92400E" }}>
          ⚠️ <strong>{expiring.length} lote(s)</strong> vencen en los próximos 30 días —{" "}
          <button onClick={() => setTab("expiring")} style={{ background: "none", border: "none", color: "#B45309", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>ver alertas</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid #F3F4F6" }}>
        {[["lots", "Todos los lotes"], ["expiring", `Por vencer (${expiring.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", padding: "8px 16px", fontWeight: tab === key ? 700 : 500, color: tab === key ? "var(--primary)" : "#6B7280", borderBottom: tab === key ? "2px solid var(--primary)" : "2px solid transparent", cursor: "pointer", fontSize: 13, marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {tab === "lots" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={filterMat} onChange={e => setFilterMat(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#374151" }}>
            <option value="">Todos los materiales</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13 }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#F9FAFB" }}>
            <tr>
              {tab === "expiring"
                ? ["Lote", "Material", "Almacén", "Vence en", "Qty restante", ""].map(h => <th key={h} style={col}>{h}</th>)
                : ["N° Lote", "Material", "Almacén", "Qty inicial", "Qty restante", "Costo U.", "Vto.", "Estado", ""].map(h => <th key={h} style={col}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {(tab === "expiring" ? expiring : lots).map(lot => (
              <tr key={lot.id} style={{ transition: "background 0.1s" }} onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                <td style={td}><span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{lot.lot_number}</span></td>
                <td style={td}>{lot.material_name}<br/><span style={{ fontSize: 11, color: "#9CA3AF" }}>{lot.material_code ?? lot.code}</span></td>
                <td style={td}>{lot.warehouse_name ?? "—"}</td>
                {tab === "expiring" ? (
                  <>
                    <td style={{ ...td, color: lot.days_until_expiry <= 7 ? "#DC2626" : "#B45309", fontWeight: 700 }}>{lot.days_until_expiry} días</td>
                    <td style={td}>{lot.remaining_quantity} {lot.unit}</td>
                  </>
                ) : (
                  <>
                    <td style={td}>{lot.quantity}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{lot.remaining_quantity}</td>
                    <td style={td}>S/ {parseFloat(lot.unit_cost || 0).toFixed(2)}</td>
                    <td style={td}>{lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString("es-PE") : "—"}</td>
                    <td style={td}>
                      <span style={{ background: STATUS_COLORS[lot.status] + "22", color: STATUS_COLORS[lot.status], borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        {STATUS_LABELS[lot.status] ?? lot.status}
                      </span>
                    </td>
                  </>
                )}
                <td style={td}>
                  <button onClick={() => downloadQR(lot)} title="Descargar QR" style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 16 }}>⬜</button>
                </td>
              </tr>
            ))}
            {(tab === "expiring" ? expiring : lots).length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontSize: 13 }}>Sin lotes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear lote */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800, color: "var(--primary)" }}>Crear nuevo lote</h3>
            <form onSubmit={handleCreate}>
              {[
                { label: "Material *", key: "material_id", type: "select" },
                { label: "N° de Lote *", key: "lot_number", type: "text" },
                { label: "Almacén", key: "warehouse_id", type: "select-wh" },
                { label: "Cantidad *", key: "quantity", type: "number" },
                { label: "Costo unitario (S/)", key: "unit_cost", type: "number" },
                { label: "Fecha de vencimiento", key: "expiry_date", type: "date" },
                { label: "Proveedor", key: "supplier_name", type: "text" },
                { label: "Notas", key: "notes", type: "text" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{f.label}</label>
                  {f.type === "select" ? (
                    <select required value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13 }}>
                      <option value="">Seleccionar...</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                    </select>
                  ) : f.type === "select-wh" ? (
                    <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13 }}>
                      <option value="">Sin almacén asignado</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.label.includes("*")} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px 0", border: "1.5px solid #E5E7EB", borderRadius: 9, background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>{loading ? "Guardando..." : "Crear Lote"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
