import { useState, useEffect, useCallback } from "react";

import { BASE_URL as API } from "../../services/api";

function fmtMoney(n) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }).format(n ?? 0);
}

const CATEGORY_COLORS = {
  "EPP":        { bg: "#FEF3C7", color: "#92400E", emoji: "🦺" },
  "Herramienta":{ bg: "#DBEAFE", color: "#1E40AF", emoji: "🔧" },
  "Equipo":     { bg: "#F3E8FF", color: "#6B21A8", emoji: "⚙️" },
  "Consumible": { bg: "#DCFCE7", color: "#166534", emoji: "📦" },
  "Material":   { bg: "#F0FDF4", color: "#15803D", emoji: "🪛" },
  "General":    { bg: "#F1F5F9", color: "#475569", emoji: "📋" },
};
function catStyle(cat) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["General"];
}

// ── Pantalla: lista de grupos ──────────────────────────────────────────────────
function GroupList({ token, onSelect, onCreateNew, onApplied, planId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/operations/material-groups`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setGroups(Array.isArray(d) ? d : []);
    } catch { setGroups([]); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF" }}>Cargando bóvedas...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          <div style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>Sin bóvedas todavía</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Crea grupos de materiales que puedas aplicar de golpe a cualquier proyecto</div>
          <button onClick={onCreateNew} style={btnStyle("var(--primary)")}>+ Crear primera bóveda</button>
        </div>
      ) : (
        groups.map(g => {
          const cs = catStyle(g.category);
          return (
            <div key={g.id} style={{
              background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", gap: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: cs.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {cs.emoji}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    <span style={{ background: cs.bg, color: cs.color, padding: "1px 7px", borderRadius: 10, fontWeight: 600, marginRight: 6 }}>{g.category}</span>
                    {g.item_count} material{g.item_count !== 1 ? "es" : ""}
                  </div>
                  {g.description && <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.description}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onSelect(g)} style={{ ...btnStyle("#F1F5F9", "var(--primary)"), fontSize: 12 }}>
                  Ver / Editar
                </button>
                {planId && (
                  <ApplyButton token={token} planId={planId} groupId={g.id} groupName={g.name} onApplied={onApplied} />
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// Botón de aplicar con estado de carga propio
function ApplyButton({ token, planId, groupId, groupName, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const apply = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/operations/plans/${planId}/apply-group/${groupId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Error");
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      onApplied(d.items_added, groupName);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <button onClick={apply} disabled={loading || done} style={btnStyle(done ? "#22C55E" : "var(--primary)", "#fff", done ? "1px solid #22C55E" : "none")}>
      {loading ? "Aplicando..." : done ? "✓ Aplicado" : "Aplicar al plan"}
    </button>
  );
}

// ── Pantalla: detalle / edición de un grupo ────────────────────────────────────
function GroupDetail({ token, group: initialGroup, onBack, onDeleted, planId, onApplied }) {
  const [group, setGroup] = useState(initialGroup);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(initialGroup.name);
  const [editDesc, setEditDesc] = useState(initialGroup.description ?? "");
  const [editCat, setEditCat] = useState(initialGroup.category ?? "General");
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [showAddMat, setShowAddMat] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoadingItems(true);
    try {
      const r = await fetch(`${API}/operations/material-groups/${group.id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setItems(d.items ?? []);
    } catch { /* silent */ }
    finally { setLoadingItems(false); }
  }, [group.id, token]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const saveHeader = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/operations/material-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null, category: editCat }),
      });
      setGroup(g => ({ ...g, name: editName.trim(), description: editDesc.trim() || null, category: editCat }));
      setEditing(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const removeItem = async (itemId) => {
    await fetch(`${API}/operations/material-groups/${group.id}/items/${itemId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    setItems(its => its.filter(i => i.id !== itemId));
  };

  const deleteGroup = async () => {
    if (!window.confirm(`¿Eliminar la bóveda "${group.name}"? Esta acción no se puede deshacer.`)) return;
    await fetch(`${API}/operations/material-groups/${group.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    onDeleted();
  };

  const cs = catStyle(group.category ?? "General");

  return (
    <div>
      {/* Header del grupo */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: cs.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          {cs.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={inpStyle} placeholder="Nombre del grupo" autoFocus />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select value={editCat} onChange={e => setEditCat(e.target.value)} style={inpStyle}>
                  {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} style={inpStyle} placeholder="Descripción (opcional)" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveHeader} disabled={saving} style={btnStyle("var(--primary)")}>{saving ? "Guardando..." : "Guardar"}</button>
                <button onClick={() => setEditing(false)} style={btnStyle("#F1F5F9", "#374151")}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary)" }}>{group.name}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>
                <span style={{ background: cs.bg, color: cs.color, padding: "1px 7px", borderRadius: 10, fontWeight: 600, marginRight: 6 }}>{group.category}</span>
                {items.length} material{items.length !== 1 ? "es" : ""}
              </div>
              {group.description && <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{group.description}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setEditing(true)} style={{ ...btnStyle("#F1F5F9", "var(--primary)"), fontSize: 12 }}>✏️ Editar</button>
                <button onClick={deleteGroup} style={{ ...btnStyle("#FEF2F2", "#DC2626"), fontSize: 12 }}>🗑️ Eliminar bóveda</button>
                {planId && <ApplyButton token={token} planId={planId} groupId={group.id} groupName={group.name} onApplied={onApplied} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista de materiales del grupo */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Materiales en esta bóveda</span>
          <button onClick={() => setShowAddMat(true)} style={{ ...btnStyle("var(--primary)"), fontSize: 12 }}>+ Agregar material</button>
        </div>

        {loadingItems ? (
          <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 13, background: "#F9FAFB", borderRadius: 8 }}>
            Sin materiales. Agrega al menos uno para poder aplicar esta bóveda.
          </div>
        ) : (
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 36px", background: "var(--primary)", color: "rgba(199,210,229,0.85)", padding: "7px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.5px" }}>
              <span>MATERIAL</span>
              <span style={{ textAlign: "right" }}>CANT.</span>
              <span style={{ textAlign: "right" }}>% DESG.</span>
              <span></span>
            </div>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 36px", padding: "9px 14px", alignItems: "center", background: idx % 2 === 0 ? "#fff" : "#FAFBFC", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#1E293B" }}>{item.material_name}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>{item.material_code} {item.unit_cost != null ? `· ${fmtMoney(item.unit_cost)}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>{item.quantity}</div>
                <div style={{ textAlign: "right", color: "#64748B" }}>{item.wear_percentage}%</div>
                <div style={{ textAlign: "center" }}>
                  <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 15, padding: 3 }}
                    onMouseEnter={e => e.target.style.color = "#EF4444"}
                    onMouseLeave={e => e.target.style.color = "#CBD5E1"}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddMat && (
        <AddMaterialToGroupModal
          token={token}
          groupId={group.id}
          onClose={() => setShowAddMat(false)}
          onAdded={() => { setShowAddMat(false); loadDetail(); }}
        />
      )}
    </div>
  );
}

// ── Modal para agregar material a un grupo ──────────────────────────────────────
function AddMaterialToGroupModal({ token, groupId, onClose, onAdded }) {
  const [materials, setMaterials] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState("1");
  const [wear, setWear] = useState("100");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/logistics/materials`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { const m = Array.isArray(d) ? d.filter(x => x.validation_status !== "PENDING") : []; setMaterials(m); setFiltered(m); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? materials.filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || (m.category ?? "").toLowerCase().includes(q)) : materials);
  }, [search, materials]);

  const submit = async () => {
    if (!selected) return setErr("Selecciona un material");
    const qtyNum = parseFloat(qty);
    if (!qtyNum || qtyNum <= 0) return setErr("Cantidad debe ser mayor a 0");
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${API}/operations/material-groups/${groupId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ material_id: selected.id, quantity: qtyNum, wear_percentage: parseFloat(wear) || 100 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Error");
      onAdded();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 22, width: 500, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h4 style={{ margin: "0 0 12px", color: "var(--primary)" }}>Agregar material a la bóveda</h4>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar material..." style={{ ...inpStyle, marginBottom: 10 }} autoFocus />
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 7, marginBottom: 10, maxHeight: 200 }}>
          {filtered.slice(0, 60).map(m => (
            <div key={m.id} onClick={() => setSelected(m)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F1F5F9", background: selected?.id === m.id ? "#EFF6FF" : "#fff", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>{m.name} <span style={{ fontWeight: 400, color: "#94A3B8", fontSize: 11 }}>{m.code}</span></span>
              {m.category && <span style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{m.category}</span>}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Sin resultados</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#4B5563", display: "block", marginBottom: 3 }}>Cantidad *</label>
            <input type="number" min="0.001" step="any" value={qty} onChange={e => setQty(e.target.value)} style={inpStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#4B5563", display: "block", marginBottom: 3 }}>% Desgaste</label>
            <input type="number" min="0" max="100" step="any" value={wear} onChange={e => setWear(e.target.value)} style={inpStyle} />
          </div>
        </div>
        {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 8px" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnStyle("#F1F5F9", "#374151")}>Cancelar</button>
          <button onClick={submit} disabled={loading || !selected} style={{ ...btnStyle("var(--primary)"), opacity: selected ? 1 : 0.6 }}>{loading ? "Agregando..." : "Agregar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Flujo de creación de nueva bóveda ──────────────────────────────────────────
function CreateGroupFlow({ token, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("General");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim()) return setErr("El nombre es obligatorio");
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${API}/operations/material-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, category: cat }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Error");
      onCreated(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h4 style={{ margin: "0 0 16px", color: "var(--primary)", fontSize: 15 }}>Nueva bóveda de materiales</h4>
      <p style={{ margin: "0 0 14px", color: "#64748B", fontSize: 13 }}>
        Una bóveda es una plantilla de materiales que puedes aplicar de golpe a cualquier proyecto. El contenido del proyecto es independiente — puedes editar cantidades sin afectar la bóveda.
      </p>
      <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Nombre *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder='Ej: Maleta eléctrica estándar' style={{ ...inpStyle, marginBottom: 12 }} autoFocus onKeyDown={e => e.key === "Enter" && submit()} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Categoría</label>
          <select value={cat} onChange={e => setCat(e.target.value)} style={inpStyle}>
            {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#4B5563", display: "block", marginBottom: 4 }}>Descripción (opcional)</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Kit básico de mantenimiento" style={inpStyle} />
        </div>
      </div>
      {err && <p style={{ color: "#DC2626", fontSize: 12, margin: "0 0 10px" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnStyle("#F1F5F9", "#374151")}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={btnStyle("var(--primary)")}>{loading ? "Creando..." : "Crear bóveda"}</button>
      </div>
    </div>
  );
}

// ── Estilos compartidos ────────────────────────────────────────────────────────
const inpStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 7,
  border: "1px solid #D1D5DB", fontSize: 13,
  boxSizing: "border-box",
};

function btnStyle(bg = "var(--primary)", color = "#fff", border = "none") {
  return {
    padding: "7px 16px", borderRadius: 7, border, background: bg,
    color, cursor: "pointer", fontWeight: 600, fontSize: 13,
    whiteSpace: "nowrap",
  };
}

// ── Modal principal ────────────────────────────────────────────────────────────
export default function MaterialGroupsModal({ token, planId, onClose, onApplied }) {
  // screen: "list" | "detail" | "create"
  const [screen, setScreen] = useState("list");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [listKey, setListKey] = useState(0); // para forzar reload de la lista

  const handleApplied = (itemCount, groupName) => {
    onApplied(itemCount, groupName);
  };

  const handleGroupDeleted = () => {
    setScreen("list");
    setSelectedGroup(null);
    setListKey(k => k + 1);
  };

  const handleGroupCreated = (newGroup) => {
    setSelectedGroup(newGroup);
    setScreen("detail");
    setListKey(k => k + 1);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: 640, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, var(--primary-dark), var(--primary))", padding: "18px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "rgba(199,210,229,0.85)", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px" }}>BÓVEDAS DE MATERIALES</div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginTop: 2 }}>
                {screen === "list" ? "Grupos predefinidos" : screen === "create" ? "Nueva bóveda" : selectedGroup?.name}
              </div>
              {screen === "detail" && (
                <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 2 }}>
                  Edita la bóveda o aplícala a este proyecto — los cambios en el plan no afectan la bóveda
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "rgba(199,210,229,0.85)", cursor: "pointer", padding: "6px 12px", fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>

          {/* Breadcrumb */}
          {screen !== "list" && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <button onClick={() => { setScreen("list"); setSelectedGroup(null); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, color: "rgba(199,210,229,0.85)", cursor: "pointer", padding: "3px 10px" }}>
                ← Bóvedas
              </button>
              {screen === "detail" && <span style={{ color: "rgba(255,255,255,0.5)" }}>/ {selectedGroup?.name}</span>}
              {screen === "create" && <span style={{ color: "rgba(255,255,255,0.5)" }}>/ Nueva bóveda</span>}
            </div>
          )}
        </div>

        {/* Actions bar (solo en lista) */}
        {screen === "list" && (
          <div style={{ padding: "12px 24px", borderBottom: "1px solid #F1F5F9", background: "#FAFBFC", flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setScreen("create")} style={btnStyle("var(--primary)")}>+ Nueva bóveda</button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {screen === "list" && (
            <GroupList
              key={listKey}
              token={token}
              planId={planId}
              onSelect={g => { setSelectedGroup(g); setScreen("detail"); }}
              onCreateNew={() => setScreen("create")}
              onApplied={handleApplied}
            />
          )}

          {screen === "detail" && selectedGroup && (
            <GroupDetail
              token={token}
              group={selectedGroup}
              planId={planId}
              onBack={() => { setScreen("list"); setSelectedGroup(null); }}
              onDeleted={handleGroupDeleted}
              onApplied={handleApplied}
            />
          )}

          {screen === "create" && (
            <CreateGroupFlow
              token={token}
              onCreated={handleGroupCreated}
              onCancel={() => setScreen("list")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
