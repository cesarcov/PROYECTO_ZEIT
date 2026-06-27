import { useState, useEffect } from "react";
import Layout from "../../components/Layout";

import { BASE_URL as API } from "../../services/api";
const token = () => localStorage.getItem("access_token");

const STATUS_LABELS = { OPEN: "Abierto", COUNTING: "En conteo", CLOSED: "Cerrado", APPROVED: "Aprobado" };
const STATUS_COLORS = { OPEN: "#2563EB", COUNTING: "#B45309", CLOSED: "#7C3AED", APPROVED: "#4A7C59" };

export default function PhysicalInventoryView() {
  const [inventories, setInventories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ warehouse_id: "", title: "", notes: "" });
  const [countVal, setCountVal] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [invRes, whRes] = await Promise.all([
      fetch(`${API}/logistics/physical-inventory`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/logistics/warehouses`, { headers: { Authorization: `Bearer ${token()}` } }),
    ]);
    if (invRes.ok) setInventories(await invRes.json());
    if (whRes.ok) setWarehouses(await whRes.json());
  };

  const loadDetail = async (id) => {
    const res = await fetch(`${API}/logistics/physical-inventory/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) {
      const d = await res.json();
      setDetail(d);
      // Pre-llenar valores contados con lo que ya exista
      const vals = {};
      d.items?.forEach(it => { if (it.counted_quantity != null) vals[it.id] = it.counted_quantity; });
      setCountVal(vals);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (inv) => { setSelected(inv.id); loadDetail(inv.id); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/logistics/physical-inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setShowForm(false);
      setForm({ warehouse_id: "", title: "", notes: "" });
      load();
      setMsg("Inventario abierto correctamente");
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const saveCount = async (item) => {
    const counted = parseFloat(countVal[item.id]);
    if (isNaN(counted)) return;
    await fetch(`${API}/logistics/physical-inventory/${detail.id}/items/count`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ item_id: item.id, counted_quantity: counted }),
    });
    loadDetail(detail.id);
  };

  const handleClose = async () => {
    setLoading(true);
    await fetch(`${API}/logistics/physical-inventory/${detail.id}/close`, { method: "POST", headers: { Authorization: `Bearer ${token()}` } });
    setLoading(false);
    loadDetail(detail.id);
    load();
  };

  const handleApprove = async () => {
    if (!confirm("¿Aprobar el inventario y aplicar los ajustes de stock? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    const res = await fetch(`${API}/logistics/physical-inventory/${detail.id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token()}` } });
    setLoading(false);
    if (res.ok) { const d = await res.json(); setMsg(`✓ ${d.adjustments_applied} ajuste(s) aplicado(s) al stock`); }
    loadDetail(detail.id);
    load();
  };

  const col = { fontSize: 12, color: "#6B7280", padding: "8px 12px", borderBottom: "1px solid #F3F4F6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };
  const td  = { fontSize: 13, color: "#1F2937", padding: "8px 12px", borderBottom: "1px solid #F9FAFB" };

  const totalDiff = detail?.items?.reduce((acc, it) => {
    const diff = (it.counted_quantity ?? it.system_quantity) - it.system_quantity;
    return acc + diff * parseFloat(it.unit_cost || 0);
  }, 0) ?? 0;

  return (
    <Layout>
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)", margin: 0 }}>Inventario Físico</h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>Toma de inventario formal con ajuste de stock</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Abrir Inventario
        </button>
      </div>

      {msg && <div style={{ background: msg.startsWith("Error") ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${msg.startsWith("Error") ? "#FECACA" : "#BBF7D0"}`, borderRadius: 8, padding: "10px 14px", color: msg.startsWith("Error") ? "#DC2626" : "#166534", fontSize: 13, marginBottom: 16 }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: selected ? "320px 1fr" : "1fr", gap: 20 }}>
        {/* Lista inventarios */}
        <div>
          <div style={{ borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            {inventories.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontSize: 13 }}>Sin inventarios</div>}
            {inventories.map(inv => (
              <div key={inv.id} onClick={() => handleOpen(inv)} style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", cursor: "pointer", background: selected === inv.id ? "#F0F9FF" : "white" }} onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = selected === inv.id ? "#F0F9FF" : "white"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--primary)" }}>{inv.inv_number}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{inv.warehouse_name} · {inv.item_count} ítems</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(inv.started_at).toLocaleDateString("es-PE")}</div>
                  </div>
                  <span style={{ background: (STATUS_COLORS[inv.status] ?? "#9CA3AF") + "22", color: STATUS_COLORS[inv.status] ?? "#9CA3AF", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalle de conteo */}
        {selected && detail && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: 16 }}>{detail.inv_number}</span>
                <span style={{ marginLeft: 10, background: (STATUS_COLORS[detail.status] ?? "#9CA3AF") + "22", color: STATUS_COLORS[detail.status] ?? "#9CA3AF", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{STATUS_LABELS[detail.status]}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {detail.status === "COUNTING" && (
                  <button disabled={loading} onClick={handleClose} style={{ background: "#7C3AED", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    {loading ? "..." : "Cerrar inventario"}
                  </button>
                )}
                {detail.status === "CLOSED" && (
                  <button disabled={loading} onClick={handleApprove} style={{ background: "#4A7C59", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    {loading ? "..." : "Aprobar y ajustar stock"}
                  </button>
                )}
              </div>
            </div>

            {/* Resumen diferencia valorizada */}
            <div style={{ background: totalDiff < 0 ? "#FEF2F2" : totalDiff > 0 ? "#F0FDF4" : "#F9FAFB", borderRadius: 10, border: `1px solid ${totalDiff < 0 ? "#FECACA" : totalDiff > 0 ? "#BBF7D0" : "#E5E7EB"}`, padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
              <strong>Diferencia valorizada total:</strong>{" "}
              <span style={{ color: totalDiff < 0 ? "#DC2626" : totalDiff > 0 ? "#166534" : "#6B7280", fontWeight: 700 }}>
                {totalDiff >= 0 ? "+" : ""}S/ {totalDiff.toFixed(2)}
              </span>
            </div>

            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#F9FAFB" }}>
                  <tr>{["Material", "Sistema", "Conteo físico", "Diferencia", "Valor diff.", ""].map(h => <th key={h} style={col}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {detail.items?.map(item => {
                    const diff = (item.counted_quantity ?? item.system_quantity) - item.system_quantity;
                    const valDiff = diff * parseFloat(item.unit_cost || 0);
                    const canEdit = ["OPEN", "COUNTING"].includes(detail.status);
                    return (
                      <tr key={item.id}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{item.material_name}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{item.code} · {item.unit}</div>
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>{parseFloat(item.system_quantity ?? 0).toFixed(2)}</td>
                        <td style={{ ...td, textAlign: "center" }}>
                          {canEdit ? (
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <input type="number" step="any" min="0" value={countVal[item.id] ?? ""} onChange={e => setCountVal(p => ({ ...p, [item.id]: e.target.value }))} style={{ width: 70, padding: "4px 8px", border: "1.5px solid #E5E7EB", borderRadius: 6, fontSize: 12, textAlign: "center" }} />
                              <button onClick={() => saveCount(item)} style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>✓</button>
                            </div>
                          ) : (
                            parseFloat(item.counted_quantity ?? item.system_quantity).toFixed(2)
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "center", color: diff < 0 ? "#DC2626" : diff > 0 ? "#166534" : "#6B7280", fontWeight: diff !== 0 ? 700 : 400 }}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: valDiff < 0 ? "#DC2626" : valDiff > 0 ? "#166534" : "#6B7280", fontSize: 12 }}>
                          {valDiff !== 0 ? `${valDiff >= 0 ? "+" : ""}S/ ${valDiff.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          {item.adjusted && <span style={{ background: "#BBF7D0", color: "#166534", borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>AJUSTADO</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear inventario */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800, color: "var(--primary)" }}>Abrir Inventario Físico</h3>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Al abrir el inventario se captura el stock actual del almacén como referencia del sistema.</p>
            <form onSubmit={handleCreate}>
              {[["Almacén *", "warehouse_id", "select"], ["Título *", "title", "text"], ["Notas", "notes", "text"]].map(([label, key, type]) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
                  {type === "select" ? (
                    <select required value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13 }}>
                      <option value="">Seleccionar almacén...</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" required={label.includes("*")} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px 0", border: "1.5px solid #E5E7EB", borderRadius: 9, background: "white", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{loading ? "Abriendo..." : "Abrir Inventario"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
