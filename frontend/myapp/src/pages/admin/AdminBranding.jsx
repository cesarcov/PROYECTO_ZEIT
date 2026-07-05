import { useEffect, useState, useMemo } from "react";
import Layout from "../../components/Layout";
import { apiFetch, BASE_URL as BASE } from "../../services/api";
import { loadBrandFromServer } from "../../branding/brand";
import { inyectarTokensBranding } from "../../theme/ThemeProvider";

const LOGO_VARIANTS = [
  { key: "claro",   label: "Logo (fondo claro)" },
  { key: "oscuro",  label: "Logo (fondo oscuro)" },
  { key: "isotipo", label: "Isotipo (símbolo)" },
  { key: "favicon", label: "Favicon (pestaña)" },
];

const ZEIT_DEFAULTS = {
  color_primario:         "#003A8C",
  color_acento:           "#00D4D8",
  color_accion:           "#FF6B00",
  color_texto_secundario: "#5A6573",
};

const card = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 14, padding: 20, marginBottom: 18,
};
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "var(--surface-2)", color: "var(--text)", boxSizing: "border-box" };

// WCAG 2.1 relative luminance helpers
function linearize(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hexToLuminance(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function checkContrast(fgHex, bgHex) {
  const L1 = hexToLuminance(fgHex);
  const L2 = hexToLuminance(bgHex);
  if (L1 === null || L2 === null) return null;
  const Lmax = Math.max(L1, L2);
  const Lmin = Math.min(L1, L2);
  const ratio = (Lmax + 0.05) / (Lmin + 0.05);
  return { ratio: Math.round(ratio * 10) / 10, passes: ratio >= 4.5 };
}

function getThemeBg() {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#F4F6FA";
  } catch {
    return "#F4F6FA";
  }
}

function ContrastBadge({ fg, bg }) {
  const result = useMemo(() => checkContrast(fg, bg), [fg, bg]);
  if (!result) return null;
  const color = result.passes ? "#16A34A" : "#DC2626";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, display: "block", marginTop: 4 }}>
      {result.ratio}:1 {result.passes ? "✓ OK" : "✗ Insuficiente (mín 4.5:1)"}
    </span>
  );
}

export default function AdminBranding() {
  const [form, setForm] = useState(null);
  const [logos, setLogos] = useState({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [themeBg, setThemeBg] = useState("#F4F6FA");

  useEffect(() => {
    setThemeBg(getThemeBg());
  }, []);

  const cargar = () => {
    apiFetch("/branding").then((b) => {
      setForm({
        nombre_producto:         b.appName || "",
        eslogan:                 b.tagline || "",
        logo_incluye_nombre:     b.logoIncluyeNombre !== false,
        color_primario:          b.colors?.primary || "",
        color_acento:            b.colors?.accent || "",
        color_accion:            b.colors?.action || "",
        color_texto_secundario:  b.colors?.textSecondary || "",
      });
      setLogos(b.logos || {});
    });
  };
  useEffect(cargar, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const contrastErrors = useMemo(() => {
    if (!form) return [];
    const errs = [];
    const pairs = [
      { label: "Primario sobre blanco", fg: form.color_primario, bg: "#FFFFFF" },
      { label: "Texto Secundario sobre fondo del tema", fg: form.color_texto_secundario, bg: themeBg },
    ];
    for (const { label, fg, bg } of pairs) {
      if (!fg) continue;
      const r = checkContrast(fg, bg);
      if (r && !r.passes) errs.push(`${label}: ${r.ratio}:1 (mín 4.5:1)`);
    }
    return errs;
  }, [form, themeBg]);

  const guardar = async () => {
    if (contrastErrors.length > 0) return;
    setSaving(true); setMsg("");
    try {
      const saved = await apiFetch("/branding", { method: "PUT", body: JSON.stringify(form) });
      if (saved?.colors) inyectarTokensBranding(saved.colors);
      await loadBrandFromServer();
      setMsg("✓ Guardado. Recargá la página para verlo en toda la app.");
    } catch (e) {
      setMsg("✗ " + (e.message || "Error al guardar"));
    } finally { setSaving(false); }
  };

  const restaurarZEIT = async () => {
    setSaving(true); setMsg("");
    try {
      const updated = { ...form, ...ZEIT_DEFAULTS };
      const saved = await apiFetch("/branding", { method: "PUT", body: JSON.stringify(updated) });
      if (saved?.colors) inyectarTokensBranding(saved.colors);
      await loadBrandFromServer();
      setForm(updated);
      setMsg("✓ Paleta corporativa ZEIT restaurada.");
    } catch (e) {
      setMsg("✗ " + (e.message || "Error al restaurar"));
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

  const coloresConfig = [
    { k: "color_primario",         l: "Primario",         d: ZEIT_DEFAULTS.color_primario,         contrastBg: "#FFFFFF",  contrastLabel: "sobre blanco" },
    { k: "color_acento",           l: "Acento",           d: ZEIT_DEFAULTS.color_acento,           contrastBg: null },
    { k: "color_accion",           l: "Acción",           d: ZEIT_DEFAULTS.color_accion,           contrastBg: null },
    { k: "color_texto_secundario", l: "Texto Secundario", d: ZEIT_DEFAULTS.color_texto_secundario, contrastBg: themeBg,    contrastLabel: "sobre fondo" },
  ];

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
            <label style={labelStyle}>Nombre del producto</label>
            <input style={inputStyle} value={form.nombre_producto} onChange={set("nombre_producto")} placeholder="ZEIT SOLUTIONS" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Eslogan</label>
            <input style={inputStyle} value={form.eslogan} onChange={set("eslogan")} placeholder="Confiabilidad que impulsa la industria" />
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
            {coloresConfig.map(({ k, l, d, contrastBg, contrastLabel }) => (
              <div key={k}>
                <label style={labelStyle}>{l}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={form[k] || d} onChange={set(k)}
                    style={{ width: 40, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "none", cursor: "pointer" }} />
                  <input style={{ ...inputStyle, width: 110 }} value={form[k]} onChange={set(k)} placeholder={d} />
                </div>
                {contrastBg && form[k] && (
                  <ContrastBadge fg={form[k]} bg={contrastBg} />
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 0" }}>Dejá vacío para usar el color ZEIT por defecto.</p>

          {contrastErrors.length > 0 && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid var(--danger)", borderRadius: 8 }}>
              <strong style={{ fontSize: 12, color: "var(--danger)" }}>Contraste insuficiente — corregí antes de guardar:</strong>
              <ul style={{ margin: "6px 0 0", padding: "0 0 0 16px", fontSize: 12, color: "var(--danger)" }}>
                {contrastErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Logos */}
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Logos (PNG, SVG o JPG · máx 2 MB)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {LOGO_VARIANTS.map(({ key, label: l }) => (
              <div key={key} style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 12 }}>
                <label style={labelStyle}>{l}</label>
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={guardar} disabled={saving || contrastErrors.length > 0}
            style={{ background: contrastErrors.length > 0 ? "var(--text-muted)" : "var(--primary)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: contrastErrors.length > 0 ? "not-allowed" : "pointer", opacity: contrastErrors.length > 0 ? 0.6 : 1 }}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={restaurarZEIT} disabled={saving}
            style={{ background: "transparent", color: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Restaurar valores ZEIT
          </button>
          <button onClick={restablecer} disabled={saving}
            style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Restablecer marca completa
          </button>
        </div>
      </div>
    </Layout>
  );
}
