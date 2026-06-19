import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CeSharkLogo from "../components/CeSharkLogo";

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

const BRAND_VALUES = [
  { icon: "◈", title: "Liderazgo",  desc: "Siempre al frente, marcando el rumbo." },
  { icon: "◎", title: "Fluidez",    desc: "Procesos que fluyen, resultados que avanzan." },
  { icon: "◉", title: "Confianza",  desc: "Solidez y seguridad en cada decisión." },
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
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Usuario o contraseña incorrectos");
        return;
      }
      const { access_token, refresh_token } = await res.json();
      const payload = decodeJwt(access_token);
      const role = payload?.primary_module ?? "operations";
      const modules = payload?.modules ?? [role];
      localStorage.setItem("access_token",  access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("role", role);
      localStorage.setItem("modules", JSON.stringify(modules));
      localStorage.setItem("username", username);
      navigate("/inicio");
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
      background: "#EEF2F7",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
        .login-input:focus { border-color: #4F7C82 !important; background: white !important; box-shadow: 0 0 0 3px rgba(79,124,130,0.12) !important; }
        .login-input { transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .quick-btn:hover { background: #F0F4F8 !important; border-color: #D1D9E0 !important; }
        @media (max-width: 768px) { .login-left { display: none !important; } .login-right { border-radius: 0 !important; } }
      `}</style>

      {/* ── Panel Izquierdo — Marca ──────────────────────────────────────────── */}
      <div className="login-left" style={{
        width: "44%",
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0B2E33 0%, #0f3d44 50%, #083228 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 44px",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Círculos decorativos de fondo */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(94,194,204,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(94,194,204,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(94,194,204,0.04)", pointerEvents: "none" }} />

        {/* Logo + Nombre */}
        <div style={{ animation: "fadeUp 0.6s ease" }}>
          <CeSharkLogo size={56} onDark showText tagline />
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
                  background: "rgba(94,194,204,0.12)",
                  border: "1px solid rgba(94,194,204,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#5EC2CC", fontSize: 16,
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
            color: "rgba(184,227,233,0.35)",
            fontSize: 11, fontStyle: "italic", lineHeight: 1.6,
          }}>
            "En el océano de los negocios,<br />lidera con <span style={{ color: "#5EC2CC", fontStyle: "normal", fontWeight: 600 }}>CeShark</span>."
          </div>
          <div style={{ color: "rgba(184,227,233,0.2)", fontSize: 10, marginTop: 10 }}>
            © 2026 CeShark · ERP Modular v2.0
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
            <CeSharkLogo size={48} onDark={false} showText />
          </div>

          {/* Bienvenida */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0B2E33", margin: 0, letterSpacing: "-0.03em" }}>
              Bienvenido
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6, marginBottom: 0 }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Card del formulario */}
          <div style={{
            background: "white",
            borderRadius: 20,
            boxShadow: "0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.06)",
            padding: "28px 28px 24px",
            marginBottom: 16,
          }}>
            <form onSubmit={handleSubmit}>
              {/* Usuario */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 700,
                  color: "#6B7280", textTransform: "uppercase",
                  letterSpacing: "0.08em", marginBottom: 6,
                }}>Usuario</label>
                <input
                  className="login-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required autoFocus
                  placeholder="Nombre de usuario"
                  style={{
                    width: "100%", padding: "11px 14px",
                    border: "1.5px solid #E5E7EB", borderRadius: 10,
                    fontSize: 14, color: "#111827",
                    background: "#FAFAFA", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Contraseña */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 700,
                  color: "#6B7280", textTransform: "uppercase",
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
                    border: "1.5px solid #E5E7EB", borderRadius: 10,
                    fontSize: 14, color: "#111827",
                    background: "#FAFAFA", outline: "none",
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
                    ? "#9CA3AF"
                    : "linear-gradient(135deg, #0B2E33 0%, #1a5260 100%)",
                  color: "white",
                  fontSize: 14, fontWeight: 700,
                  border: "none", borderRadius: 10,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(11,46,51,0.3)",
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

          {/* Acceso rápido demo */}
          <div style={{
            background: "white",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            padding: "14px 18px",
          }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: "#9CA3AF",
              textTransform: "uppercase", letterSpacing: "0.1em",
              margin: "0 0 10px",
            }}>
              Acceso rápido · Demo
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
              {[
                { u: "admin",              p: "admin123", r: "Admin Maestro · TI",     color: "#5B21B6" },
                { u: "frank_sonco",        p: "123456",   r: "Gerente General",        color: "#1F2937" },
                { u: "juliet_alvis",       p: "123456",   r: "Administradora · Jefe",  color: "#B45309" },
                { u: "yasmyn_machuca",     p: "123456",   r: "Asistente Admin",        color: "#EA580C" },
                { u: "wilfredo_flores",    p: "123456",   r: "Jefe de Operaciones",    color: "#065F46" },
                { u: "cesar_huamani",      p: "123456",   r: "Jefe Logística / Ing.",  color: "#0B2E33" },
                { u: "tiburoncito_junior", p: "123456",   r: "Asistente Logística",    color: "#4F7C82" },
                { u: "felipe_choque",      p: "123456",   r: "Técnico de Servicios",   color: "#0891B2" },
                { u: "lagartija_segura",   p: "123456",   r: "Ing. de Seguridad",      color: "#16A34A" },
              ].map((user) => (

                <button
                  key={user.u}
                  className="quick-btn"
                  onClick={() => fillUser(user.u, user.p)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 10,
                    border: "1px solid transparent", background: "transparent",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#1F2937" }}>{user.u}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {user.p}</span>
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "white",
                    background: user.color,
                    padding: "3px 8px", borderRadius: 99,
                  }}>
                    {user.r}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
