import { useState, useEffect } from "react";
import { useAuth, formatUsername } from "../hooks/useAuth";
import Layout from "../components/Layout";
import { BASE_URL } from "../services/api";

const ROLE_LABELS = {
  admin:      "Administrador",
  logistics:  "Encargado de Logística",
  operations: "Operaciones",
};

const ROLE_COLORS = {
  admin:      { bg: "#EDE9FE", text: "#6D28D9", border: "#C4B5FD" },
  logistics:  { bg: "#CCFBF1", text: "#0F766E", border: "#99F6E4" },
  operations: { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" },
};

const BLOCK_LABELS = {
  logistica:      "Logística",
  operaciones:    "Operaciones",
  administracion: "Administración",
  gerencia:       "Gerencia",
};

function InfoRow({ label, value, mono = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{
        fontSize: 14, fontWeight: 500, color: "#111827",
        fontFamily: mono ? "monospace" : "inherit",
      }}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function Profile() {
  const auth = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const getAvatarSrc = (url) => {
    if (!url) return `${BASE_URL}/avatar-assets/default.png`;
    if (url.startsWith("data:image/")) return url;
    return `${BASE_URL}${url}`;
  };

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const handleSaveName = () => {
    if (!tempName.trim()) return;
    const token = localStorage.getItem("access_token");
    fetch(`${BASE_URL}/auth/me/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ full_name: tempName.trim() }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Error al guardar el nombre");
        return r.json();
      })
      .then((data) => {
        setProfile(prev => prev ? { ...prev, full_name: data.full_name } : { full_name: data.full_name });
        setIsEditingName(false);
      })
      .catch((err) => {
        alert(err.message);
      });
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("El archivo supera el límite de 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setUploading(true);
      const token = localStorage.getItem("access_token");
      fetch(`${BASE_URL}/auth/me/avatar`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ avatar_url: base64 }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Error al subir archivo");
          return r.json();
        })
        .then((data) => {
          setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : { avatar_url: data.avatar_url });
          window.location.reload();
        })
        .catch((err) => {
          alert("Ocurrió un error al subir la foto: " + err.message);
        })
        .finally(() => setUploading(false));
    };
    reader.readAsDataURL(file);
  };

  const roleColors = ROLE_COLORS[auth.role] || ROLE_COLORS.operations;
  const roleLabel  = ROLE_LABELS[auth.role]  || auth.role;

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Encabezado */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", margin: 0, letterSpacing: "-0.02em" }}>
            Mi cuenta
          </h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
            Información de tu perfil y sesión activa
          </p>
        </div>

        {/* Card avatar + identidad */}
        <div style={{
          background: "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)",
          borderRadius: 16, padding: "28px 28px",
          marginBottom: 16, display: "flex", alignItems: "center", gap: 20,
          boxShadow: "0 4px 20px rgba(0,31,84,0.2)",
        }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, flexShrink: 0,
              background: "white", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "3px solid rgba(184,227,233,0.3)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            }}>
              <img 
                src={getAvatarSrc(profile?.avatar_url)} 
                alt="avatar grande" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            </div>
            {/* Input file invisible */}
            <label style={{
              position: "absolute", bottom: -6, right: -6,
              background: "var(--primary)", border: "2px solid white",
              width: 26, height: 26, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              color: "white"
            }} title="Cambiar foto de perfil">
              {uploading ? (
                <span style={{ fontSize: 9, fontWeight: 700 }}>...</span>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/jpg" 
                onChange={handleAvatarUpload} 
                style={{ display: "none" }} 
                disabled={uploading}
              />
            </label>
          </div>
          <div>
            {isEditingName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                    fontSize: 16,
                    fontWeight: 800,
                    borderRadius: 8,
                    padding: "4px 10px",
                    outline: "none",
                    width: "100%",
                    maxWidth: 200,
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  style={{
                    background: "white",
                    color: "var(--primary)",
                    border: "none",
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  style={{
                    background: "transparent",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.5)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  X
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                  {profile?.full_name || formatUsername(auth.username)}
                </h2>
                <button
                  onClick={() => {
                    setTempName(profile?.full_name || formatUsername(auth.username));
                    setIsEditingName(true);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.7)",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Editar nombre de perfil"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/>
                  </svg>
                </button>
              </div>
            )}
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-block",
                background: roleColors.bg, color: roleColors.text,
                border: `1px solid ${roleColors.border}`,
                fontSize: 11, fontWeight: 700,
                padding: "3px 10px", borderRadius: 99,
                letterSpacing: "0.04em",
              }}>
                {roleLabel}
              </span>
              <span style={{ color: "rgba(184,227,233,0.5)", fontSize: 12 }}>· Sesión activa</span>
            </div>
          </div>
        </div>

        {/* Card datos del perfil */}
        <div style={{
          background: "white", borderRadius: 14, border: "1px solid #E5E7EB",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden",
          marginBottom: 16,
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Datos del perfil
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Cargando información...
            </div>
          ) : (
            <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 32px" }}>
              <InfoRow label="Nombre de Perfil" value={profile?.full_name || formatUsername(auth.username)} />
              <InfoRow label="Usuario"       value={profile?.username || auth.username} mono />
              <InfoRow label="Correo"        value={profile?.email} />
              <InfoRow label="Rol"           value={roleLabel} />
              <InfoRow label="ID de usuario" value={profile?.id || auth.userId} mono />
            </div>
          )}
        </div>

        {/* Card bloques de acceso */}
        <div style={{
          background: "white", borderRadius: 14, border: "1px solid #E5E7EB",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden",
          marginBottom: 16,
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Bloques de acceso asignados
            </span>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {profile?.blocks === "all" ? (
              <span style={{
                background: "#EEF2FF", color: "#4F46E5",
                border: "1px solid #C7D2FE",
                fontSize: 12, fontWeight: 700,
                padding: "6px 14px", borderRadius: 8,
              }}>
                🌟 Acceso total (Superadmin)
              </span>
            ) : !profile?.blocks || profile.blocks.length === 0 ? (
              <span style={{ fontSize: 13, color: "#9CA3AF" }}>Sin bloques de acceso asignados</span>
            ) : (
              profile.blocks.map((b) => {
                const label = BLOCK_LABELS[b.slug] || b.slug;
                const isEdit = b.level === "edit";
                return (
                  <div key={b.slug} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: isEdit ? "#EFF6FF" : "#F3F4F6",
                    color: isEdit ? "#1D4ED8" : "#374151",
                    border: isEdit ? "1px solid #BFDBFE" : "1px solid #E5E7EB",
                    padding: "6px 12px", borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    <span>{label}</span>
                    <span style={{
                      background: isEdit ? "#DBEAFE" : "#E5E7EB",
                      color: isEdit ? "#1E40AF" : "#4B5563",
                      fontSize: 10, fontWeight: 700,
                      padding: "2px 6px", borderRadius: 4,
                      textTransform: "uppercase",
                    }}>
                      {isEdit ? "Editar" : "Ver"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card permisos */}
        <div style={{
          background: "white", borderRadius: 14, border: "1px solid #E5E7EB",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden",
          marginBottom: 16,
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Permisos activos
            </span>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {auth.permissions.length === 0 ? (
              <span style={{ fontSize: 13, color: "#9CA3AF" }}>Sin permisos especiales</span>
            ) : auth.permissions.map((p) => (
              <span key={p} style={{
                background: "#F0FDF4", color: "#15803D",
                border: "1px solid #BBF7D0",
                fontSize: 11, fontWeight: 600,
                padding: "4px 10px", borderRadius: 6,
                fontFamily: "monospace",
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Card información de sesión */}
        <div style={{
          background: "white", borderRadius: 14, border: "1px solid #E5E7EB",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden",
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Sesión
            </span>
          </div>
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 32px" }}>
            <InfoRow label="Estado"  value="Activa" />
            <InfoRow label="Sistema" value="CeShark ERP Modular v2.0" />
            <InfoRow label="Módulo"  value={auth.role === "admin" ? "Administración" : auth.role === "logistics" ? "Logística" : "Operaciones"} />
            <InfoRow label="Fecha"   value={new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} />
          </div>
        </div>

      </div>
    </Layout>
  );
}
