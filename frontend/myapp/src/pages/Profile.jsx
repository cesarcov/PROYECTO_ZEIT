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

  const roleColors = ROLE_COLORS[auth.role] || ROLE_COLORS.operations;
  const roleLabel  = ROLE_LABELS[auth.role]  || auth.role;

  const initials = auth.username
    ? auth.username.substring(0, 2).toUpperCase()
    : (auth.role?.charAt(0) || "U").toUpperCase();

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Encabezado */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B2E33", margin: 0, letterSpacing: "-0.02em" }}>
            Mi cuenta
          </h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
            Información de tu perfil y sesión activa
          </p>
        </div>

        {/* Card avatar + identidad */}
        <div style={{
          background: "linear-gradient(135deg, #0B2E33 0%, #1a4a52 100%)",
          borderRadius: 16, padding: "28px 28px",
          marginBottom: 16, display: "flex", alignItems: "center", gap: 20,
          boxShadow: "0 4px 20px rgba(11,46,51,0.2)",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, flexShrink: 0,
            background: "linear-gradient(135deg, #4F7C82, #2a5a62)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid rgba(184,227,233,0.3)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}>
            <span style={{ color: "white", fontSize: 26, fontWeight: 900, letterSpacing: "-1px" }}>
              {initials}
            </span>
          </div>
          <div>
            <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              {formatUsername(auth.username)}
            </h2>
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
              <InfoRow label="Usuario"       value={profile?.username || auth.username} mono />
              <InfoRow label="Correo"        value={profile?.email} />
              <InfoRow label="Rol"           value={roleLabel} />
              <InfoRow label="ID de usuario" value={profile?.id || auth.userId} mono />
            </div>
          )}
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
