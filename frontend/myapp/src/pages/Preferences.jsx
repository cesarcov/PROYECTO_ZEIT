import { useState } from "react";
import Layout from "../components/Layout";

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 99, border: "none",
        background: value ? "#4F7C82" : "#D1D5DB",
        position: "relative", cursor: "pointer",
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: value ? "calc(100% - 21px)" : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

function PreferenceRow({ label, desc, value, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0",
      borderBottom: "1px solid #F3F4F6",
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>{desc}</p>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function SelectRow({ label, desc, value, onChange, options }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0",
      borderBottom: "1px solid #F3F4F6",
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>{desc}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "6px 10px", borderRadius: 8,
          border: "1px solid #E5E7EB",
          fontSize: 12, fontWeight: 500, color: "#374151",
          background: "white", cursor: "pointer", outline: "none",
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: "white", borderRadius: 14, border: "1px solid #E5E7EB",
      boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden",
      marginBottom: 16,
    }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
      </div>
      <div style={{ padding: "0 20px 6px" }}>
        {children}
      </div>
    </div>
  );
}

export default function Preferences() {
  const [prefs, setPrefs] = useState({
    compactTable:    false,
    showRowNumbers:  true,
    autoSaveFilters: true,
    notifyLowStock:  true,
    notifyRequests:  true,
    pageSize:        "30",
    dateFormat:      "dd/mm/yyyy",
    language:        "es",
  });

  const set = (key) => (val) => setPrefs((p) => ({ ...p, [key]: val }));

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("ceshark_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Encabezado */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B2E33", margin: 0, letterSpacing: "-0.02em" }}>
            Preferencias
          </h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
            Personaliza tu experiencia en CeShark ERP
          </p>
        </div>

        <SectionCard title="Visualización">
          <PreferenceRow
            label="Tabla compacta"
            desc="Reduce el espaciado entre filas para ver más datos"
            value={prefs.compactTable}
            onChange={set("compactTable")}
          />
          <PreferenceRow
            label="Números de fila"
            desc="Muestra el número correlativo en las tablas"
            value={prefs.showRowNumbers}
            onChange={set("showRowNumbers")}
          />
          <PreferenceRow
            label="Recordar filtros"
            desc="Conserva los filtros activos al cambiar de página"
            value={prefs.autoSaveFilters}
            onChange={set("autoSaveFilters")}
          />
          <SelectRow
            label="Elementos por página"
            desc="Cantidad de filas que se muestran en las tablas"
            value={prefs.pageSize}
            onChange={set("pageSize")}
            options={[
              { value: "15", label: "15 por página" },
              { value: "30", label: "30 por página" },
              { value: "50", label: "50 por página" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Notificaciones">
          <PreferenceRow
            label="Alerta de stock bajo"
            desc="Avisa cuando un material supera su stock mínimo"
            value={prefs.notifyLowStock}
            onChange={set("notifyLowStock")}
          />
          <PreferenceRow
            label="Nuevas solicitudes"
            desc="Notifica cuando hay solicitudes pendientes de atender"
            value={prefs.notifyRequests}
            onChange={set("notifyRequests")}
          />
        </SectionCard>

        <SectionCard title="Formato y región">
          <SelectRow
            label="Formato de fecha"
            desc="Cómo se muestran las fechas en el sistema"
            value={prefs.dateFormat}
            onChange={set("dateFormat")}
            options={[
              { value: "dd/mm/yyyy", label: "DD/MM/AAAA" },
              { value: "mm/dd/yyyy", label: "MM/DD/AAAA" },
              { value: "yyyy-mm-dd", label: "AAAA-MM-DD" },
            ]}
          />
          <SelectRow
            label="Idioma"
            desc="Idioma del sistema (próximamente más opciones)"
            value={prefs.language}
            onChange={set("language")}
            options={[
              { value: "es", label: "Español" },
              { value: "en", label: "English (próximamente)" },
            ]}
          />
        </SectionCard>

        {/* Botón guardar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {saved && (
            <span style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, color: "#15803D",
              background: "#F0FDF4", border: "1px solid #BBF7D0",
              padding: "9px 16px", borderRadius: 10,
            }}>
              ✓ Preferencias guardadas
            </span>
          )}
          <button
            onClick={handleSave}
            style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #0B2E33 0%, #4F7C82 100%)",
              color: "white", fontSize: 13, fontWeight: 700,
              cursor: "pointer", boxShadow: "0 3px 12px rgba(11,46,51,0.25)",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            Guardar preferencias
          </button>
        </div>

      </div>
    </Layout>
  );
}
