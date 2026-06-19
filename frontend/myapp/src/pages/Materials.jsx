import { useState, useCallback, useEffect } from "react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { apiFetch } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import ExportExcelButton from "../components/ExportExcelButton";

// Categorías sugeridas (no bloqueantes — el usuario puede crear las suyas)
const SUGGESTED_CATEGORIES = [
  "EPP", "Herramienta", "Equipo", "Consumible",
  "Repuesto", "Material", "Instrumento", "Accesorio",
];

// Solo estas muestran la sección de detalles técnicos
const EQUIPMENT_CATS = new Set(["Equipo", "Herramienta", "Instrumento"]);

const PAGE_SIZE = 30;

// Genera array de números de página con "..." para rangos grandes
function getPageNums(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current]);
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) set.add(i);
  const sorted = [...set].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

const CAT_COLORS = {
  EPP:         "bg-blue-100   text-blue-700",
  Herramienta: "bg-orange-100 text-orange-700",
  Equipo:      "bg-purple-100 text-purple-700",
  Consumible:  "bg-green-100  text-green-700",
  Repuesto:    "bg-yellow-100 text-yellow-700",
  Material:    "bg-teal-100   text-teal-700",
  Instrumento: "bg-pink-100   text-pink-700",
  Accesorio:   "bg-indigo-100 text-indigo-700",
};

function CategoryChip({ category }) {
  if (!category) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${CAT_COLORS[category] || "bg-gray-100 text-gray-600"}`}>
      {category}
    </span>
  );
}

// ── Genera código único: 2 chars categoría + 4 chars nombre + 2 dígitos ───────
function generateCode(name, category, existingCodes = []) {
  const clean = (s) =>
    (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim();

  const stopWords = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "y", "e", "o", "a", "en", "con", "para"]);

  // 2 chars de la categoría
  const catPrefix = clean(category || "OT").substring(0, 2).toUpperCase();

  // Hasta 4 chars del nombre (sin stop words)
  const words = clean(name)
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()));

  let namePart;
  if (words.length === 0) {
    namePart = clean(name).substring(0, 4);
  } else if (words.length === 1) {
    namePart = words[0].substring(0, 4);
  } else {
    const take = Math.max(1, Math.ceil(4 / words.length));
    namePart = words.map(w => w.substring(0, take)).join("").substring(0, 4);
  }
  namePart = namePart.toUpperCase();

  const base = (catPrefix + namePart).substring(0, 6); // máx 6 chars base

  // Encontrar el siguiente número libre de 2 dígitos
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}(\\d{1,2})$`);
  const usedNums = existingCodes
    .map(c => { const m = String(c).match(pattern); return m ? parseInt(m[1], 10) : 0; })
    .filter(n => n > 0);

  const next = usedNums.length === 0 ? 1 : Math.max(...usedNums) + 1;
  return base + String(next).padStart(2, "0");
}

// ── Sección visual ─────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4F7C82", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Label con indicador obligatorio / opcional ─────────────────────────────────
function Label({ text, required }) {
  return (
    <label className="block mb-1" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280" }}>
      {text}
      {required
        ? <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>
        : <span style={{ fontSize: 10, fontWeight: 400, color: "#B0B7C3", marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>opcional</span>
      }
    </label>
  );
}

// ── Selector de categoría dinámico ─────────────────────────────────────────────
function CategorySelect({ value, allCategories, onSelect, inputClass }) {
  const knownInList = !value || allCategories.includes(value);
  const [mode, setMode] = useState(knownInList ? "select" : "custom");

  if (mode === "custom") {
    return (
      <div>
        <input
          type="text"
          value={value}
          placeholder="Escribe el nombre de la nueva categoría..."
          onChange={(e) => onSelect(e.target.value)}
          className={inputClass}
          autoFocus
        />
        <button
          type="button"
          onClick={() => { setMode("select"); onSelect(""); }}
          style={{ fontSize: 11, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "4px 0", display: "block", marginTop: 2 }}
        >
          ← Ver categorías sugeridas
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__nueva__") {
          setMode("custom");
          onSelect("");
        } else {
          onSelect(e.target.value);
        }
      }}
      className={inputClass}
    >
      <option value="">Seleccionar categoría...</option>
      {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
      <option disabled>──────────────────</option>
      <option value="__nueva__">+ Nueva categoría personalizada...</option>
    </select>
  );
}

// ── Formulario compartido ──────────────────────────────────────────────────────
function MaterialForm({ form, setForm, codeAuto, setCodeAuto, loading, error, onSubmit, onClose, submitLabel, allCategories, existingCodes }) {
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 transition bg-white";
  const isEquipment = EQUIPMENT_CATS.has(form.category);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setForm(f => ({
      ...f,
      name: newName,
      code: codeAuto ? generateCode(newName, f.category, existingCodes) : f.code,
    }));
  };

  const handleCategoryChange = (newCat) => {
    setForm(f => ({
      ...f,
      category: newCat,
      code: codeAuto ? generateCode(f.name, newCat, existingCodes) : f.code,
    }));
  };

  const handleCodeChange = (e) => {
    setCodeAuto(false);
    setForm(f => ({
      ...f,
      code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").substring(0, 8),
    }));
  };

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 12, color: "#9CA3AF" }}>
        Los campos marcados con <span style={{ color: "#EF4444", fontWeight: 700 }}>*</span> son obligatorios.
      </p>

      {/* ── Identificación ── */}
      <Section title="Identificación">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label text="Nombre" required />
            <input autoFocus type="text" placeholder="Ej: Casco de Seguridad"
              value={form.name} onChange={handleNameChange} className={inp} />
          </div>

          <div>
            <Label text="Código" required />
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="EPCASC01"
                value={form.code}
                onChange={handleCodeChange}
                className={`${inp} font-mono`}
                maxLength={8}
              />
              {codeAuto && form.name && (
                <span style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 10, color: "#9CA3AF", background: "#F3F4F6",
                  padding: "1px 6px", borderRadius: 4, pointerEvents: "none",
                }}>
                  auto
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
              Máx. 8 chars · Se genera del nombre y categoría. Editable.
            </p>
          </div>

          <div>
            <Label text="Stock mínimo" />
            <input type="number" min="0" placeholder="0"
              value={form.min_stock} onChange={set("min_stock")} className={inp} />
          </div>

          <div className="col-span-2">
            <Label text="Categoría" required />
            <CategorySelect
              value={form.category}
              allCategories={allCategories}
              onSelect={handleCategoryChange}
              inputClass={inp}
            />
          </div>
        </div>
      </Section>

      {/* ── Proveedor y costo ── */}
      <Section title="Proveedor y costo">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label text="Marca" />
            <input type="text" placeholder="Ej: 3M, Caterpillar, Bosch"
              value={form.brand} onChange={set("brand")} className={inp} />
          </div>
          <div>
            <Label text="Modelo" />
            <input type="text" placeholder="Ej: V-Gard, 320D"
              value={form.model} onChange={set("model")} className={inp} />
          </div>
          <div className="col-span-2">
            <Label text="Proveedor" />
            <input type="text" placeholder="Nombre de la empresa proveedora"
              value={form.supplier_name} onChange={set("supplier_name")} className={inp} />
          </div>
          <div className="col-span-2">
            <Label text="Contacto del proveedor" />
            <input type="text" placeholder="Nombre, teléfono, email o WhatsApp del vendedor"
              value={form.supplier_contact} onChange={set("supplier_contact")} className={inp} />
          </div>
          <div>
            <Label text="Costo de adquisición (S/)" />
            <input type="number" min="0" step="0.01" placeholder="0.00"
              value={form.unit_cost} onChange={set("unit_cost")} className={inp} />
          </div>
        </div>
      </Section>

      {/* ── Detalles técnicos (solo Equipo/Herramienta/Instrumento) ── */}
      {isEquipment && (
        <Section title={`Detalles técnicos — ${form.category}`}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label text="Número de serie" />
              <input type="text" placeholder="Ej: SN-2024-00123"
                value={form.serial_number} onChange={set("serial_number")}
                className={`${inp} font-mono`} />
            </div>
            <div>
              <Label text="Fecha de compra" />
              <input type="date" value={form.purchase_date} onChange={set("purchase_date")} className={inp} />
            </div>
            <div>
              <Label text="Garantía hasta" />
              <input type="date" value={form.warranty_expires} onChange={set("warranty_expires")} className={inp} />
            </div>
            <div>
              <Label text="Vida útil (años)" />
              <input type="number" min="0" placeholder="Ej: 5"
                value={form.useful_life_years} onChange={set("useful_life_years")} className={inp} />
            </div>
          </div>
        </Section>
      )}

      {/* ── Aliases ── */}
      <Section title="Nombres alternativos">
        <div className="space-y-2">
          {["alias1", "alias2", "alias3"].map((k, i) => (
            <input key={k} type="text" placeholder={`Alias ${i + 1}`}
              value={form[k]} onChange={set(k)}
              className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
          Nombres coloquiales o comerciales con los que también se identifica el producto.
        </p>
      </Section>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
        <button onClick={onClose}
          style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, color: "#374151", background: "white", border: "1.5px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>
          Cancelar
        </button>
        <button onClick={onSubmit} disabled={loading}
          style={{ padding: "9px 26px", fontSize: 13, fontWeight: 700, color: "white", background: loading ? "#93B1B5" : "#0B2E33", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", minWidth: 140, boxShadow: loading ? "none" : "0 2px 8px rgba(11,46,51,0.30)" }}>
          {loading ? "Guardando..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── Helpers de payload / form state ───────────────────────────────────────────
function buildPayload(form) {
  const aliases = [form.alias1, form.alias2, form.alias3].map(a => a.trim()).filter(Boolean);
  return {
    name:              form.name.trim(),
    code:              form.code.trim().toUpperCase(),
    category:          form.category || null,
    min_stock:         form.min_stock ? parseFloat(form.min_stock) : 0,
    aliases,
    brand:             form.brand.trim() || null,
    model:             form.model.trim() || null,
    supplier_name:     form.supplier_name.trim() || null,
    supplier_contact:  form.supplier_contact.trim() || null,
    unit_cost:         form.unit_cost ? parseFloat(form.unit_cost) : null,
    serial_number:     form.serial_number.trim() || null,
    useful_life_years: form.useful_life_years ? parseInt(form.useful_life_years) : null,
    purchase_date:     form.purchase_date || null,
    warranty_expires:  form.warranty_expires || null,
  };
}

function emptyForm() {
  return {
    name: "", code: "", category: "", min_stock: "",
    alias1: "", alias2: "", alias3: "",
    brand: "", model: "",
    supplier_name: "", supplier_contact: "", unit_cost: "",
    serial_number: "", useful_life_years: "", purchase_date: "", warranty_expires: "",
  };
}

function formFromMaterial(m) {
  const aliases = m.aliases || [];
  return {
    name:              m.name || "",
    code:              m.code || "",
    category:          m.category || "",
    min_stock:         m.min_stock ?? "",
    alias1:            aliases[0] || "",
    alias2:            aliases[1] || "",
    alias3:            aliases[2] || "",
    brand:             m.brand || "",
    model:             m.model || "",
    supplier_name:     m.supplier_name || "",
    supplier_contact:  m.supplier_contact || "",
    unit_cost:         m.unit_cost ?? "",
    serial_number:     m.serial_number || "",
    useful_life_years: m.useful_life_years ?? "",
    purchase_date:     m.purchase_date || "",
    warranty_expires:  m.warranty_expires || "",
  };
}

// ── Modal: Crear ──────────────────────────────────────────────────────────────
function CreateModal({ onClose, onSuccess, allCategories, existingCodes }) {
  const [form, setForm]         = useState(emptyForm());
  const [codeAuto, setCodeAuto] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const submit = async () => {
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.code.trim()) { setError("El código es obligatorio"); return; }
    if (!form.category)    { setError("La categoría es obligatoria"); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/logistics/materials", { method: "POST", body: JSON.stringify(buildPayload(form)) });
      onSuccess();
    } catch (e) { setError(e.message || "Error al crear material"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Nuevo Material" subtitle="Complete los datos del catálogo" onClose={onClose} maxWidth={560}>
      <MaterialForm
        form={form} setForm={setForm}
        codeAuto={codeAuto} setCodeAuto={setCodeAuto}
        loading={loading} error={error}
        onSubmit={submit} onClose={onClose}
        submitLabel="Crear material"
        allCategories={allCategories}
        existingCodes={existingCodes}
      />
    </Modal>
  );
}

// ── Modal: Editar ─────────────────────────────────────────────────────────────
function EditModal({ material, onClose, onSuccess, allCategories, existingCodes }) {
  const [form, setForm]         = useState(formFromMaterial(material));
  const [codeAuto, setCodeAuto] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const submit = async () => {
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.code.trim()) { setError("El código es obligatorio"); return; }
    if (!form.category)    { setError("La categoría es obligatoria"); return; }
    setLoading(true); setError("");
    try {
      await apiFetch(`/logistics/materials/${material.id}`, { method: "PUT", body: JSON.stringify(buildPayload(form)) });
      onSuccess();
    } catch (e) { setError(e.message || "Error al actualizar"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Editar Material" subtitle={`${material.code} — ${material.name}`} onClose={onClose} maxWidth={560}>
      <MaterialForm
        form={form} setForm={setForm}
        codeAuto={codeAuto} setCodeAuto={setCodeAuto}
        loading={loading} error={error}
        onSubmit={submit} onClose={onClose}
        submitLabel="Guardar cambios"
        allCategories={allCategories}
        existingCodes={existingCodes.filter(c => c !== material.code)}
      />
    </Modal>
  );
}

// ── Modal: Eliminar ───────────────────────────────────────────────────────────
function DeleteConfirmModal({ material, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const confirm = async () => {
    setLoading(true); setError("");
    try {
      await apiFetch(`/logistics/materials/${material.id}`, { method: "DELETE" });
      onSuccess();
    } catch (e) { setError(e.message || "Error al eliminar"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Eliminar Material" onClose={onClose} maxWidth={420}>
      <div className="space-y-4">
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 16px" }}>
          <p className="text-sm font-semibold text-red-700">¿Seguro que deseas eliminar este material?</p>
          <p className="text-sm text-red-600 mt-1">
            <span className="font-mono font-bold">{material.code}</span> — {material.name}
          </p>
          <p className="text-xs text-red-500 mt-2">Solo es posible si no tiene movimientos de stock registrados.</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, color: "#374151", background: "white", border: "1.5px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={confirm} disabled={loading}
            style={{ padding: "9px 22px", fontSize: 13, fontWeight: 700, color: "white", background: loading ? "#FCA5A5" : "#DC2626", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Panel lateral de detalle ──────────────────────────────────────────────────
function DetailPanel({ material, onClose, onEdit }) {
  if (!material) return null;
  const isEquipment = EQUIPMENT_CATS.has(material.category);

  const Row = ({ label, value }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
        <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, width: 140, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#1F2937", fontWeight: 500 }}>{value}</span>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 340, background: "white", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", zIndex: 40, display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#0B2E33", padding: "20px 20px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: "#93B1B5", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {material.category || "Sin categoría"}
            </p>
            <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 4 }}>{material.name}</p>
            <p style={{ color: "#93B1B5", fontFamily: "monospace", fontSize: 12, marginTop: 2 }}>{material.code}</p>
          </div>
          <button onClick={onClose} style={{ color: "#93B1B5", background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", letterSpacing: "0.08em", marginBottom: 4 }}>Inventario</p>
          <Row label="Stock mínimo" value={material.min_stock > 0 ? `${material.min_stock} u.` : "No definido"} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", letterSpacing: "0.08em", marginBottom: 4 }}>Producto</p>
          <Row label="Marca" value={material.brand} />
          <Row label="Modelo" value={material.model} />
          <Row label="Costo unitario" value={material.unit_cost ? `S/ ${Number(material.unit_cost).toLocaleString("es-PE", { minimumFractionDigits: 2 })}` : null} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", letterSpacing: "0.08em", marginBottom: 4 }}>Proveedor</p>
          <Row label="Empresa" value={material.supplier_name} />
          <Row label="Contacto" value={material.supplier_contact} />
        </div>
        {isEquipment && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", letterSpacing: "0.08em", marginBottom: 4 }}>Detalles técnicos</p>
            <Row label="N° de serie" value={material.serial_number} />
            <Row label="Fecha de compra" value={material.purchase_date} />
            <Row label="Garantía hasta" value={material.warranty_expires} />
            <Row label="Vida útil" value={material.useful_life_years ? `${material.useful_life_years} años` : null} />
          </div>
        )}
        {(material.aliases || []).length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", letterSpacing: "0.08em", marginBottom: 8 }}>Aliases</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {material.aliases.map((a, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", flexShrink: 0 }}>
        <button onClick={() => onEdit(material)}
          style={{ width: "100%", padding: "9px 0", background: "#4F7C82", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Editar este material
        </button>
      </div>
    </div>
  );
}

// ── Modal: Validar material propuesto ─────────────────────────────────────────
function ValidateModal({ material, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name:             material.name,
    category:         material.category || "Material",
    unit_cost:        material.precio_referencia ?? material.unit_cost ?? "",
    supplier_name:    material.proveedor_referencia || "",
    supplier_contact: "",
    brand:            "",
    model:            "",
    logistics_notes:  material.logistics_notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white";

  const submit = async () => {
    if (!form.unit_cost || parseFloat(form.unit_cost) <= 0)
      return setError("Debes confirmar el precio unitario antes de validar");
    setLoading(true); setError("");
    try {
      await apiFetch(`/logistics/materials/${material.id}/validate`, {
        method: "PATCH",
        body: JSON.stringify({
          name:             form.name || undefined,
          category:         form.category || undefined,
          unit_cost:        parseFloat(form.unit_cost),
          supplier_name:    form.supplier_name || undefined,
          supplier_contact: form.supplier_contact || undefined,
          brand:            form.brand || undefined,
          model:            form.model || undefined,
          logistics_notes:  form.logistics_notes || undefined,
        }),
      });
      onSuccess();
    } catch (e) { setError(e.message || "Error al validar"); }
    finally { setLoading(false); }
  };

  const CATS = ["Sin categoría", "EPP", "Herramienta", "Equipo", "Consumible", "Repuesto", "Material", "Instrumento", "Accesorio"];

  return (
    <Modal title="Validar material propuesto" subtitle={`Código: ${material.code} · Propuesto por: ${material.proposed_by || "—"}`} onClose={onClose} maxWidth={500}>
      <div className="space-y-3">
        {/* Context from operations */}
        <div style={{ background: "#EEF7F8", border: "1px solid #B8E3E9", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 20, flexWrap: "wrap" }}>
          {material.precio_referencia && (
            <span style={{ fontSize: 12, color: "#0B2E33" }}>Precio referencial: <strong>S/ {Number(material.precio_referencia).toFixed(2)}</strong></span>
          )}
          {material.proveedor_referencia && (
            <span style={{ fontSize: 12, color: "#0B2E33" }}>Proveedor sugerido: <strong>{material.proveedor_referencia}</strong></span>
          )}
          {material.propuesto_desde && (
            <span style={{ fontSize: 12, color: "#0B2E33" }}>Origen: <strong>{material.propuesto_desde}</strong></span>
          )}
        </div>
        {material.logistics_notes && (
          <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#854D0E", marginBottom: 2 }}>NOTA DEL INGENIERO</p>
            <p style={{ fontSize: 13, color: "#78350F" }}>{material.logistics_notes}</p>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <Label text="Nombre" required />
            <input value={form.name} onChange={set("name")} className={inp} />
          </div>
          <div>
            <Label text="Categoría" required />
            <select value={form.category} onChange={set("category")} className={inp}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label text="Precio unitario confirmado (S/)" required />
          <input type="number" min="0" step="any" value={form.unit_cost} onChange={set("unit_cost")} className={inp}
            placeholder={material.unit_cost ? `Propuesto: S/${material.unit_cost}` : "El ingeniero no indicó precio"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <Label text="Proveedor" />
            <input value={form.supplier_name} onChange={set("supplier_name")} className={inp} placeholder="Nombre empresa" />
          </div>
          <div>
            <Label text="Contacto proveedor" />
            <input value={form.supplier_contact} onChange={set("supplier_contact")} className={inp} placeholder="Teléf. / email" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <Label text="Marca" />
            <input value={form.brand} onChange={set("brand")} className={inp} />
          </div>
          <div>
            <Label text="Modelo" />
            <input value={form.model} onChange={set("model")} className={inp} />
          </div>
        </div>
        <div>
          <Label text="Notas internas de logística" />
          <input value={form.logistics_notes} onChange={set("logistics_notes")} className={inp} placeholder="Observaciones, alternativas, etc." />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
          <button onClick={onClose} style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, color: "#374151", background: "white", border: "1.5px solid #D1D5DB", borderRadius: 8, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} style={{ padding: "9px 22px", fontSize: 13, fontWeight: 700, color: "white", background: loading ? "#93B1B5" : "#4F7C82", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Validando..." : "Validar y publicar al catálogo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Materials() {
  const { can, isAdmin } = useAuth();
  const canEdit     = isAdmin || can("logistics:");
  const canValidate = isAdmin || can("logistics:materials:validate");

  const [tab,       setTab]       = useState("catalog");  // "catalog" | "pending"
  const [materials, setMaterials] = useState([]);
  const [stockMap,  setStockMap]  = useState({});         // material_id → {stock_available, min_stock}
  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showNew,   setShowNew]   = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [deleting,  setDeleting]  = useState(null);
  const [detail,    setDetail]    = useState(null);
  const [validating,setValidating]= useState(null);
  const [page,      setPage]      = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [mats, stock] = await Promise.allSettled([
        apiFetch("/logistics/materials"),
        apiFetch("/logistics/stock/availability"),
      ]);
      if (mats.status  === "fulfilled") setMaterials(mats.value);
      if (stock.status === "fulfilled") {
        const map = {};
        for (const s of (stock.value || [])) {
          if (!map[s.material_id]) map[s.material_id] = { stock_available: 0, min_stock: s.min_stock };
          map[s.material_id].stock_available += (s.stock_available || 0);
          map[s.material_id].min_stock = s.min_stock;
        }
        setStockMap(map);
      }
    }
    catch (e) { setError(e.message || "Error al cargar materiales"); }
    finally { setLoading(false); }
  }, []);

  const loadPending = useCallback(async () => {
    if (!canValidate) return;
    try { setPending(await apiFetch("/logistics/materials/pending")); }
    catch { setPending([]); }
  }, [canValidate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPending(); }, [loadPending]);

  // Resetear a página 1 cuando cambia búsqueda o filtro de categoría
  useEffect(() => { setPage(1); }, [search, catFilter]);

  // Categorías: sugeridas + cualquier categoría personalizada ya registrada en BD
  const allCategories = [
    ...SUGGESTED_CATEGORIES,
    ...new Set(
      materials
        .map(m => m.category)
        .filter(c => c && !SUGGESTED_CATEGORIES.includes(c))
    ),
  ];

  const existingCodes = materials.map(m => m.code);

  const filtered = materials.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.name?.toLowerCase().includes(q) ||
      m.code?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q) ||
      m.brand?.toLowerCase().includes(q) ||
      m.supplier_name?.toLowerCase().includes(q) ||
      (m.aliases || []).some(a => a.toLowerCase().includes(q));
    return matchSearch && (catFilter === "all" || m.category === catFilter);
  });

  const catCounts = materials.reduce((acc, m) => {
    const c = m.category || "Sin categoría";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const presentCats = allCategories.filter(c => catCounts[c]);

  // Paginación — filtered cubre TODOS los materiales para búsqueda global
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const headerCell = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#93B1B5", padding: "10px 14px", textAlign: "left",
  };

  return (
    <Layout>
      {showNew   && <CreateModal onClose={() => setShowNew(false)} onSuccess={() => { setShowNew(false); load(); }} allCategories={allCategories} existingCodes={existingCodes} />}
      {editing   && <EditModal material={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); setDetail(null); load(); }} allCategories={allCategories} existingCodes={existingCodes} />}
      {deleting  && <DeleteConfirmModal material={deleting} onClose={() => setDeleting(null)} onSuccess={() => { setDeleting(null); setDetail(null); load(); }} />}
      {detail    && <DetailPanel material={detail} onClose={() => setDetail(null)} onEdit={(m) => { setDetail(null); setEditing(m); }} />}
      {validating && <ValidateModal material={validating} onClose={() => setValidating(null)} onSuccess={() => { setValidating(null); load(); loadPending(); }} />}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Catálogo de Materiales</h1>
            <p className="text-sm text-gray-500 mt-0.5">{materials.length} materiales registrados</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {canValidate && pending.length > 0 && (
              <button
                onClick={() => setTab(tab === "pending" ? "catalog" : "pending")}
                style={{ display: "flex", alignItems: "center", gap: 7, background: tab === "pending" ? "#FEF9C3" : "#FEF9C3", color: "#854D0E", border: "1.5px solid #FDE68A", padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ⚠ Pendientes de validación
                <span style={{ background: "#EAB308", color: "white", borderRadius: 99, padding: "1px 8px", fontSize: 12 }}>{pending.length}</span>
              </button>
            )}
            <ExportExcelButton url="/logistics/materials/export" filename="materiales.xlsx" />
            {canEdit && tab === "catalog" && (
              <button onClick={() => setShowNew(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#0B2E33", color: "white", padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(11,46,51,0.35)" }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuevo material
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 16px" }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none", fontSize: 14 }}>&#128269;</span>
            <input type="text" placeholder="Buscar por nombre, código, marca, proveedor, alias..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", background: "white", boxSizing: "border-box", color: "#1F2937" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Categoría:</span>
            <button onClick={() => setCatFilter("all")}
              style={{ fontSize: 12, padding: "3px 12px", borderRadius: 99, fontWeight: 700, border: "none", cursor: "pointer", background: catFilter === "all" ? "#0B2E33" : "#E5E7EB", color: catFilter === "all" ? "white" : "#6B7280" }}>
              Todos ({materials.length})
            </button>
            {presentCats.map((c) => {
              const active = catFilter === c;
              return (
                <button key={c} onClick={() => setCatFilter(active ? "all" : c)}
                  className={CAT_COLORS[c] || "bg-gray-100 text-gray-600"}
                  style={{ fontSize: 12, padding: "3px 12px", borderRadius: 99, fontWeight: 700, border: active ? "2px solid currentColor" : "2px solid transparent", cursor: "pointer", opacity: active ? 1 : 0.75 }}>
                  {c} ({catCounts[c]})
                </button>
              );
            })}
            {search && (
              <button onClick={() => setSearch("")}
                style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", marginLeft: "auto", textDecoration: "underline" }}>
                Limpiar ×
              </button>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

        {/* ── Pendientes de validación ─────────────────────────────── */}
        {canValidate && tab === "pending" && (
          <div>
            <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, color: "#854D0E", fontSize: 14 }}>Materiales propuestos por ingenieros de campo</p>
                <p style={{ color: "#92400E", fontSize: 12, marginTop: 2 }}>
                  Estos materiales no existían en el catálogo. Valida el precio y añade el proveedor para que queden disponibles en el sistema.
                </p>
              </div>
              <button onClick={() => setTab("catalog")} style={{ background: "none", border: "1px solid #FDE68A", color: "#854D0E", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                ← Volver al catálogo
              </button>
            </div>

            {pending.length === 0 ? (
              <div style={{ background: "#F9FAFB", borderRadius: 12, padding: 40, textAlign: "center", color: "#9CA3AF" }}>
                No hay materiales pendientes de validación.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {pending.map(m => (
                  <div key={m.id} style={{ background: "white", border: "1px solid #FDE68A", borderLeft: "4px solid #EAB308", borderRadius: 10, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#0B2E33" }}>{m.name}</span>
                        <span style={{ background: "#F3F4F6", color: "#6B7280", fontFamily: "monospace", fontSize: 11, padding: "1px 7px", borderRadius: 6 }}>{m.code}</span>
                        <span style={{ background: "#F0F9FA", color: "#4F7C82", fontSize: 11, padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>{m.category}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B", display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
                        <span>Por: <strong>{m.proposed_by || "—"}</strong></span>
                        {m.propuesto_desde && <span style={{ background: "#E0F2FE", color: "#0369A1", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>{m.propuesto_desde}</span>}
                        {m.precio_referencia != null && (
                          <span>Precio ref.: <strong style={{ color: "#059669" }}>S/ {m.precio_referencia.toFixed(2)}</strong></span>
                        )}
                        {m.proveedor_referencia && (
                          <span>Proveedor sugerido: <strong>{m.proveedor_referencia}</strong></span>
                        )}
                        {m.proposed_at && <span>Fecha: <strong>{new Date(m.proposed_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</strong></span>}
                      </div>
                      {m.logistics_notes && (
                        <p style={{ fontSize: 12, color: "#92400E", marginTop: 6, background: "#FFFBEB", padding: "5px 10px", borderRadius: 6, display: "inline-block" }}>
                          {m.logistics_notes}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setValidating(m)}
                      style={{ marginLeft: 16, padding: "8px 18px", background: "#4F7C82", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Validar precio
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabla — solo visible en tab catálogo */}
        {tab === "catalog" && <>

        {/* Tabla */}
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#0B2E33" }}>
                <th style={{ ...headerCell, width: 44, textAlign: "center" }}>#</th>
                <th style={{ ...headerCell, width: 110 }}>Código</th>
                <th style={headerCell}>Nombre</th>
                <th style={{ ...headerCell, width: 90, textAlign: "center" }}>Estado</th>
                <th style={{ ...headerCell, width: 115 }}>Categoría</th>
                <th style={{ ...headerCell, width: 120 }}>Marca / Modelo</th>
                <th style={{ ...headerCell, width: 140 }}>Proveedor</th>
                <th style={{ ...headerCell, width: 80, textAlign: "center" }}>Costo</th>
                <th style={{ ...headerCell, width: 80, textAlign: "center" }}>Stock mín.</th>
                <th style={{ ...headerCell, width: 90, textAlign: "center" }}>Stock actual</th>
                {canEdit && <th style={{ ...headerCell, width: 110, textAlign: "center" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canEdit ? 11 : 10} className="p-12 text-center text-gray-400 text-sm">Cargando materiales...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canEdit ? 11 : 10} className="p-12 text-center text-gray-400 text-sm">
                  {search || catFilter !== "all" ? "Sin resultados para el filtro aplicado." : "No hay materiales registrados."}
                </td></tr>
              ) : (
                paginated.map((m, idx) => (
                  <tr key={m.id}
                    className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => setDetail(m)}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold inline-flex items-center justify-center">
                        {(safePage - 1) * PAGE_SIZE + idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{m.code}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                      {(m.aliases || []).length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{m.aliases.slice(0, 2).join(", ")}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.estado === "PENDIENTE"
                        ? <span style={{ background: "#FEF9C3", color: "#854D0E", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>PENDIENTE</span>
                        : m.estado === "INACTIVO"
                        ? <span style={{ background: "#F3F4F6", color: "#9CA3AF", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>INACTIVO</span>
                        : <span style={{ background: "#DCFCE7", color: "#166534", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>ACTIVO</span>
                      }
                    </td>
                    <td className="px-3 py-2.5"><CategoryChip category={m.category} /></td>
                    <td className="px-3 py-2.5">
                      {m.brand || m.model ? (
                        <div>
                          {m.brand && <p className="text-xs font-semibold text-gray-700">{m.brand}</p>}
                          {m.model && <p className="text-xs text-gray-400">{m.model}</p>}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {m.supplier_name
                        ? <p className="text-xs text-gray-700 truncate max-w-[130px]" title={m.supplier_name}>{m.supplier_name}</p>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.unit_cost != null
                        ? <span className="text-xs font-mono font-semibold text-gray-700">S/{Number(m.unit_cost).toFixed(2)}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.min_stock > 0
                        ? <span className="font-mono text-sm font-semibold text-gray-800">{m.min_stock}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const s = stockMap[m.id];
                        if (!s) return <span style={{ color: "#D1D5DB", fontSize: 11 }}>—</span>;
                        const qty = s.stock_available;
                        const min = s.min_stock;
                        const isZero = qty <= 0;
                        const isLow  = !isZero && min > 0 && qty <= min;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: isZero ? "#DC2626" : isLow ? "#D97706" : "#166534" }}>
                              {qty}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: isZero ? "#FEE2E2" : isLow ? "#FEF9C3" : "#DCFCE7", color: isZero ? "#DC2626" : isLow ? "#854D0E" : "#166534" }}>
                              {isZero ? "AGOTADO" : isLow ? "BAJO" : "OK"}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                          <button onClick={() => setEditing(m)}
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", color: "#374151", cursor: "pointer", fontWeight: 600 }}>
                            Editar
                          </button>
                          <button onClick={() => setDeleting(m)}
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>
                            ×
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && filtered.length > 0 && (
            <div style={{
              background: "#F9FAFB", borderTop: "1px solid #E5E7EB",
              padding: "10px 16px", display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: 12, flexWrap: "wrap",
            }}>
              {/* Contador */}
              <span style={{ fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}>
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de{" "}
                <strong style={{ color: "#374151" }}>{filtered.length}</strong> materiales
                {filtered.length < materials.length && (
                  <span style={{ color: "#B0B7C3" }}> (filtrado de {materials.length})</span>
                )}
              </span>

              {/* Botones de página */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {/* Anterior */}
                  <button
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                    style={{
                      padding: "4px 10px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: "1px solid #E5E7EB", background: "white",
                      color: safePage === 1 ? "#D1D5DB" : "#374151",
                      cursor: safePage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    ‹
                  </button>

                  {/* Números */}
                  {getPageNums(safePage, totalPages).map((p, i) =>
                    p === "..." ? (
                      <span key={`e${i}`} style={{ fontSize: 12, color: "#9CA3AF", padding: "0 4px" }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{
                          minWidth: 32, padding: "4px 8px", borderRadius: 7,
                          fontSize: 13, fontWeight: p === safePage ? 700 : 500,
                          border: p === safePage ? "none" : "1px solid #E5E7EB",
                          background: p === safePage ? "#0B2E33" : "white",
                          color: p === safePage ? "white" : "#374151",
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </button>
                    )
                  )}

                  {/* Siguiente */}
                  <button
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                    style={{
                      padding: "4px 10px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: "1px solid #E5E7EB", background: "white",
                      color: safePage === totalPages ? "#D1D5DB" : "#374151",
                      cursor: safePage === totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </>}
      </div>
    </Layout>
  );
}
