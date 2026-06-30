import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch } from "../../services/api";
import { useAuth, formatUsername } from "../../hooks/useAuth";

const ROLE_COLORS = {
  admin:              { bg: "#EDE9FE", color: "#6D28D9" },
  logistics_manager:  { bg: "#FEF3C7", color: "#B45309" },
  logistics_operator: { bg: "#FEF9C3", color: "#854D0E" },
  viewer:             { bg: "#CCFBF1", color: "#0F766E" },
};

const MODULE_INFO = {
  admin:          { label: "Admin",          bg: "#EDE9FE", color: "#6D28D9", icon: "🛡" },
  gerente:        { label: "Gerencia",       bg: "#F3F4F6", color: "#1F2937", icon: "👔" },
  logistics:      { label: "Logística",      bg: "#FEF3C7", color: "#B45309", icon: "📦" },
  operations:     { label: "Operaciones",    bg: "#DCFCE7", color: "#065F46", icon: "⚙" },
  administracion: { label: "Administración", bg: "#DBEAFE", color: "#1D4ED8", icon: "📋" },
};

function computeModulesFromRoleNames(roleNames) {
  const modules = [];
  if (roleNames.some(r => r.includes("Maestro"))) modules.push("admin");
  if (roleNames.some(r => r.includes("Gerente General"))) modules.push("gerente");
  if (roleNames.some(r => r.includes("Logístic") || r.includes("Logistic"))) modules.push("logistics");
  if (roleNames.some(r => r.includes("Operacion") || r.includes("Operación") || r.includes("Campo") || r.includes("Supervisor") || r.includes("Ingeniero"))) modules.push("operations");
  if (!modules.includes("admin") && roleNames.some(r =>
    (r.includes("Administrador") && !r.includes("Maestro")) || r.includes("Asistente") || r.includes("Auditor")
  )) modules.push("administracion");
  return modules.length ? modules : ["administracion"];
}

function RoleBadge({ name }) {
  const c = ROLE_COLORS[name] || { bg: "#F3F4F6", color: "#4B5563" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, padding: "3px 8px", borderRadius: 99 }}>
      {name}
    </span>
  );
}

function ModuleBadge({ moduleKey }) {
  const info = MODULE_INFO[moduleKey] || { label: moduleKey, bg: "#F3F4F6", color: "#4B5563", icon: "◻" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, background: info.bg, color: info.color, padding: "3px 9px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10 }}>{info.icon}</span>
      {info.label}
    </span>
  );
}

const inputStyle = {
  width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
  padding: "9px 12px", fontSize: 13, color: "#111827",
  background: "#FAFAFA", outline: "none", boxSizing: "border-box",
};

function CreateUserModal({ roles, onClose, onSuccess }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", role_ids: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleRole = (id) =>
    setForm((prev) => ({
      ...prev,
      role_ids: prev.role_ids.includes(id)
        ? prev.role_ids.filter((r) => r !== id)
        : [...prev.role_ids, id],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.role_ids.length === 0) { setError("Selecciona al menos un rol."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/admin/users", { method: "POST", body: JSON.stringify(form) });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Nuevo usuario" subtitle="Crear cuenta de acceso al sistema" onClose={onClose} maxWidth={460}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { label: "Usuario", key: "username", type: "text", placeholder: "ej: juan.perez" },
          { label: "Correo electrónico", key: "email", type: "email", placeholder: "ej: juan@empresa.com" },
          { label: "Contraseña", key: "password", type: "password", placeholder: "Mínimo 8 caracteres" },
        ].map((f) => (
          <div key={f.key}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {f.label} *
            </label>
            <input
              type={f.type}
              style={inputStyle}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              placeholder={f.placeholder}
              minLength={f.key === "password" ? 8 : undefined}
              required
            />
          </div>
        ))}

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Roles asignados *
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {roles.map((r) => (
              <label
                key={r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${form.role_ids.includes(r.id) ? "#94A3B8" : "#E5E7EB"}`,
                  background: form.role_ids.includes(r.id) ? "rgba(184,227,233,0.15)" : "white",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.role_ids.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{r.name}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            style={{ flex: 1, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditRolesModal({ user, roles, onClose, onSuccess }) {
  const currentRoleIds = roles.filter((r) => (user.roles || []).includes(r.name)).map((r) => r.id);
  const [selected, setSelected] = useState(currentRoleIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleRole = (id) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);

  const selectedRoleNames = roles.filter(r => selected.includes(r.id)).map(r => r.name);
  const previewModules = computeModulesFromRoleNames(selectedRoleNames);

  const handleSave = async () => {
    if (selected.length === 0) { setError("Selecciona al menos un rol."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch(`/admin/users/${user.id}/roles`, { method: "PUT", body: JSON.stringify({ role_ids: selected }) });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Editar roles y módulos" subtitle={`Usuario: ${formatUsername(user.username)}`} onClose={onClose} maxWidth={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {roles.map((r) => (
          <label
            key={r.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: `1.5px solid ${selected.includes(r.id) ? "#94A3B8" : "#E5E7EB"}`,
              background: selected.includes(r.id) ? "rgba(184,227,233,0.15)" : "white",
              transition: "all 0.15s",
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(r.id)}
              onChange={() => toggleRole(r.id)}
              style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{r.name}</span>
          </label>
        ))}

        {/* Preview de módulos accesibles según roles seleccionados */}
        <div style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Módulos accesibles con estos roles
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {previewModules.map(m => <ModuleBadge key={m} moduleKey={m} />)}
          </div>
          {previewModules.length > 1 && (
            <p style={{ fontSize: 11, color: "#6B7280", margin: "8px 0 0" }}>
              Este usuario verá los íconos de acceso rápido a cada módulo en el menú lateral.
            </p>
          )}
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading}
            style={{ flex: 1, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteUserModal({ user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true); setError("");
    try {
      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" });
      onSuccess();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>⚠️</div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", textAlign: "center", margin: "0 0 8px" }}>
          Eliminar usuario
        </h3>
        <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 8, lineHeight: 1.6 }}>
          ¿Estás seguro de eliminar a <strong style={{ color: "#111827" }}>{formatUsername(user.username)}</strong>?
          <br />Esta acción <strong>no se puede deshacer</strong>.
        </p>
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400E" }}>
          Solo se puede eliminar si el usuario no tiene registros en planificación o productividad.
          Si tiene datos, primero reasígnalos o desactívalo.
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading}
            style={{ flex: 1, padding: "10px 0", background: "#DC2626", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true); setError("");
    try {
      await apiFetch(`/admin/users/${user.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Restablecer contraseña" subtitle={`Usuario: ${formatUsername(user.username)}`} onClose={onClose} maxWidth={400}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Nueva contraseña *
          </label>
          <input
            type="password"
            style={inputStyle}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Ingrese la nueva contraseña temporal"
            required
            autoFocus
          />
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "10px 0", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            style={{ flex: 1, padding: "10px 0", background: "var(--primary)", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Guardando..." : "Restablecer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


export default function AdminUsers() {
  const { canExact, role, userId, isSuperadmin } = useAuth();
  const canManage = canExact("admin:users");
  const isMaster = role === "admin";

  const [users, setUsers]         = useState([]);
  const [roles, setRoles]         = useState([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [toast, setToast]         = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState([]);

  const handleImpersonate = async (user) => {
    setImpersonatingId(user.id);
    try {
      const res = await apiFetch(`/admin/users/${user.id}/impersonate`, { method: "POST" });
      const { access_token, refresh_token } = res;
      if (access_token) {
        sessionStorage.setItem("admin_access_token", localStorage.getItem("access_token"));
        sessionStorage.setItem("admin_refresh_token", localStorage.getItem("refresh_token") || "");
        sessionStorage.setItem("admin_username", localStorage.getItem("username") || "");
        
        localStorage.setItem("access_token", access_token);
        if (refresh_token) {
          localStorage.setItem("refresh_token", refresh_token);
        } else {
          localStorage.removeItem("refresh_token");
        }
        localStorage.setItem("username", user.username);
        
        showToast(`Impersonando a ${formatUsername(user.username)}...`);
        setTimeout(() => {
          window.location.href = "/inicio";
        }, 1000);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImpersonatingId(null);
    }
  };


  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.allSettled([
      apiFetch("/admin/users"),
      apiFetch("/admin/roles"),
    ]);
    if (usersRes.status === "fulfilled") setUsers(usersRes.value);
    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleStatus = async (user) => {
    setTogglingId(user.id);
    try {
      await apiFetch(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      showToast(`${formatUsername(user.username)} ${!user.is_active ? "activado" : "desactivado"} correctamente.`);
      loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

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
              Gestión de Usuarios
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              {loading ? "Cargando..." : `${users.length} usuario${users.length !== 1 ? "s" : ""} en el sistema`}
              {!canManage && <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 99, padding: "2px 8px" }}>Solo lectura</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {isSuperadmin && (
              <Link
                to="/superadmin/users"
                style={{ padding: "8px 16px", background: "transparent", color: "var(--primary)", border: "2px solid var(--primary)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              >
                🔐 Gestionar Bloques de Acceso
              </Link>
            )}
            {canManage && (
              <button
                onClick={() => setShowCreate(true)}
                style={{ padding: "8px 18px", background: "var(--primary)", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                Nuevo usuario
              </button>
            )}
          </div>
        </div>

        {/* Buscador */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13, pointerEvents: "none" }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por usuario o correo electrónico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10, border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white" }}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>

        {/* Tabla */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          {loading ? (
            <div style={{ padding: 56, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando usuarios...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              {search ? `Sin resultados para "${search}".` : "No hay usuarios registrados."}
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
                  {["Usuario", "Correo", "Contraseña", "Roles", "Módulos", "Estado", "Acciones"].map((h, i) => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: i === 6 ? "right" : "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #F9FAFB" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#FAFAFA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                  >
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>{u.username.charAt(0)}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{formatUsername(u.username)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "#6B7280" }}>{u.email}</td>
                    <td style={{ padding: "14px 20px", color: "#6B7280" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#9CA3AF" }}>••••••••</span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(u.roles || []).filter(Boolean).length > 0
                          ? (u.roles || []).filter(Boolean).map((r) => <RoleBadge key={r} name={r} />)
                          : <span style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>Sin roles</span>
                        }
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {computeModulesFromRoleNames((u.roles || []).filter(Boolean)).map(m => (
                          <ModuleBadge key={m} moduleKey={m} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                        background: u.is_active ? "#DCFCE7" : "#F3F4F6",
                        color: u.is_active ? "#15803D" : "#6B7280",
                      }}>
                        {u.is_active ? "● Activo" : "○ Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {canManage ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {isMaster && u.id !== userId && (
                            <button
                              onClick={() => handleImpersonate(u)}
                              disabled={impersonatingId === u.id}
                              title="Impersonar usuario (Iniciar sesión como él)"
                              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", fontWeight: 600, cursor: "pointer" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#DBEAFE"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#EFF6FF"}
                            >
                              {impersonatingId === u.id ? "..." : "👤👁️ Impersonar"}
                            </button>
                          )}
                          <button
                            onClick={() => setResettingUser(u)}
                            style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "white", color: "#374151", border: "1px solid #E5E7EB", fontWeight: 600, cursor: "pointer" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                          >
                            Contraseña
                          </button>
                          <button
                            onClick={() => setEditingUser(u)}
                            style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "white", color: "#374151", border: "1px solid #E5E7EB", fontWeight: 600, cursor: "pointer" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                          >
                            Editar roles
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={togglingId === u.id}
                            style={{
                              fontSize: 11, padding: "5px 12px", borderRadius: 7, fontWeight: 600, cursor: togglingId === u.id ? "not-allowed" : "pointer",
                              opacity: togglingId === u.id ? 0.5 : 1,
                              background: u.is_active ? "#FEF2F2" : "#F0FDF4",
                              color: u.is_active ? "#DC2626" : "#15803D",
                              border: `1px solid ${u.is_active ? "#FECACA" : "#BBF7D0"}`,
                            }}
                          >
                            {togglingId === u.id ? "..." : u.is_active ? "Desactivar" : "Activar"}
                          </button>
                          {isMaster && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              title="Eliminar usuario permanentemente"
                              style={{ fontSize: 13, padding: "4px 8px", borderRadius: 7, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", cursor: "pointer", lineHeight: 1 }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#FEE2E2"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#FEF2F2"}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>
            Mostrando {filtered.length} de {users.length} usuarios
          </p>
        )}
      </div>

      {canManage && showCreate && (
        <CreateUserModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); showToast("Usuario creado correctamente."); loadData(); }}
        />
      )}

      {canManage && editingUser && (
        <EditRolesModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSuccess={() => { showToast(`Roles de ${editingUser.username} actualizados.`); setEditingUser(null); loadData(); }}
        />
      )}

      {canManage && resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSuccess={() => { showToast(`Contraseña de ${resettingUser.username} restablecida.`); setResettingUser(null); }}
        />
      )}

      {canManage && isMaster && deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onSuccess={() => {
            showToast(`Usuario ${formatUsername(deletingUser.username)} eliminado permanentemente.`);
            setDeletingUser(null);
            loadData();
          }}
        />
      )}
    </Layout>
  );
}
