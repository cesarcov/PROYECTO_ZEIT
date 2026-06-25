import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { apiFetch, BASE_URL as BASE } from "../../services/api";
import { loadBrandFromServer } from "../../branding/brand";

const LOGO_VARIANTS = [
  { key: "claro",   label: "Logo (fondo claro)" },
  { key: "oscuro",  label: "Logo (fondo oscuro)" },
  { key: "isotipo", label: "Isotipo (símbolo)" },
  { key: "favicon", label: "Favicon (pestaña)" },
];

const card = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 14, padding: 20, marginBottom: 18,
};
const label = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" };
const input = { width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--surface-2)", color: "var(--text)", boxSizing: "border-box" };

export default function AdminBranding() {
  const [form, setForm] = useState(null);
  const [logos, setLogos] = useState({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = () => {
    apiFetch("/branding").then((b) => {
      setForm({
        nombre_producto: b.appName || "",
        eslogan: b.tagline || "",
        logo_incluye_nombre: b.logoIncluyeNombre !== false,
        color_primario: b.colors?.primary || "",
        color_acento: b.colors?.accent || "",
        color_accion: b.colors?.action || "",
      });
      setLogos(b.logos || {});
    });
  };
  useEffect(cargar, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = async () => {
    setSaving(true); setMsg("");
    try {
      await apiFetch("/branding", { method: "PUT", body: JSON.stringify(form) });
      await loadBrandFromServer();
      setMsg("✓ Guardado. Recargá la página para verlo en toda la app.");
    } catch (e) {
      setMsg("✗ " + (e.message || "Error al guardar"));
    } finally { setSaving(false); }
  };

  const subirLogo = async (variant, file) => {
    if (!file) return;
    setMsg("");
    const token = localStorage.getItem("access_token");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${BASE}/branding/logo?variant=${variant}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      await loadBrandFromServer();
      cargar();
      setMsg("✓ Logo actualizado. Recargá para verlo en toda la app.");
    } catch (e) {
      setMsg("✗ " + e.message);
    }
  };

  const restablecer = async () => {
    if (!window.confirm("¿Restablecer la marca a ZEIT por defecto? Se borrarán logo, nombre y colores personalizados.")) return;
    try {
      await apiFetch("/branding", { method: "DELETE" });
      await loadBrandFromServer();
      cargar();
      setMsg("✓ Marca restablecida a ZEIT. Recargá la página.");
    } catch (e) { setMsg("✗ " + e.message); }
  };

  if (!form) return <Layout><div style={{ padding: 24 }}>Cargando…</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Marca del sistema</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 18px" }}>
          Personalizá la identidad del ERP. Estos cambios se aplican para todos los usuarios.
        </p>

        {/* Identidad */}
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Identidad</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Nombre del producto</label>
            <input style={input} value={form.nombre_producto} onChange={set("nombre_producto")} placeholder="ZEIT SOLUTIONS" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Eslogan</label>
            <input style={input} value={form.eslogan} onChange={set("eslogan")} placeholder="Confiabilidad que impulsa la industria" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.logo_incluye_nombre}
              onChange={(e) => setForm((f) => ({ ...f, logo_incluye_nombre: e.target.checked }))} />
            Mi logo ya incluye el nombre (no mostrar el nombre como texto aparte)
          </label>
        </div>

        {/* Colores corporativos */}
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Colores corporativos</h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { k: "color_primario", l: "Primario", d: "#003A8C" },
              { k: "color_acento", l: "Acento", d: "#00D4D8" },
              { k: "color_accion", l: "Acción", d: "#FF6B00" },
            ].map(({ k, l, d }) => (
              <div key={k}>
                <label style={label}>{l}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={form[k] || d} onChange={set(k)}
                    style={{ width: 40, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "none", cursor: "pointer" }} />
                  <input style={{ ...input, width: 110 }} value={form[k]} onChange={set(k)} placeholder={d} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 0" }}>Dejá vacío para usar el color ZEIT por defecto.</p>
        </div>

        {/* Logos */}
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Logos (PNG, SVG o JPG · máx 2 MB)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {LOGO_VARIANTS.map(({ key, label: l }) => (
              <div key={key} style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 12 }}>
                <label style={label}>{l}</label>
                {logos[key] && (
                  <div style={{ background: key === "oscuro" ? "#001F54" : "var(--surface-2)", borderRadius: 6, padding: 8, marginBottom: 8, textAlign: "center" }}>
                    <img src={(logos[key].startsWith("/branding-assets") ? BASE : "") + logos[key]} alt={l} style={{ maxHeight: 40, maxWidth: "100%" }} />
                  </div>
                )}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                  onChange={(e) => subirLogo(key, e.target.files[0])} style={{ fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>

        {msg && <div style={{ margin: "0 0 14px", fontSize: 13, color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)" }}>{msg}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={guardar} disabled={saving}
            style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={restablecer}
            style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Restablecer a ZEIT
          </button>
        </div>
      </div>
    </Layout>
  );
}
