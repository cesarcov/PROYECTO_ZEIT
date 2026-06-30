import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ZeitLogo from "../components/ZeitLogo";
import { BASE_URL } from "../services/api";

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

const BRAND_VALUES = [
  { icon: "◈", title: "Confiabilidad",       desc: "Continuidad asegurada en sistemas críticos." },
  { icon: "◎", title: "Innovación",          desc: "Tecnología aplicada a la industria real." },
  { icon: "◉", title: "Excelencia Técnica",  desc: "Ingeniería rigurosa en cada proyecto." },
];

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Usuario o contraseña incorrectos");
        return;
      }
      const data = await res.json();
      const { access_token, refresh_token } = data;
      const payload = decodeJwt(access_token);
      const role = payload?.primary_module ?? "operations";
      const modules = payload?.modules ?? [role];
      localStorage.setItem("access_token",  access_token);
      if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("role", role);
      localStorage.setItem("modules", JSON.stringify(modules));
      localStorage.setItem("blocks", JSON.stringify(data.blocks ?? []));
      localStorage.setItem("username", username);
      // Recarga completa para que el ThemeProvider lea el tema guardado en la cuenta.
      window.location.href = "/inicio";
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const fillUser = (u, p) => { setUsername(u); setPassword(p); setError(""); };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "var(--bg)",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
        .login-input:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px rgba(0,58,140,0.18) !important; }
        .login-input { transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .quick-btn:hover { background: var(--surface-2) !important; border-color: var(--border) !important; }
        @media (max-width: 768px) { .login-left { display: none !important; } .login-right { border-radius: 0 !important; } }
      `}</style>

      {/* ── Panel Izquierdo — Marca ──────────────────────────────────────────── */}
      <div className="login-left" style={{
        width: "44%",
        minHeight: "100vh",
        background: "var(--sidebar-bg)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 44px",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Círculos decorativos de fondo */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        {/* Logo + Nombre */}
        <div style={{ animation: "fadeUp 0.6s ease" }}>
          <ZeitLogo width={180} onDark showText tagline />
        </div>

        {/* Valores de marca */}
        <div style={{ animation: "fadeUp 0.7s ease 0.1s both" }}>
          <div style={{
            color: "rgba(184,227,233,0.4)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", marginBottom: 24,
          }}>
            Nuestros pilares
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {BRAND_VALUES.map((v) => (
              <div key={v.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)", fontSize: 16,
                }}>
                  {v.icon}
                </div>
                <div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{v.title}</div>
                  <div style={{ color: "rgba(184,227,233,0.55)", fontSize: 12, lineHeight: 1.5 }}>{v.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer de marca */}
        <div style={{ animation: "fadeUp 0.8s ease 0.2s both" }}>
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 20,
            color: "rgba(255,255,255,0.5)", fontSize: 11,
          }}>
            © 2026 ZEIT Solutions · Powered by <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>CeShark</span> · ERP Engine
          </div>
        </div>
      </div>

      {/* ── Panel Derecho — Formulario ───────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        minHeight: "100vh",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp 0.5s ease" }}>

          {/* Header mobile (logo solo se muestra en móvil cuando el panel izq. está oculto) */}
          <div className="login-mobile-brand" style={{
            display: "none",
            textAlign: "center",
            marginBottom: 28,
          }}>
            <ZeitLogo size={48} onDark={false} showText />
          </div>

          {/* Bienvenida */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em" }}>
              Bienvenido
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Card del formulario */}
          <div style={{
            background: "var(--surface)",
            borderRadius: 20,
            boxShadow: "0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)",
            border: "1px solid var(--border)",
            padding: "28px 28px 24px",
            marginBottom: 16,
          }}>
            <form onSubmit={handleSubmit}>
              {/* Usuario */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 700,
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.08em", marginBottom: 6,
                }}>Usuario o Correo</label>
                <input
                  className="login-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required autoFocus
                  placeholder="Nombre de usuario o correo"
                  style={{
                    width: "100%", padding: "11px 14px",
                    border: "1.5px solid var(--border)", borderRadius: 10,
                    fontSize: 14, color: "var(--text)",
                    background: "var(--surface-2)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Contraseña */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 700,
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.08em", marginBottom: 6,
                }}>Contraseña</label>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: "100%", padding: "11px 14px",
                    border: "1.5px solid var(--border)", borderRadius: 10,
                    fontSize: 14, color: "var(--text)",
                    background: "var(--surface-2)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  borderRadius: 10, padding: "10px 14px",
                  color: "#DC2626", fontSize: 13,
                  marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 15 }}>⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botón principal */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "13px 0",
                  background: loading
                    ? "var(--text-muted)"
                    : "linear-gradient(135deg, var(--primary) 0%, #0050C8 100%)",
                  color: "var(--primary-contrast)",
                  fontSize: 14, fontWeight: 700,
                  border: "none", borderRadius: 10,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(0,58,140,0.35)",
                  transition: "opacity 0.15s, box-shadow 0.15s",
                  letterSpacing: "0.01em",
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{
                      width: 14, height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                    }} />
                    Verificando...
                  </span>
                ) : "Ingresar al sistema →"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
