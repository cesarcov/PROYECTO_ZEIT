import { useState, useEffect } from "react";
import Layout from "../../components/Layout";

import { BASE_URL as API } from "../../services/api";
const token = () => localStorage.getItem("access_token");

const STATUS_LABELS = { PENDING: "Pendiente", APPROVED: "Aprobada", IN_TRANSIT: "En tránsito", RECEIVED: "Recibida", CANCELLED: "Cancelada" };
const STATUS_COLORS = { PENDING: "#B45309", APPROVED: "#2563EB", IN_TRANSIT: "#7C3AED", RECEIVED: "#4A7C59", CANCELLED: "#9CA3AF" };
const NEXT_STATUS  = { PENDING: "APPROVED", APPROVED: "IN_TRANSIT", IN_TRANSIT: null };

export default function TransfersView() {
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from_warehouse_id: "", to_warehouse_id: "", notes: "", items: [{ material_id: "", quantity_requested: "", notes: "" }] });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const params = filterStatus ? `?status=${filterStatus}` : "";
    const [tRes, wRes, mRes] = await Promise.all([
      fetch(`${API}/logistics/transfers${params}`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/logistics/warehouses`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/logistics/materials`, { headers: { Authorization: `Bearer ${token()}` } }),
    ]);
    if (tRes.ok) setTransfers(await tRes.json());
    if (wRes.ok) setWarehouses(await wRes.json());
    if (mRes.ok) setMaterials(await mRes.json());
  };

  const loadDetail = async (id) => {
    const res = await fetch(`${API}/logistics/transfers/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setDetail(await res.json());
  };

  useEffect(() => { load(); }, [filterStatus]);

  const openDetail = (t) => { setSelected(t.id); loadDetail(t.id); };

  const handleStatus = async (id, status) => {
    setLoading(true);
    const res = await fetch(`${API}/logistics/transfers/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (res.ok) { load(); loadDetail(id); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const payload = {
        ...form,
        items: form.items.filter(i => i.material_id && i.quantity_requested).map(i => ({ ...i, quantity_requested: parseFloat(i.quantity_requested) })),
      };
      const res = await fetch(`${API}/logistics/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setShowForm(false);
      setForm({ from_warehouse_id: "", to_warehouse_id: "", notes: "", items: [{ material_id: "", quantity_requested: "", notes: "" }] });
      load();
      setMsg("Transferencia creada");
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { material_id: "", quantity_requested: "", notes: "" }] }));
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, k, v) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));

  const col = { fontSize: 12, color: "#6B7280", padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #F3F4F6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };
  const td  = { fontSize: 13, color: "#1F2937", padding: "10px 12px", borderBottom: "1px solid #F9FAFB" };

  return (
    <Layout>
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 20 }}>
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)", margin: 0 }}>Transferencias entre Almacenes</h2>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>Solicita y aprueba movimientos entre ubicaciones</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + Nueva Transferencia
          </button>
        </div>

        {msg && <div style={{ background: msg.startsWith("Error") ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${msg.startsWith("Error") ? "#FECACA" : "#BBF7D0"}`, borderRadius: 8, padding: "10px 14px", color: msg.startsWith("Error") ? "#DC2626" : "#166534", fontSize: 13, marginBottom: 16 }}>{msg}</div>}

        {/* Filtro estado */}
        <div style={{ marginBottom: 16 }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13 }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F9FAFB" }}>
              <tr>{["N° Transferencia", "Desde", "Hasta", "Ítems", "Estado", "Fecha"].map(h => <th key={h} style={col}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id} onClick={() => openDetail(t)} style={{ cursor: "pointer", background: selected === t.id ? "#F0F9FF" : "white" }} onMouseEnter={e => e.currentTarget.style.background = selected === t.id ? "#F0F9FF" : "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = selected === t.id ? "#F0F9FF" : "white"}>
                  <td style={td}><span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{t.transfer_number}</span></td>
                  <td style={td}>{t.from_warehouse}</td>
                  <td style={td}>→ {t.to_warehouse}</td>
                  <td style={{ ...td, textAlign: "center" }}>{t.item_count}</td>
                  <td style={td}><span style={{ background: (STATUS_COLORS[t.status] ?? "#9CA3AF") + "22", color: STATUS_COLORS[t.status] ?? "#9CA3AF", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{STATUS_LABELS[t.status] ?? t.status}</span></td>
                  <td style={{ ...td, fontSize: 12, color: "#6B7280" }}>{new Date(t.requested_at).toLocaleDateString("es-PE")}</td>
                </tr>
              ))}
              {transfers.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Sin transferencias</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel de detalle */}
      {selected && detail && (
        <div style={{ background: "#F9FAFB", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: 15 }}>{detail.transfer_number}</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9CA3AF" }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
            <div><strong>Origen:</strong> {detail.from_warehouse_name}</div>
            <div><strong>Destino:</strong> {detail.to_warehouse_name}</div>
            <div><strong>Estado:</strong> <span style={{ fontWeight: 700, color: STATUS_COLORS[detail.status] }}>{STATUS_LABELS[detail.status]}</span></div>
            {detail.notes && <div style={{ marginTop: 6, color: "#6B7280" }}>{detail.notes}</div>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 6 }}>Ítems</div>
            {detail.items?.map(it => (
              <div key={it.id} style={{ background: "white", borderRadius: 8, border: "1px solid #E5E7EB", padding: "8px 12px", marginBottom: 6, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{it.material_name}</div>
                <div style={{ color: "#6B7280", fontSize: 12 }}>Solicitado: {it.quantity_requested} {it.unit} {it.quantity_received != null ? `· Recibido: ${it.quantity_received}` : ""}</div>
              </div>
            ))}
          </div>
          {NEXT_STATUS[detail.status] && (
            <button disabled={loading} onClick={() => handleStatus(detail.id, NEXT_STATUS[detail.status])} style={{ width: "100%", background: "var(--primary)", color: "white", border: "none", borderRadius: 9, padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
              {loading ? "..." : `Marcar como ${STATUS_LABELS[NEXT_STATUS[detail.status]]}`}
            </button>
          )}
          {detail.status === "APPROVED" && (
            <button disabled={loading} onClick={() => handleStatus(detail.id, "CANCELLED")} style={{ width: "100%", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 9, padding: "8px 0", fontWeight: 600, fontSize: 12, cursor: "pointer", marginTop: 6 }}>
              Cancelar transferencia
            </button>
          )}
        </div>
      )}

      {/* Modal crear transferencia */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800, color: "var(--primary)" }}>Nueva Transferencia</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {[["Almacén Origen *", "from_warehouse_id"], ["Almacén Destino *", "to_warehouse_id"]].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
                    <select required value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13 }}>
                      <option value="">Seleccionar...</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>Notas</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} placeholder="Motivo de la transferencia..." />
              </div>

              <div style={{ marginBottom: 8, fontWeight: 700, color: "var(--primary)", fontSize: 13 }}>Materiales a transferir</div>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                  <select required value={item.material_id} onChange={e => updateItem(i, "material_id", e.target.value)} style={{ padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}>
                    <option value="">Material...</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                  </select>
                  <input type="number" required min="0.01" step="any" placeholder="Cant." value={item.quantity_requested} onChange={e => updateItem(i, "quantity_requested", e.target.value)} style={{ padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
                  <button type="button" onClick={() => removeItem(i)} style={{ background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>✕</button>
                </div>
              ))}
              <button type="button" onClick={addItem} style={{ background: "none", border: "1.5px dashed #D1D5DB", borderRadius: 8, padding: "6px 14px", color: "var(--primary)", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>+ Agregar material</button>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px 0", border: "1.5px solid #E5E7EB", borderRadius: 9, background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>{loading ? "Creando..." : "Crear Transferencia"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
