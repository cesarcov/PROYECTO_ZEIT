import { useState, useEffect, useMemo } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

// ── Stock helpers ─────────────────────────────────────────────────────────────
function stockState(stock) {
  if (stock <= 0)  return { label: "Sin stock",   bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444", lvl: 0 };
  if (stock < 5)   return { label: `${stock} disp.`, bg: "#FEF9C3", color: "#854D0E", dot: "#EAB308", lvl: 1 };
  return             { label: `${stock} disp.`, bg: "#DCFCE7", color: "#166534", dot: "#22C55E", lvl: 2 };
}

function StockDot({ stock }) {
  const s = stockState(stock);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color, flexShrink: 0 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportToCSV(cart, projectLabel) {
  const header = "Proyecto/Servicio,Material,Código,Categoría,Cantidad solicitada,Stock disponible,Estado stock,Notas\n";
  const rows = cart.map(item => {
    const st = stockState(item.stock);
    const estado = item.stock >= item.quantity ? "Disponible" : item.stock > 0 ? "Stock parcial" : "Sin stock";
    return [
      `"${projectLabel}"`,
      `"${item.name}"`,
      `"${item.code}"`,
      `"${item.category || ''}"`,
      item.quantity,
      item.stock,
      `"${estado}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ].join(",");
  }).join("\n");
  const csv = "﻿" + header + rows;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = projectLabel.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  a.download = `requisicion_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function RequisitionView() {
  // Data
  const [projects,   setProjects]   = useState([]);
  const [materials,  setMaterials]  = useState([]);
  const [stockMap,   setStockMap]   = useState({});
  const [loadingData, setLoadingData] = useState(true);

  // Project / service selector
  const [projectId,    setProjectId]    = useState("");
  const [serviceName,  setServiceName]  = useState("");

  // Search
  const [search,      setSearch]      = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [stockFilter, setStockFilter] = useState("all"); // all | in | out

  // Cart
  const [cart, setCart] = useState([]);

  // Submit
  const [submitting,    setSubmitting]    = useState(false);
  const [submitDone,    setSubmitDone]    = useState(false);
  const [submitSummary, setSubmitSummary] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingData(true);
      const [projRes, matRes, stockRes] = await Promise.allSettled([
        apiFetch("/logistics/projects"),
        apiFetch("/logistics/materials"),
        apiFetch("/logistics/stock/availability"),
      ]);
      if (projRes.status  === "fulfilled") setProjects(projRes.value);
      if (matRes.status   === "fulfilled") setMaterials(matRes.value);
      if (stockRes.status === "fulfilled") {
        const map = {};
        for (const row of stockRes.value) {
          map[row.material_id] = (map[row.material_id] || 0) + row.stock_available;
        }
        setStockMap(map);
      }
      setLoadingData(false);
    }
    load();
  }, []);

  // ── Filtered catalog ────────────────────────────────────────────────────────
  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
      );
    }
    if (stockFilter === "in")  list = list.filter(m => (stockMap[m.id] || 0) > 0);
    if (stockFilter === "out") list = list.filter(m => (stockMap[m.id] || 0) <= 0);
    return list;
  }, [materials, search, stockFilter, stockMap]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (m) => {
    const stock = stockMap[m.id] || 0;
    setCart(prev => {
      const exists = prev.find(i => i.id === m.id);
      if (exists) {
        showToast(`+1 a ${m.name}`, "success");
        return prev.map(i => i.id === m.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      showToast(`${m.name} añadido`, "success");
      return [...prev, { id: m.id, name: m.name, code: m.code, category: m.category, quantity: 1, stock, notes: "" }];
    });
  };

  const updateQty = (id, val) => {
    const q = Math.max(1, Number(val) || 1);
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
  };

  const updateNotes = (id, notes) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  // ── Project label ───────────────────────────────────────────────────────────
  const selectedProject = projects.find(p => p.id === projectId);
  const projectLabel = selectedProject
    ? `${selectedProject.code} — ${selectedProject.name}`
    : serviceName.trim() || "Sin proyecto";

  // ── Summary ─────────────────────────────────────────────────────────────────
  const noStockItems  = cart.filter(i => i.stock <= 0);
  const partialItems  = cart.filter(i => i.stock > 0 && i.stock < i.quantity);
  const totalQty      = cart.reduce((s, i) => s + i.quantity, 0);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    let ok = 0, errors = [];
    for (const item of cart) {
      try {
        const noStock = item.stock <= 0;
        const prefix  = noStock ? "[SIN STOCK — requiere compra] " : "";
        const reason  = `[${projectLabel}] ${prefix}${item.notes || "Requerimiento de materiales"}`.trim();
        await apiFetch("/requests/material-requests", {
          method: "POST",
          body: JSON.stringify({
            related_material_id: item.id,
            quantity: item.quantity,
            reason,
          }),
        });
        ok++;
      } catch (e) {
        errors.push(`${item.name}: ${e.message}`);
      }
    }
    setSubmitting(false);
    setSubmitSummary({ ok, errors, noStock: noStockItems.length });
    setSubmitDone(true);
    if (errors.length === 0) {
      setCart([]);
      showToast(`${ok} solicitudes enviadas a logística.`);
    } else {
      showToast(`${ok} enviadas, ${errors.length} fallaron.`, "error");
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const panelCard  = { background: "white", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" };
  const sectionHdr = { background: "#0B2E33", padding: "12px 16px", color: "white" };
  const inputSt    = { border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "#FAFAFA", boxSizing: "border-box" };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "white", background: toast.type === "error" ? "#DC2626" : "#16A34A", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          {toast.type === "error" ? "✗ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Nueva Requisición
            </h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              Busca materiales, añádelos al carrito y envía el requerimiento a logística
            </p>
          </div>
        </div>

        {/* ── Selector proyecto/servicio ─────────────────────────────────────── */}
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 20px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Vinculado a:</span>
          </div>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setServiceName(""); }}
            style={{ ...inputSt, minWidth: 220 }}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          >
            <option value="">Sin proyecto (servicio libre)</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          {!projectId && (
            <>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>o escribe el nombre del servicio:</span>
              <input
                type="text"
                placeholder="Ej: Servicio de campo Sector Norte"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                style={{ ...inputSt, minWidth: 260 }}
                onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
                onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              />
            </>
          )}
          {projectLabel !== "Sin proyecto" && (
            <span style={{ fontSize: 12, fontWeight: 600, background: "#EEF6F7", color: "#0B2E33", padding: "4px 12px", borderRadius: 99, border: "1px solid #B8E3E9" }}>
              📌 {projectLabel}
            </span>
          )}
        </div>

        {/* ── Split view ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,42%) 1fr", gap: 14, alignItems: "start" }}>

          {/* ── LEFT: Catálogo ─────────────────────────────────────────────── */}
          <div style={panelCard}>
            <div style={sectionHdr}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Catálogo de materiales</p>
              <p style={{ fontSize: 11, color: "rgba(184,227,233,0.7)", marginTop: 2 }}>
                {loadingData ? "Cargando..." : `${materials.length} materiales disponibles`}
              </p>
            </div>

            {/* Search */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9CA3AF", pointerEvents: "none" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o categoría..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setSearchFocus(false)}
                  style={{
                    width: "100%", border: `1.5px solid ${searchFocus ? "#4F7C82" : "#E5E7EB"}`, borderRadius: 9,
                    paddingLeft: 32, paddingRight: search ? 30 : 10, paddingTop: 8, paddingBottom: 8,
                    fontSize: 13, outline: "none", boxSizing: "border-box", background: "white",
                    boxShadow: searchFocus ? "0 0 0 3px rgba(79,124,130,0.1)" : "none",
                  }}
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 15, padding: 2 }}>
                    ×
                  </button>
                )}
              </div>
              {/* Filtros stock */}
              <div style={{ display: "flex", gap: 5 }}>
                {[
                  { key: "all", label: "Todos" },
                  { key: "in",  label: "Con stock" },
                  { key: "out", label: "Sin stock" },
                ].map(f => (
                  <button key={f.key} onClick={() => setStockFilter(f.key)}
                    style={{
                      padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                      background: stockFilter === f.key ? "#0B2E33" : "#F3F4F6",
                      color: stockFilter === f.key ? "white" : "#6B7280",
                    }}>
                    {f.label}
                  </button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", alignSelf: "center" }}>
                  {filteredMaterials.length} resultados
                </span>
              </div>
            </div>

            {/* Material list */}
            <div style={{ overflowY: "auto", maxHeight: "55vh" }}>
              {loadingData ? (
                <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Cargando catálogo...</div>
              ) : filteredMaterials.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  Sin resultados para "{search}"
                </div>
              ) : filteredMaterials.map((m, idx) => {
                const stock = stockMap[m.id] || 0;
                const inCart = cart.some(i => i.id === m.id);
                return (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px",
                    borderBottom: idx < filteredMaterials.length - 1 ? "1px solid #F9FAFB" : "none",
                    background: inCart ? "#F0F9FA" : "white",
                    transition: "background 0.1s",
                  }}
                    onMouseEnter={(e) => { if (!inCart) e.currentTarget.style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = inCart ? "#F0F9FA" : "white"; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <StockDot stock={stock} />
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#6B7280", background: "#F3F4F6", padding: "1px 6px", borderRadius: 4 }}>
                          {m.code}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.name}
                      </p>
                      {m.category && (
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>{m.category}</p>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(m)}
                      style={{
                        flexShrink: 0, padding: "5px 14px", fontSize: 12, fontWeight: 700,
                        background: inCart ? "#EEF6F7" : "#4F7C82",
                        color: inCart ? "#4F7C82" : "white",
                        border: inCart ? "1px solid #93B1B5" : "none",
                        borderRadius: 7, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {inCart ? "+ 1 más" : "+ Añadir"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: Carrito ──────────────────────────────────────────────── */}
          <div style={panelCard}>
            <div style={sectionHdr}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                    Lista de Requisición
                    {cart.length > 0 && (
                      <span style={{ marginLeft: 8, background: "#4F7C82", color: "white", fontSize: 11, padding: "1px 8px", borderRadius: 99 }}>
                        {cart.length}
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(184,227,233,0.7)", marginTop: 2 }}>
                    {projectLabel}
                  </p>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
                  >
                    Vaciar lista
                  </button>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div style={{ padding: "48px 32px", textAlign: "center", flex: 1 }}>
                <span style={{ fontSize: 40, display: "block", marginBottom: 12, opacity: 0.3 }}>🛒</span>
                <p style={{ fontWeight: 600, color: "#9CA3AF", margin: 0, fontSize: 13 }}>
                  Lista vacía
                </p>
                <p style={{ color: "#D1D5DB", fontSize: 12, marginTop: 6 }}>
                  Busca materiales en el catálogo y añádelos aquí
                </p>
              </div>
            ) : (
              <>
                {/* Cart items */}
                <div style={{ overflowY: "auto", maxHeight: "45vh" }}>
                  {cart.map((item, idx) => (
                    <div key={item.id} style={{
                      padding: "14px 16px",
                      borderBottom: idx < cart.length - 1 ? "1px solid #F3F4F6" : "none",
                      background: item.stock <= 0 ? "#FFFBEB" : "white",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <StockDot stock={item.stock} />
                            {item.stock <= 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", background: "#FEF9C3", padding: "1px 6px", borderRadius: 4 }}>
                                ⚠ Logística recibirá alerta
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{item.name}</p>
                          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0", fontFamily: "monospace" }}>{item.code}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          title="Quitar de la lista"
                          style={{ flexShrink: 0, padding: "4px 8px", fontSize: 13, background: "none", color: "#9CA3AF", border: "none", borderRadius: 6, cursor: "pointer" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9CA3AF"; }}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", whiteSpace: "nowrap" }}>
                          Cantidad:
                        </label>
                        <input
                          type="number" min="1" step="1"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.id, e.target.value)}
                          style={{ width: 70, border: "1.5px solid #E5E7EB", borderRadius: 7, padding: "5px 8px", fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none" }}
                          onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
                          onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                        />
                        {item.stock > 0 && item.stock < item.quantity && (
                          <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>
                            ⚠ Solo hay {item.stock}
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          placeholder="Notas / justificación (opcional)"
                          value={item.notes}
                          onChange={(e) => updateNotes(item.id, e.target.value)}
                          style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 7, padding: "5px 10px", fontSize: 12, outline: "none", boxSizing: "border-box", color: "#374151" }}
                          onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
                          onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div style={{ borderTop: "1px solid #E5E7EB", padding: "14px 16px", background: "#F9FAFB" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>
                        <strong>{cart.length}</strong> materiales · <strong>{totalQty}</strong> unidades
                      </span>
                      {noStockItems.length > 0 && (
                        <span style={{ fontSize: 12, color: "#D97706", fontWeight: 600 }}>
                          ⚠ {noStockItems.length} sin stock → logística recibirá alerta
                        </span>
                      )}
                      {partialItems.length > 0 && (
                        <span style={{ fontSize: 12, color: "#D97706" }}>
                          {partialItems.length} con stock parcial
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit result */}
                  {submitDone && submitSummary && (
                    <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: submitSummary.errors.length === 0 ? "#F0FDF4" : "#FFFBEB", border: `1px solid ${submitSummary.errors.length === 0 ? "#BBF7D0" : "#FED7AA"}` }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: submitSummary.errors.length === 0 ? "#166534" : "#92400E", margin: "0 0 4px" }}>
                        {submitSummary.errors.length === 0
                          ? `✓ ${submitSummary.ok} solicitudes enviadas correctamente`
                          : `${submitSummary.ok} enviadas, ${submitSummary.errors.length} fallaron`}
                      </p>
                      {submitSummary.noStock > 0 && (
                        <p style={{ fontSize: 12, color: "#166534", margin: 0 }}>
                          Logística ha sido notificada de {submitSummary.noStock} materiales sin stock.
                        </p>
                      )}
                      {submitSummary.errors.length > 0 && (
                        <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 11, color: "#DC2626" }}>
                          {submitSummary.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => exportToCSV(cart, projectLabel)}
                      style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Exportar Excel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || cart.length === 0}
                      style={{
                        flex: 2, padding: "9px 0", fontSize: 13, fontWeight: 700,
                        background: submitting ? "#93B1B5" : "#0B2E33",
                        color: "white", border: "none", borderRadius: 9,
                        cursor: submitting ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      {submitting ? (
                        "Enviando solicitudes..."
                      ) : (
                        <>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                          Enviar a Logística
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
