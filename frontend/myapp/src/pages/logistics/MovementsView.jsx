import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch } from "../../services/api";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const TYPE_CFG = {
  IN:       { label: "Ingreso",       bg: "#DCFCE7", color: "#166534", arrow: "↓" },
  OUT:      { label: "Salida",        bg: "#FEE2E2", color: "#991B1B", arrow: "↑" },
  RETURN:   { label: "Devolución",    bg: "#CCFBF1", color: "#0F766E", arrow: "↩" },
  TRANSFER: { label: "Transferencia", bg: "#EDE9FE", color: "#6D28D9", arrow: "⇄" },
  ADJUST:   { label: "Ajuste",        bg: "#FFEDD5", color: "#9A3412", arrow: "≈" },
};

function TypeBadge({ type }) {
  const s = TYPE_CFG[type] || { label: type, bg: "#F3F4F6", color: "#4B5563", arrow: "?" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>
      {s.arrow} {s.label}
    </span>
  );
}

const inputStyle = {
  width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
  padding: "8px 10px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box",
};

// ── Helpers for new-material registration ─────────────────────────────────────
const SUGGESTED_CATS = ["EPP", "Herramienta", "Equipo", "Consumible", "Repuesto", "Material", "Instrumento", "Accesorio"];
const EQUIP_CATS = new Set(["Equipo", "Herramienta", "Instrumento"]);

function genCode(name, category, existing = []) {
  const clean = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]/g, "").trim();
  const stop = new Set(["de","del","la","el","los","las","un","una","y","e","o","a","en","con","para"]);
  const c2 = clean(category || "OT").slice(0, 2).toUpperCase();
  const words = clean(name).split(/\s+/).filter(w => w && !stop.has(w.toLowerCase()));
  let np;
  if (!words.length) np = clean(name).slice(0, 4);
  else if (words.length === 1) np = words[0].slice(0, 4);
  else { const t = Math.max(1, Math.ceil(4 / words.length)); np = words.map(w => w.slice(0, t)).join("").slice(0, 4); }
  np = np.toUpperCase();
  const base = (c2 + np).slice(0, 6);
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d{1,2})$`);
  const nums = existing.map(c => { const m = String(c).match(re); return m ? parseInt(m[1]) : 0; }).filter(n => n > 0);
  return base + String(nums.length ? Math.max(...nums) + 1 : 1).padStart(2, "0");
}

function SectionDivider({ label, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: accent ? "var(--primary)" : "#9CA3AF", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: accent ? "var(--primary-soft)" : "#E5E7EB" }} />
    </div>
  );
}

// ── Modal: Nuevo material + stock inicial ─────────────────────────────────────
function NewMaterialWithStockModal({ warehouses, existingMaterials, onClose, onSuccess }) {
  const navigate = useNavigate();
  const existingCodes = existingMaterials.map(m => m.code);

  const [mat, setMat] = useState({
    name: "", code: "", category: "", min_stock: "",
    brand: "", model: "", supplier_name: "", supplier_contact: "", unit_cost: "",
    serial_number: "", purchase_date: "", warranty_expires: "",
  });
  const [codeAuto, setCodeAuto] = useState(true);
  const [customCat, setCustomCat] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const set = k => e => setMat(m => ({ ...m, [k]: e.target.value }));

  const handleName = e => {
    const v = e.target.value;
    setMat(m => ({ ...m, name: v, code: codeAuto ? genCode(v, m.category, existingCodes) : m.code }));
  };
  const handleCat = v => {
    setMat(m => ({ ...m, category: v, code: codeAuto ? genCode(m.name, v, existingCodes) : m.code }));
  };
  const handleCode = e => {
    setCodeAuto(false);
    setMat(m => ({ ...m, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8) }));
  };

  const submit = async () => {
    if (!mat.name.trim())        { setError("Nombre es obligatorio"); return; }
    if (!mat.code.trim())        { setError("Código es obligatorio"); return; }
    if (!mat.category)           { setError("Categoría es obligatoria"); return; }
    if (!warehouseId)            { setError("Almacén de destino es obligatorio"); return; }
    if (!qty || Number(qty) <= 0){ setError("La cantidad inicial debe ser mayor a 0"); return; }

    setLoading(true); setError("");
    try {
      const newMat = await apiFetch("/logistics/materials", {
        method: "POST",
        body: JSON.stringify({
          name: mat.name.trim(), code: mat.code.trim().toUpperCase(),
          category: mat.category,
          min_stock: mat.min_stock ? parseFloat(mat.min_stock) : 0,
          aliases: [],
          brand:            mat.brand.trim() || null,
          model:            mat.model.trim() || null,
          supplier_name:    mat.supplier_name.trim() || null,
          supplier_contact: mat.supplier_contact.trim() || null,
          unit_cost:        mat.unit_cost ? parseFloat(mat.unit_cost) : null,
          serial_number:    mat.serial_number.trim() || null,
          purchase_date:    mat.purchase_date || null,
          warranty_expires: mat.warranty_expires || null,
        }),
      });

      await apiFetch("/logistics/stock-movements/", {
        method: "POST",
        body: JSON.stringify({
          material_id: newMat.id, warehouse_id: warehouseId,
          movement_type: "IN", quantity: Number(qty),
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      setCreated(newMat);
    } catch (e) {
      setError(e.message || "Error al registrar material");
    } finally {
      setLoading(false);
    }
  };

  const isEquip = EQUIP_CATS.has(mat.category);
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 };

  if (created) {
    return (
      <Modal title="Material registrado" subtitle="El catálogo y el stock han sido actualizados" onClose={onSuccess} maxWidth={440}>
        <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>✅</div>
          <p style={{ fontWeight: 800, color: "#166534", fontSize: 17, marginTop: 14, marginBottom: 8 }}>{created.name}</p>
          <span style={{ fontFamily: "monospace", background: "#DCFCE7", color: "#166534", padding: "5px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{created.code}</span>
          <p style={{ color: "#6B7280", fontSize: 13, marginTop: 16, lineHeight: 1.6 }}>
            Registrado en el catálogo de materiales<br/>
            e ingresado al almacén con stock inicial.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
            <button onClick={() => navigate("/materials")}
              style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>
              Ver en Materiales →
            </button>
            <button onClick={onSuccess}
              style={{ padding: "9px 24px", fontSize: 13, fontWeight: 700, background: "var(--primary)", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Listo
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nuevo Material + Stock Inicial" subtitle="Se crea en el catálogo y se ingresa al almacén en un solo paso" onClose={onClose} maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Identificación ── */}
        <div>
          <SectionDivider label="Identificación" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Nombre *</label>
              <input autoFocus type="text" placeholder="Ej: Multímetro Digital Fluke 117"
                value={mat.name} onChange={handleName} style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={lbl}>
                Código * {codeAuto && mat.name && (
                  <span style={{ fontWeight: 400, fontSize: 10, color: "#9CA3AF", textTransform: "none", letterSpacing: 0 }}>— auto</span>
                )}
              </label>
              <input type="text" value={mat.code} onChange={handleCode} placeholder="IM-MULT-01" maxLength={8}
                style={{ ...inputStyle, fontFamily: "monospace" }}
                onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Máx. 8 chars. Se genera del nombre y categoría.</p>
            </div>
            <div>
              <label style={lbl}>Stock mínimo</label>
              <input type="number" min="0" value={mat.min_stock} onChange={set("min_stock")} placeholder="0"
                style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Categoría *</label>
              {customCat ? (
                <div>
                  <input type="text" autoFocus value={mat.category} onChange={e => handleCat(e.target.value)}
                    placeholder="Nombre de nueva categoría..." style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
                  <button onClick={() => { setCustomCat(false); handleCat(""); }}
                    style={{ fontSize: 11, color: "#6B7280", background: "none", border: "none", cursor: "pointer", marginTop: 3 }}>
                    ← Ver categorías sugeridas
                  </button>
                </div>
              ) : (
                <select value={mat.category}
                  onChange={e => { if (e.target.value === "__new__") setCustomCat(true); else handleCat(e.target.value); }}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"}>
                  <option value="">Seleccionar categoría...</option>
                  {SUGGESTED_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  <option disabled>──────────────</option>
                  <option value="__new__">+ Nueva categoría personalizada...</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── Proveedor y Costo ── */}
        <div>
          <SectionDivider label="Proveedor y Costo" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Marca</label>
              <input type="text" value={mat.brand} onChange={set("brand")} placeholder="Ej: Fluke, Bosch, 3M"
                style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={lbl}>Modelo</label>
              <input type="text" value={mat.model} onChange={set("model")} placeholder="Ej: 117, Pro-2"
                style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Proveedor</label>
              <input type="text" value={mat.supplier_name} onChange={set("supplier_name")} placeholder="Nombre de la empresa proveedora"
                style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={lbl}>Contacto proveedor</label>
              <input type="text" value={mat.supplier_contact} onChange={set("supplier_contact")} placeholder="Teléf. / email"
                style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
            <div>
              <label style={lbl}>Costo unitario (S/)</label>
              <input type="number" min="0" step="0.01" value={mat.unit_cost} onChange={set("unit_cost")} placeholder="0.00"
                style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
            </div>
          </div>
        </div>

        {/* ── Detalles técnicos (solo Equipo / Herramienta / Instrumento) ── */}
        {isEquip && (
          <div>
            <SectionDivider label={`Detalles técnicos — ${mat.category}`} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Número de serie</label>
                <input type="text" value={mat.serial_number} onChange={set("serial_number")} placeholder="Ej: SN-2024-00123"
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              </div>
              <div>
                <label style={lbl}>Fecha de compra</label>
                <input type="date" value={mat.purchase_date} onChange={set("purchase_date")} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              </div>
              <div>
                <label style={lbl}>Garantía hasta</label>
                <input type="date" value={mat.warranty_expires} onChange={set("warranty_expires")} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              </div>
            </div>
          </div>
        )}

        {/* ── Ingreso al almacén ── */}
        <div>
          <SectionDivider label="Ingreso al Almacén" accent />
          <div style={{ background: "var(--primary-soft)", border: "1px solid #D1D5DB", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ ...lbl, color: "var(--primary)" }}>Almacén de destino *</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"}>
                  <option value="">Seleccionar almacén...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...lbl, color: "var(--primary)" }}>Cantidad inicial *</label>
                <input type="number" min="0.01" step="0.01" value={qty}
                  onChange={e => setQty(e.target.value)} placeholder="0"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              </div>
              <div>
                <label style={lbl}>Referencia (OC / Factura)</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="OC-2024-001"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Observaciones</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales del ingreso..."
                  style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid #F3F4F6" }}>
          <button onClick={onClose}
            style={{ padding: "8px 18px", fontSize: 13, color: "#6B7280", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            style={{ padding: "9px 22px", fontSize: 13, fontWeight: 700, background: "var(--primary)", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Registrando..." : "✓ Crear material e ingresar stock"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewMovementModal({ materials, warehouses, onClose, onSuccess }) {
  const [form, setForm] = useState({ material_id: "", warehouse_id: "", movement_type: "IN", quantity: "", reference: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.material_id || !form.warehouse_id || !form.quantity) {
      setError("Material, almacén y cantidad son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch("/logistics/stock-movements/", {
        method: "POST",
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al registrar movimiento");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };

  return (
    <Modal title="Registrar Movimiento" subtitle="Complete los datos del movimiento" onClose={onClose} maxWidth={500}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Tipo *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["IN", "OUT", "RETURN", "ADJUST"].map((t) => {
              const s = TYPE_CFG[t];
              const active = form.movement_type === t;
              return (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, movement_type: t })}
                  style={{
                    padding: "9px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                    background: active ? s.bg : "white",
                    color: active ? s.color : "#6B7280",
                    border: active ? `2px solid ${s.color}40` : "1.5px solid #E5E7EB",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {s.arrow} {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Material *</label>
          <select value={form.material_id} onChange={(e) => setForm({ ...form, material_id: e.target.value })} style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
            <option value="">Seleccionar material...</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Almacén *</label>
          <select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
            <option value="">Seleccionar almacén...</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Cantidad *</label>
            <input type="number" min="0.01" step="0.01" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
          </div>
          <div>
            <label style={labelStyle}>Referencia</label>
            <input type="text" placeholder="OC-2024-001" value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })} style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Observaciones</label>
          <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
        </div>

        {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "var(--primary)", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Registrando..." : "Registrar movimiento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function MovementsView() {
  const [movements, setMovements] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNewMat, setShowNewMat] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    date_from: daysAgo(30), date_to: today(),
    movement_type: "", warehouse_id: "", material_id: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date_from: filters.date_from, date_to: filters.date_to });
    if (filters.movement_type) params.append("movement_type", filters.movement_type);
    if (filters.warehouse_id) params.append("warehouse_id", filters.warehouse_id);
    const [movRes, matRes, whRes] = await Promise.allSettled([
      apiFetch(`/logistics/stock-movements/history?${params}`),
      apiFetch("/logistics/materials"),
      apiFetch("/logistics/warehouses"),
    ]);
    if (movRes.status === "fulfilled") setMovements(movRes.value);
    else setError("Error al cargar historial");
    if (matRes.status === "fulfilled") setMaterials(matRes.value);
    if (whRes.status === "fulfilled") setWarehouses(whRes.value);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const kpis = movements.reduce(
    (acc, m) => {
      if (m.movement_type === "IN" || m.movement_type === "RETURN") acc.inbound += m.quantity;
      else if (m.movement_type === "OUT") acc.outbound += m.quantity;
      acc.total += 1;
      return acc;
    },
    { total: 0, inbound: 0, outbound: 0 }
  );

  return (
    <Layout>
      {showNew && (
        <NewMovementModal
          materials={materials} warehouses={warehouses}
          onClose={() => setShowNew(false)}
          onSuccess={() => { setShowNew(false); load(); }}
        />
      )}
      {showNewMat && (
        <NewMaterialWithStockModal
          warehouses={warehouses}
          existingMaterials={materials}
          onClose={() => setShowNewMat(false)}
          onSuccess={() => { setShowNewMat(false); load(); }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Movimientos de Stock
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Kardex — historial de entradas y salidas</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowNewMat(true)}
              style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "var(--primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer" }}
              title="Registra el material en el catálogo e ingresa el stock inicial al almacén"
            >
              + Nuevo material
            </button>
            <button
              onClick={() => setShowNew(true)}
              style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "var(--primary)", color: "white", border: "none", borderRadius: 9, cursor: "pointer" }}
            >
              + Registrar movimiento
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Movimientos", value: kpis.total, color: "#374151", bg: "#F9FAFB", border: "var(--primary)" },
            { label: "Unidades ingresadas", value: kpis.inbound.toLocaleString(), color: "#166534", bg: "#F0FDF4", border: "#16A34A" },
            { label: "Unidades salidas", value: kpis.outbound.toLocaleString(), color: "#991B1B", bg: "#FEF2F2", border: "#DC2626" },
          ].map((k) => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: "16px 20px", borderLeft: `4px solid ${k.border}` }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 20px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Filtros</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            {[
              { label: "Desde", key: "date_from", type: "date" },
              { label: "Hasta", key: "date_to", type: "date" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>{label}</label>
                <input type={type} value={filters[key]}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                  style={{ ...inputStyle, fontSize: 12 }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"} />
              </div>
            ))}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Tipo</label>
              <select value={filters.movement_type} onChange={(e) => setFilters({ ...filters, movement_type: e.target.value })}
                style={{ ...inputStyle, fontSize: 12 }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
                <option value="">Todos</option>
                {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Almacén</label>
              <select value={filters.warehouse_id} onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })}
                style={{ ...inputStyle, fontSize: 12 }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}>
                <option value="">Todos</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
              </select>
            </div>
            <div>
              <button onClick={load} disabled={loading}
                style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "var(--primary)", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                {loading ? "..." : "Aplicar"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{error}</div>
        )}

        {/* Tabla */}
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 110px 1fr 80px 100px 100px 110px 110px", gap: 8, padding: "12px 20px", background: "var(--primary)" }}>
            {["Fecha", "Tipo", "Material", "Cant.", "Origen", "Destino", "Referencia", "Registrado por"].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando movimientos...</div>
          ) : movements.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Sin movimientos en el período seleccionado.</div>
          ) : (
            <div>
              {movements.map((m, idx) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid", gridTemplateColumns: "140px 110px 1fr 80px 100px 100px 110px 110px",
                    gap: 8, padding: "12px 20px", alignItems: "center",
                    borderBottom: idx < movements.length - 1 ? "1px solid #F3F4F6" : "none",
                    background: idx % 2 === 0 ? "white" : "#FAFAFA",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-soft)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#FAFAFA"}
                >
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace", whiteSpace: "nowrap" }}>{fmt(m.created_at)}</div>
                  <div><TypeBadge type={m.movement_type} /></div>
                  <div>
                    <p style={{ fontWeight: 600, color: "#111827", fontSize: 13, margin: 0 }}>{m.material_name}</p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace", margin: "2px 0 0" }}>{m.material_code}</p>
                  </div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: (m.movement_type === "OUT") ? "#DC2626" : "#16A34A" }}>
                    {m.movement_type === "OUT" ? `-${m.quantity}` : `+${m.quantity}`}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{m.from_warehouse || "—"}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{m.to_warehouse || "—"}</div>
                  <div style={{ fontSize: 11, color: "#374151", fontFamily: "monospace" }}>{m.reference || "—"}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{m.created_by || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>{movements.length} movimientos</p>
        )}
      </div>
    </Layout>
  );
}
