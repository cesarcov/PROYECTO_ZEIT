import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { useAuth, formatUsername } from "../../hooks/useAuth";

const MODULE_META = {
  admin:      { label: "Administración", icon: "🛡", color: "#7C3AED", bg: "#F5F3FF" },
  logistics:  { label: "Logística",      icon: "📦", color: "#0369A1", bg: "#F0F9FF" },
  requests:   { label: "Solicitudes",    icon: "📋", color: "#059669", bg: "#F0FDF4" },
  operations: { label: "Operaciones",    icon: "⚙",  color: "#D97706", bg: "#FFFBEB" },
  reporting:  { label: "Reportes",       icon: "📈", color: "#DB2777", bg: "#FDF2F8" },
  inventory:  { label: "Inventario",     icon: "🗄",  color: "#4F7C82", bg: "#F0FDFA" },
};

function groupByModule(permissions) {
  return permissions.reduce((acc, p) => {
    const key = p.code.split(":")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
}

// ── Modal: nuevo rol ──────────────────────────────────────────────────────────
function NewRoleModal({ onClose, onSuccess }) {
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true); setError("");
    try {
      await apiFetch("/admin/roles", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      onSuccess();
    } catch (e) { setError(e.message || "Error al crear el rol"); setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Nuevo rol</h3>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>Se creará sin permisos ni usuarios. Asígnalos después.</p>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Ej: Coordinador de Compras"
          style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          onFocus={e => e.target.style.borderColor = "#4F7C82"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
        {error && <p style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "white", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading || !name.trim()}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: !name.trim() ? "#93B1B5" : "#4F7C82", color: "white", border: "none", borderRadius: 8, cursor: (!name.trim() || loading) ? "not-allowed" : "pointer" }}>
            {loading ? "Creando..." : "Crear rol"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: confirmar eliminar rol ─────────────────────────────────────────────
function DeleteRoleModal({ role, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    setLoading(true); setError("");
    try {
      await apiFetch(`/admin/roles/${role.id}`, { method: "DELETE" });
      onSuccess();
    } catch (e) { setError(e.message || "Error al eliminar"); setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>🗑</div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", textAlign: "center", margin: "0 0 8px" }}>Eliminar rol</h3>
        <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 20 }}>
          ¿Eliminar <strong>"{role.name}"</strong>? Esta acción no se puede deshacer.<br />
          El rol debe tener <strong>0 usuarios</strong> asignados.
        </p>
        {error && <p style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "white", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}>Cancelar</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Permisos ─────────────────────────────────────────────────────────────
function PermissionsTab({ allPermissions, editPerms, onChange, saving, selected, onSave, dirty, saveMsg, canManage }) {
  const groups = groupByModule(allPermissions);

  const toggleAll = (groupCodes, allChecked) => {
    if (allChecked) onChange(editPerms.filter(c => !groupCodes.includes(c)));
    else onChange([...new Set([...editPerms, ...groupCodes])]);
  };

  const toggleOne = (code) => {
    onChange(editPerms.includes(code) ? editPerms.filter(c => c !== code) : [...editPerms, code]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Save bar */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>
            <strong style={{ color: "#4F7C82", fontSize: 15 }}>{editPerms.length}</strong> de {allPermissions.length} permisos activos
          </span>
          {!canManage && <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 99, padding: "2px 8px" }}>Solo lectura</span>}
          {canManage && dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#D97706", fontWeight: 700 }}>· Cambios sin guardar</span>}
        </div>
        {canManage && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saveMsg && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, color: saveMsg.ok ? "#16A34A" : "#DC2626", background: saveMsg.ok ? "#F0FDF4" : "#FEF2F2" }}>
                {saveMsg.ok ? "✓ " : "✗ "}{saveMsg.text}
              </span>
            )}
            <button onClick={onSave} disabled={!dirty || saving}
              style={{ padding: "9px 22px", fontSize: 13, fontWeight: 700, background: (!dirty || saving) ? "#E5E7EB" : "#4F7C82", color: (!dirty || saving) ? "#9CA3AF" : "white", border: "none", borderRadius: 8, cursor: (!dirty || saving) ? "not-allowed" : "pointer" }}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#F3F4F6", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "#4F7C82", width: `${allPermissions.length > 0 ? (editPerms.length / allPermissions.length) * 100 : 0}%`, transition: "width 0.3s" }} />
      </div>

      {/* Permission groups — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(groups).map(([key, perms]) => {
            const meta       = MODULE_META[key] || { label: key, icon: "•", color: "#6B7280", bg: "#F9FAFB" };
            const codes      = perms.map(p => p.code);
            const checked    = codes.filter(c => editPerms.includes(c)).length;
            const allChecked = checked === codes.length;
            const [open, setOpen] = [true, () => {}]; // always open — user scrolls

            return (
              <div key={key} style={{ border: `1px solid ${meta.color}30`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                {/* Group header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 22px", background: meta.bg }}>
                  <span style={{ fontSize: 20 }}>{meta.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: meta.color, flex: 1 }}>{meta.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: checked > 0 ? meta.color : "#E5E7EB", color: checked > 0 ? "white" : "#9CA3AF" }}>
                    {checked} / {codes.length}
                  </span>
                  {canManage && <button
                    onClick={() => toggleAll(codes, allChecked)}
                    disabled={saving}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 16px", borderRadius: 8, border: `2px solid ${meta.color}`, background: allChecked ? meta.color : "white", color: allChecked ? "white" : meta.color, cursor: saving ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
                    {allChecked ? "Quitar todos" : "Todos"}
                  </button>}
                </div>

                {/* Items */}
                <div style={{ background: "white" }}>
                  {perms.map((p, idx) => {
                    const isChecked = editPerms.includes(p.code);
                    return (
                      <div key={p.code}
                        onClick={() => canManage && !saving && toggleOne(p.code)}
                        style={{
                          display: "flex", alignItems: "center", gap: 18,
                          padding: "20px 24px",
                          borderTop: `1px solid ${idx === 0 ? meta.color + "20" : "#F0F0F0"}`,
                          background: isChecked ? meta.bg : "white",
                          cursor: canManage && !saving ? "pointer" : "default",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={e => { if (!isChecked && canManage && !saving) e.currentTarget.style.background = "#F9FAFB"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isChecked ? meta.bg : "white"; }}>

                        {/* Checkbox */}
                        <div style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          border: `2.5px solid ${isChecked ? meta.color : "#D1D5DB"}`,
                          background: isChecked ? meta.color : "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                          boxShadow: isChecked ? `0 0 0 3px ${meta.color}25` : "none",
                        }}>
                          {isChecked && <span style={{ color: "white", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>

                        {/* Texto */}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: isChecked ? meta.color : "#111827", margin: 0 }}>
                            {p.code}
                          </p>
                          {p.description && (
                            <p style={{ fontSize: 13, color: "#6B7280", margin: "6px 0 0", lineHeight: 1.6 }}>
                              {p.description}
                            </p>
                          )}
                        </div>

                        {isChecked && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: meta.color + "18", color: meta.color, flexShrink: 0, letterSpacing: "0.05em" }}>
                            ACTIVO
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Usuarios ─────────────────────────────────────────────────────────────
function UsersTab({ role, allUsers, canManage }) {
  const [roleUsers, setRoleUsers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError]         = useState("");
  const [removing, setRemoving]   = useState(null);

  const MAX = role?.name === "Administrador Maestro" ? 2 : Infinity;

  const load = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/roles/${role.id}/users`);
      setRoleUsers(Array.isArray(data) ? data : []);
    } catch { setRoleUsers([]); }
    finally { setLoading(false); }
  }, [role?.id]);

  useEffect(() => { load(); }, [load]);

  const addUser = async () => {
    if (!selectedUserId) return;
    setError("");
    try {
      await apiFetch(`/admin/roles/${role.id}/users/${selectedUserId}`, { method: "POST" });
      setSelectedUserId("");
      await load();
    } catch (e) { setError(e.message || "Error al agregar"); }
  };

  const removeUser = async (userId) => {
    setRemoving(userId);
    try {
      await apiFetch(`/admin/roles/${role.id}/users/${userId}`, { method: "DELETE" });
      await load();
    } catch (e) { setError(e.message || "Error al quitar"); }
    finally { setRemoving(null); }
  };

  const alreadyInRole = new Set(roleUsers.map(u => u.id));
  const available     = allUsers.filter(u => !alreadyInRole.has(u.id));
  const atLimit       = roleUsers.length >= MAX;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24, gap: 20, overflowY: "auto" }}>

      {/* Header info */}
      <div style={{ background: "#0B2E33", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#93B1B5", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Usuarios asignados a este rol</p>
          <p style={{ color: "white", fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1 }}>{roleUsers.length}</p>
        </div>
        {role?.name === "Administrador Maestro" && (
          <div style={{ background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.4)", borderRadius: 10, padding: "10px 14px", maxWidth: 240 }}>
            <p style={{ color: "#FCD34D", fontSize: 12, fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
              ⚠ Máximo 2 usuarios<br />
              <span style={{ fontWeight: 400, opacity: 0.8 }}>Este rol es de alto privilegio.</span>
            </p>
          </div>
        )}
      </div>

      {/* Agregar usuario */}
      {canManage && !atLimit && (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>Agregar usuario a este rol</p>
          <div style={{ display: "flex", gap: 10 }}>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
              style={{ flex: 1, border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", background: "white" }}>
              <option value="">— Selecciona un usuario —</option>
              {available.map(u => (
                <option key={u.id} value={u.id}>{formatUsername(u.username)} ({u.email})</option>
              ))}
            </select>
            <button onClick={addUser} disabled={!selectedUserId}
              style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: selectedUserId ? "#4F7C82" : "#E5E7EB", color: selectedUserId ? "white" : "#9CA3AF", border: "none", borderRadius: 8, cursor: selectedUserId ? "pointer" : "not-allowed" }}>
              + Agregar
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", padding: "8px 12px", borderRadius: 8, margin: "10px 0 0" }}>{error}</p>}
          {available.length === 0 && (
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: "10px 0 0" }}>Todos los usuarios ya tienen este rol asignado.</p>
          )}
        </div>
      )}

      {atLimit && role?.name === "Administrador Maestro" && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px" }}>
          <p style={{ fontSize: 13, color: "#991B1B", fontWeight: 600, margin: 0 }}>Límite alcanzado — máximo 2 Administradores Maestros.</p>
        </div>
      )}

      {/* Lista de usuarios */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontSize: 13 }}>Cargando usuarios...</div>
      ) : roleUsers.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
          <p style={{ fontWeight: 700, color: "#374151", margin: "0 0 4px" }}>Sin usuarios asignados</p>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Agrega usuarios usando el selector de arriba.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {roleUsers.map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "white", border: "1px solid #E5E7EB", borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#4F7C82", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "white", fontSize: 16, fontWeight: 800 }}>{u.username.charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{formatUsername(u.username)}</p>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: "3px 0 0" }}>{u.email}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: u.is_active ? "#DCFCE7" : "#F3F4F6", color: u.is_active ? "#166534" : "#6B7280" }}>
                {u.is_active ? "Activo" : "Inactivo"}
              </span>
              {canManage && (
                <button onClick={() => removeUser(u.id)} disabled={removing === u.id}
                  style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: removing === u.id ? "#F3F4F6" : "#FEF2F2", color: removing === u.id ? "#9CA3AF" : "#DC2626", border: `1px solid ${removing === u.id ? "#E5E7EB" : "#FECACA"}`, borderRadius: 8, cursor: removing === u.id ? "not-allowed" : "pointer" }}>
                  {removing === u.id ? "Quitando..." : "Quitar"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminRoles() {
  const { canExact, role } = useAuth();
  const canManage = canExact("admin:users");
  const isMaster = role === "admin";

  const [roles, setRoles]             = useState([]);
  const [allPermissions, setAllPerms] = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [editPerms, setEditPerms]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [dirty, setDirty]             = useState(false);
  const [saveMsg, setSaveMsg]         = useState(null);
  const [activeTab, setActiveTab]     = useState("perms");
  const [showNewRole, setShowNewRole] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, permsRes, usersRes] = await Promise.allSettled([
      apiFetch("/admin/roles"),
      apiFetch("/admin/permissions"),
      apiFetch("/admin/users"),
    ]);
    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value);
    if (permsRes.status === "fulfilled") setAllPerms(permsRes.value);
    if (usersRes.status === "fulfilled") setAllUsers(usersRes.value);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectRole = async (role) => {
    setSaveMsg(null); setDirty(false);
    try {
      const data = await apiFetch(`/admin/roles/${role.id}`);
      setSelected(data); setEditPerms(data.permissions || []);
    } catch { setSelected({ ...role, permissions: [] }); setEditPerms([]); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true); setSaveMsg(null);
    try {
      await apiFetch(`/admin/roles/${selected.id}/permissions`, {
        method: "PUT", body: JSON.stringify({ permission_codes: editPerms }),
      });
      setSaveMsg({ ok: true, text: "Guardado correctamente" }); setDirty(false);
    } catch (e) { setSaveMsg({ ok: false, text: e.message || "Error" }); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key: "perms", label: "Permisos" },
    { key: "users", label: "Usuarios" },
  ];

  return (
    <Layout>
      {showNewRole && (
        <NewRoleModal onClose={() => setShowNewRole(false)} onSuccess={() => { setShowNewRole(false); load(); }} />
      )}
      {isMaster && deleteTarget && (
        <DeleteRoleModal role={deleteTarget} onClose={() => setDeleteTarget(null)}
          onSuccess={() => { setDeleteTarget(null); setSelected(null); load(); }} />
      )}

      {/* Page layout: flex row, full viewport height minus layout padding */}
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)" }}>

        {/* ── Sidebar: lista de roles ── */}
        <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", background: "#0B2E33", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#93B1B5", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Roles · {roles.length}</p>
            {canManage && <button onClick={() => setShowNewRole(true)}
              style={{ fontSize: 18, color: "#B8E3E9", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>+</button>}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando...</div>
            ) : roles.map((r) => {
              const isActive = selected?.id === r.id;
              return (
                <div key={r.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #F9FAFB", background: isActive ? "rgba(184,227,233,0.18)" : "white", cursor: "pointer", transition: "background 0.12s" }}
                  onClick={() => { selectRole(r); setActiveTab("perms"); }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "white"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: isActive ? "#4F7C82" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? "white" : "#9CA3AF", textTransform: "uppercase" }}>{r.name.charAt(0)}</span>
                  </div>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#0B2E33" : "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                  {isActive && isMaster && (
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(r); }}
                      title="Eliminar rol"
                      style={{ fontSize: 13, color: "#EF4444", background: "#FEF2F2", border: "none", borderRadius: 6, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      🗑
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {canManage && (
            <div style={{ padding: "12px 14px", borderTop: "1px solid #F3F4F6" }}>
              <button onClick={() => setShowNewRole(true)}
                style={{ width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 700, background: "#4F7C82", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
                + Nuevo rol
              </button>
            </div>
          )}
        </div>

        {/* ── Panel principal ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🛡</div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#374151", margin: "0 0 8px" }}>Selecciona un rol</p>
              <p style={{ fontSize: 14, color: "#9CA3AF", margin: 0, textAlign: "center", maxWidth: 300 }}>
                Haz clic en cualquier rol de la lista para ver y editar sus permisos y usuarios asignados
              </p>
            </div>
          ) : (
            <>
              {/* Role header */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0B2E33", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>{selected.name.charAt(0).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>{selected.name}</h2>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: "3px 0 0" }}>
                    {editPerms.length} de {allPermissions.length} permisos activos
                  </p>
                </div>

                {/* Tab switcher */}
                <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 9, padding: 3, gap: 2 }}>
                  {TABS.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                      style={{ padding: "7px 18px", fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500, borderRadius: 7, border: "none", cursor: "pointer", background: activeTab === t.key ? "#0B2E33" : "transparent", color: activeTab === t.key ? "white" : "#6B7280", transition: "all 0.15s" }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {activeTab === "perms" ? (
                  <PermissionsTab
                    allPermissions={allPermissions}
                    editPerms={editPerms}
                    onChange={p => { setEditPerms(p); setDirty(true); setSaveMsg(null); }}
                    saving={saving}
                    selected={selected}
                    onSave={save}
                    dirty={dirty}
                    saveMsg={saveMsg}
                    canManage={canManage}
                  />
                ) : (
                  <UsersTab role={selected} allUsers={allUsers} canManage={canManage} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
