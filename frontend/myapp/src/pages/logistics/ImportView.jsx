import { useState, useRef } from "react";
import Layout from "../../components/Layout";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const IMPORT_TYPES = [
  {
    key:      "materials",
    label:    "Materiales",
    icon:     "📦",
    endpoint: "/logistics/materials/import",
    desc:     "Importar o actualizar el catálogo de materiales",
    required: ["Código", "Nombre"],
    optional: ["Categoría", "Stock mínimo", "Marca", "Modelo", "Proveedor", "Contacto proveedor", "Costo unitario", "N° serie", "Vida útil (años)", "Fecha compra", "Venc. garantía", "Aliases (sep. por coma)"],
    tips: [
      "Registros con el mismo Código serán actualizados, no duplicados.",
      "Fechas en formato YYYY-MM-DD o DD/MM/YYYY.",
      "Aliases: varios valores separados por coma en la misma celda.",
    ],
  },
  {
    key:      "stock-in",
    label:    "Entrada de Stock",
    icon:     "📥",
    endpoint: "/logistics/stock/import-in",
    desc:     "Registrar entradas masivas de materiales al almacén",
    required: ["Código material", "Almacén (código)", "Cantidad"],
    optional: ["Costo unitario", "Referencia", "Notas"],
    tips: [
      "El código de material y almacén deben existir previamente en el sistema.",
      "Cada fila genera un movimiento de entrada (IN) independiente.",
    ],
  },
  {
    key:      "stock-out",
    label:    "Salida de Stock",
    icon:     "📤",
    endpoint: "/logistics/stock/import-out",
    desc:     "Registrar salidas masivas de materiales del almacén",
    required: ["Código material", "Almacén (código)", "Cantidad"],
    optional: ["Destino / Responsable", "Referencia", "Notas"],
    tips: [
      "El código de material y almacén deben existir previamente.",
      "Cada fila genera un movimiento de salida (OUT) independiente.",
    ],
  },
  {
    key:      "baules",
    label:    "Baúles APU",
    icon:     "🧰",
    endpoint: "/cotizaciones/baules/import",
    desc:     "Cargar kits preconfigurados de ítems APU desde Excel",
    required: ["Baúl Nombre", "Tipo recurso", "Descripción ítem", "Unidad", "Cantidad base"],
    optional: ["Categoría", "Descripción baúl", "Precio unitario", "Cód. material"],
    tips: [
      "Cada fila es un ítem. Baúles con el mismo nombre serán reemplazados.",
      "Tipo recurso: MATERIAL, MANO_OBRA o EQUIPO (en mayúsculas).",
      "Cód. material: si el código existe en el catálogo, se vincula automáticamente.",
    ],
  },
];

// Datos de ejemplo para la plantilla descargable
const TEMPLATE_EXAMPLES = {
  "materials": [
    ["MT-001", "Cable eléctrico 12 AWG", "Material", 50, "Cablena", "THW-90", "Distribuidora Eléctrica SAC", "999-888-777", 1.50, "", 10, "2024-01-15", "2025-01-15", "cable 12, cable rojo"],
    ["MT-002", "Guante dieléctrico clase 2", "EPP", 20, "Ansell", "Model 11-360", "Seguridad Total SAC", "998-765-432", 45.00, "", 3, "2024-03-01", "2027-03-01", "guante, EPP"],
  ],
  "stock-in": [
    ["MT-001", "ALM-CENTRAL", 100, 1.50, "OC-2024-001", "Compra inicial"],
    ["MT-002", "ALM-OBRA-NORTE", 30, 45.00, "OC-2024-002", "Reposición EPP"],
  ],
  "stock-out": [
    ["MT-001", "ALM-CENTRAL", 20, "Juan Pérez", "PRO-2024-001", "Proyecto Subestación Norte"],
    ["MT-002", "ALM-CENTRAL", 5, "Carlos Ríos", "PRO-2024-001", "Equipos de protección"],
  ],
  "baules": [
    ["Kit Empalme BT", "Eléctrico", "Kit para empalme en baja tensión", "MATERIAL", "Cable THW 4mm", "m", 5, 2.50, "MT-001"],
    ["Kit Empalme BT", "Eléctrico", "Kit para empalme en baja tensión", "MATERIAL", "Cinta aislante", "und", 3, 0.80, ""],
    ["Kit Empalme BT", "Eléctrico", "Kit para empalme en baja tensión", "MANO_OBRA", "Técnico electricista", "h", 2, 45.00, ""],
    ["Kit Medición", "Instrumentación", "Kit de medición eléctrica básica", "EQUIPO", "Multímetro digital", "und", 1, 120.00, ""],
    ["Kit Medición", "Instrumentación", "Kit de medición eléctrica básica", "MANO_OBRA", "Técnico instrumentista", "h", 1, 55.00, ""],
  ],
};

// Parsea un archivo Excel/CSV en el browser y devuelve {headers, rows}
async function parseFilePreview(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (!data || data.length < 2) return { headers: [], rows: [], total: 0 };

  const headers = data[0].map(h => String(h ?? ""));
  const rows = data.slice(1).filter(r => r.some(c => c !== "" && c !== null && c !== undefined));
  return {
    headers,
    rows: rows.map(r => headers.map((_, i) => {
      const v = r[i];
      if (v instanceof Date) return v.toLocaleDateString("es-PE");
      return v ?? "";
    })),
    total: rows.length,
  };
}

function ImportCard({ type }) {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);   // { headers, rows, total }
  const [previewErr, setPreviewErr] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // ── Descargar plantilla Excel con 2 filas de ejemplo y hoja de instrucciones ──
  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb   = XLSX.utils.book_new();

    const allCols    = [...type.required, ...(type.optional ?? [])];
    const examples   = TEMPLATE_EXAMPLES[type.key] ?? [];

    const ws = XLSX.utils.aoa_to_sheet([allCols, ...examples]);
    // Estilo de ancho de columna
    ws["!cols"] = allCols.map(col => ({ wch: Math.max(col.length + 6, 18) }));

    // Resaltar encabezados (fila 1) — solo disponible en escritura xlsx
    if (!ws["!rows"]) ws["!rows"] = [];
    ws["!rows"][0] = { hpt: 20 };

    XLSX.utils.book_append_sheet(wb, ws, type.label);

    // Hoja de instrucciones detallada
    const instrRows = [
      ["INSTRUCCIONES DE USO — " + type.label.toUpperCase()],
      [],
      ["Paso 1: Descarga esta plantilla y ábrela en Excel o Google Sheets."],
      ["Paso 2: Reemplaza las filas de ejemplo (fila 2 en adelante) con tus datos reales."],
      ["Paso 3: NO modifiques los nombres de los encabezados de la fila 1."],
      ["Paso 4: Guarda el archivo como .xlsx y cárgalo en el sistema."],
      [],
      ["━━━ COLUMNAS OBLIGATORIAS (si falta alguna, la fila entera será rechazada) ━━━"],
      ...type.required.map(f => [`   ✅  ${f}`]),
      [],
      ...(type.optional?.length > 0 ? [
        ["━━━ COLUMNAS OPCIONALES (pueden quedar vacías) ━━━"],
        ...type.optional.map(f => [`   ⬜  ${f}`]),
        [],
      ] : []),
      ["━━━ TIPS IMPORTANTES ━━━"],
      ...(type.tips ?? []).map(t => [`   💡  ${t}`]),
      [],
      ["━━━ FORMATOS DE DATOS ━━━"],
      ["   • Fechas:      YYYY-MM-DD  o  DD/MM/YYYY  (ej: 2024-06-15 o 15/06/2024)"],
      ["   • Números:     usar punto decimal (ej: 45.50), sin separador de miles"],
      ["   • Texto:       sin comillas, escribe directo en la celda"],
      ["   • Código:      debe ser único, sin espacios al inicio/fin"],
      ["   • Aliases:     separar múltiples valores con coma (ej: cable,cable 12,thw)"],
    ];
    const wsI = XLSX.utils.aoa_to_sheet(instrRows);
    wsI["!cols"] = [{ wch: 72 }];
    XLSX.utils.book_append_sheet(wb, wsI, "Instrucciones");

    // Hoja de validaciones de referencia
    const refRows = [
      ["REFERENCIA RÁPIDA — " + type.label.toUpperCase()],
      [],
      ["Columna", "Tipo", "Obligatoria", "Ejemplo"],
      ...type.required.map(f => [f, "Texto", "SÍ", TEMPLATE_EXAMPLES[type.key]?.[0]?.[type.required.indexOf(f)] ?? ""]),
      ...(type.optional ?? []).map((f, i) => [f, "Texto / Número", "No", TEMPLATE_EXAMPLES[type.key]?.[0]?.[type.required.length + i] ?? ""]),
    ];
    const wsR = XLSX.utils.aoa_to_sheet(refRows);
    wsR["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsR, "Referencia");

    XLSX.writeFile(wb, `plantilla_${type.key}.xlsx`);
  };

  // ── Selecciona archivo y genera preview ────────────────────────────────────
  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("Solo se aceptan archivos .xlsx, .xls o .csv");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
    setPreview(null);
    setPreviewErr("");

    try {
      const parsed = await parseFilePreview(f);
      if (parsed.total === 0) {
        setPreviewErr("El archivo no contiene filas de datos (solo encabezados o vacío).");
        return;
      }

      // Verifica columnas obligatorias
      const missing = type.required.filter(col => !parsed.headers.includes(col));
      if (missing.length > 0) {
        setPreviewErr(`Faltan columnas obligatorias: ${missing.map(m => `"${m}"`).join(", ")}. ¿Usaste la plantilla correcta?`);
        return;
      }

      setPreview(parsed);
    } catch (e) {
      setPreviewErr("No se pudo leer el archivo. Asegúrate de que sea un Excel válido.");
    }
  };

  const onInputChange = (e) => handleFile(e.target.files?.[0]);
  const onDragOver   = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave  = () => setDragging(false);
  const onDrop       = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); };

  const cancelFile = () => {
    setFile(null); setPreview(null); setPreviewErr(""); setError(""); setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Subir archivo al backend ───────────────────────────────────────────────
  const upload = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const token = localStorage.getItem("access_token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}${type.endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e.message || "Error al importar archivo");
    } finally {
      setLoading(false);
    }
  };

  // ── Columnas a mostrar en el preview (máx. 6 para no sobrepasar el ancho) ─
  const previewCols  = preview ? preview.headers.slice(0, 6) : [];
  const previewRows  = preview ? preview.rows.slice(0, 5) : [];
  const hasMoreCols  = preview && preview.headers.length > 6;
  const hasMoreRows  = preview && preview.total > 5;

  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#0B2E33", padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{type.icon}</span>
        <div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0 }}>{type.label}</h3>
          <p style={{ color: "rgba(184,227,233,0.7)", fontSize: 12, marginTop: 3 }}>{type.desc}</p>
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>

        {/* Columnas requeridas / opcionales */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Columnas obligatorias</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {type.required.map((f, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, background: "#EEF6F7", color: "#0B2E33", border: "1px solid #B8E3E9", padding: "3px 10px", borderRadius: 99 }}>{f}</span>
              ))}
            </div>
          </div>
          {type.optional?.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Opcionales</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {type.optional.map((f, i) => (
                  <span key={i} style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB", padding: "3px 10px", borderRadius: 99 }}>{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Descargar plantilla */}
        <button onClick={downloadTemplate}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", width: "100%", fontSize: 13, fontWeight: 600, background: "#EEF6F7", color: "#0B2E33", border: "1.5px dashed #93B1B5", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#D4EEF1"; e.currentTarget.style.borderColor = "#4F7C82"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#EEF6F7"; e.currentTarget.style.borderColor = "#93B1B5"; }}>
          <span style={{ fontSize: 16 }}>↓</span>
          Descargar plantilla Excel (con ejemplos e instrucciones)
        </button>

        {/* Drop zone — solo si no hay archivo seleccionado */}
        {!file && (
          <div
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#4F7C82" : "#D1D5DB"}`,
              borderRadius: 12, padding: "24px 16px", textAlign: "center",
              cursor: "pointer",
              background: dragging ? "rgba(79,124,130,0.06)" : "#FAFAFA",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>{dragging ? "📂" : "☁️"}</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>
              {dragging ? "Suelta el archivo aquí" : "Haz clic o arrastra tu archivo aquí"}
            </p>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>.xlsx, .xls o .csv</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onInputChange} />
          </div>
        )}

        {/* Error de preview (columnas faltantes, etc.) */}
        {previewErr && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ color: "#DC2626", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>No se puede importar este archivo</p>
            <p style={{ color: "#991B1B", fontSize: 12, margin: 0 }}>{previewErr}</p>
            <button onClick={cancelFile} style={{ marginTop: 8, fontSize: 12, color: "#991B1B", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Seleccionar otro archivo
            </button>
          </div>
        )}

        {/* PREVIEW DE DATOS */}
        {preview && !previewErr && (
          <div style={{ border: "1.5px solid #B8E3E9", borderRadius: 10, overflow: "hidden" }}>
            {/* Cabecera del preview */}
            <div style={{ background: "#EEF7F8", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0B2E33" }}>Vista previa del archivo</span>
                <span style={{ fontSize: 11, color: "#4F7C82", marginLeft: 8 }}>
                  {file.name} · {preview.total} fila{preview.total !== 1 ? "s" : ""} de datos
                  {hasMoreCols ? ` · mostrando ${previewCols.length} de ${preview.headers.length} columnas` : ""}
                </span>
              </div>
              <button onClick={cancelFile} style={{ fontSize: 11, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}>
                ✕ Cambiar
              </button>
            </div>

            {/* Tabla de preview */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#0B2E33" }}>
                    {previewCols.map((h, i) => (
                      <th key={i} style={{ padding: "6px 10px", color: "white", fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                        {type.required.includes(h)
                          ? <span title="Columna obligatoria">{h} <span style={{ color: "#B8E3E9" }}>*</span></span>
                          : h}
                      </th>
                    ))}
                    {hasMoreCols && <th style={{ padding: "6px 10px", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>+{preview.headers.length - 6} más</th>}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "white" : "#F0F9FA" }}>
                      {previewCols.map((_, ci) => (
                        <td key={ci} style={{ padding: "5px 10px", color: "#374151", borderRight: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(row[ci] ?? "")}
                        </td>
                      ))}
                      {hasMoreCols && <td style={{ padding: "5px 10px", color: "#9CA3AF", borderBottom: "1px solid #E5E7EB" }}>…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMoreRows && (
              <p style={{ fontSize: 11, color: "#6B7280", textAlign: "center", padding: "6px 0", margin: 0, borderTop: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                mostrando 5 de {preview.total} filas — todas se importarán al confirmar
              </p>
            )}
          </div>
        )}

        {/* Error de importación */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Resultado de importación */}
        {result && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px" }}>
            <p style={{ color: "#166534", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
              Importación completada
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: result.errors?.length > 0 ? 10 : 0 }}>
              {result.inserted > 0 && (
                <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>
                  ✅ {result.inserted} nuevo{result.inserted !== 1 ? "s" : ""}
                </span>
              )}
              {result.created > 0 && (
                <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>
                  ✅ {result.created} baúl{result.created !== 1 ? "es" : ""} creado{result.created !== 1 ? "s" : ""}
                </span>
              )}
              {result.updated > 0 && (
                <span style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 600 }}>
                  🔄 {result.updated} actualizado{result.updated !== 1 ? "s" : ""}
                </span>
              )}
              {result.total_items > 0 && (
                <span style={{ fontSize: 12, color: "#4F7C82", fontWeight: 600 }}>
                  📋 {result.total_items} ítems importados
                </span>
              )}
              {result.imported != null && result.inserted == null && result.created == null && (
                <span style={{ fontSize: 12, color: "#15803D" }}>{result.imported} registros importados</span>
              )}
              {result.skipped > 0 && (
                <span style={{ fontSize: 12, color: "#92400E" }}>⏭ {result.skipped} omitidos</span>
              )}
              {result.failed > 0 && (
                <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>❌ {result.failed} fallidos</span>
              )}
            </div>
            {result.errors?.length > 0 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 7, padding: "8px 12px" }}>
                <p style={{ color: "#92400E", fontSize: 11, fontWeight: 700, margin: "0 0 5px" }}>
                  Filas con errores ({result.errors.length}):
                </p>
                <ul style={{ color: "#92400E", fontSize: 11, paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
                  {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 8 && (
                    <li style={{ color: "#B45309" }}>...y {result.errors.length - 8} errores más.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Botón de acción principal */}
        <button
          onClick={preview && !previewErr ? upload : () => inputRef.current?.click()}
          disabled={loading || (file && previewErr)}
          style={{
            width: "100%", padding: "11px 0", fontSize: 13, fontWeight: 700,
            background: loading ? "#9CA3AF" : (!file ? "#EEF7F8" : (previewErr ? "#F3F4F6" : "#0B2E33")),
            color: loading ? "white" : (!file ? "#4F7C82" : (previewErr ? "#9CA3AF" : "white")),
            border: !file ? "1.5px dashed #93B1B5" : "none",
            borderRadius: 10,
            cursor: loading || (file && previewErr) ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {loading
            ? "⟳ Importando..."
            : !file
              ? `Seleccionar archivo para ${type.label}`
              : previewErr
                ? "Archivo inválido"
                : `Confirmar e importar ${preview?.total ?? ""} fila${preview?.total !== 1 ? "s" : ""}`}
        </button>
        {!file && <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onInputChange} />}
      </div>
    </div>
  );
}

export default function ImportView() {
  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Importación Masiva
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Carga materiales y movimientos de stock desde Excel · La plantilla incluye ejemplos e instrucciones detalladas
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {IMPORT_TYPES.map((t) => <ImportCard key={t.key} type={t} />)}
        </div>

        {/* Guía de uso */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, margin: "0 0 12px" }}>
            ℹ️ ¿Cómo importar correctamente?
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { step: "1", title: "Descarga la plantilla", desc: "Usa el botón de plantilla de cada tipo. Incluye ejemplos y una hoja de instrucciones." },
              { step: "2", title: "Rellena tus datos", desc: "Reemplaza las filas de ejemplo desde la fila 2. No cambies los encabezados." },
              { step: "3", title: "Verifica la vista previa", desc: "Al cargar el archivo verás las primeras filas. Si algo no cuadra, corrígelo antes de importar." },
              { step: "4", title: "Confirma la importación", desc: "El sistema procesa cada fila e informa cuántas fueron agregadas, actualizadas o fallidas." },
            ].map(s => (
              <div key={s.step} style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 24, height: 24, background: "#1D4ED8", color: "white", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{s.step}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF", margin: 0 }}>{s.title}</p>
                  <p style={{ fontSize: 11, color: "#1E40AF", margin: "2px 0 0", lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
