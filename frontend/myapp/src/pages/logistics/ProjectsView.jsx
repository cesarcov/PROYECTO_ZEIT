import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { apiFetch } from "../../services/api";

const inputStyle = {
  width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 8,
  padding: "9px 12px", fontSize: 13, color: "#111827",
  background: "#FAFAFA", outline: "none", boxSizing: "border-box",
};

function ProjectFormModal({ title, subtitle, initial, onClose, onSuccess }) {
  const [form, setForm] = useState(initial || { code: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError("Código y nombre son obligatorios");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (initial?.id) {
        await apiFetch(`/logistics/projects/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify({ code: form.code.trim().toUpperCase(), name: form.name.trim() }),
        });
      } else {
        await apiFetch("/logistics/projects", {
          method: "POST",
          body: JSON.stringify({ code: form.code.trim().toUpperCase(), name: form.name.trim() }),
        });
      }
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al guardar proyecto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} maxWidth={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Código *
          </label>
          <input
            autoFocus type="text" placeholder="PROY-001"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            style={{ ...inputStyle, fontFamily: "monospace" }}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Nombre *
          </label>
          <input
            type="text" placeholder="Ej: Construcción Sector Norte"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = "#4F7C82"}
            onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
          />
        </div>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Cancelar
          </button>
          <button
            onClick={submit} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#4F7C82", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear proyecto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteProjectModal({ project, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    try {
      await apiFetch(`/logistics/projects/${project.id}`, { method: "DELETE" });
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Eliminar proyecto" subtitle="Esta acción no se puede deshacer" onClose={onClose} maxWidth={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 14, color: "#374151" }}>
          ¿Eliminar el proyecto <strong>{project.name}</strong> ({project.code})?
        </p>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, color: "#6B7280", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Cancelar
          </button>
          <button
            onClick={confirm} disabled={loading}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ProjectsView() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/logistics/projects");
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q);
  });

  const closeModal  = () => setModal(null);
  const afterSuccess = () => { closeModal(); load(); };

  // Color determinista por letra de código
  const projectColor = (code) => {
    const palette = ["#4F7C82","#0369A1","#059669","#D97706","#7C3AED","#DB2777","#DC2626","#0B2E33"];
    return palette[(code?.charCodeAt(0) || 0) % palette.length];
  };

  return (
    <Layout>
      {modal === "new" && (
        <ProjectFormModal title="Nuevo Proyecto" subtitle="Registrar proyecto en el sistema"
          onClose={closeModal} onSuccess={afterSuccess} />
      )}
      {modal?.mode === "edit" && (
        <ProjectFormModal title="Editar Proyecto" subtitle={`Modificar datos de ${modal.proj.name}`}
          initial={modal.proj} onClose={closeModal} onSuccess={afterSuccess} />
      )}
      {modal?.mode === "delete" && (
        <DeleteProjectModal project={modal.proj} onClose={closeModal} onSuccess={afterSuccess} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>Proyectos</h1>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              {projects.length} proyectos · Haz clic en un proyecto para ver el detalle 360°
            </p>
          </div>
          <button onClick={() => setModal("new")}
            style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#4F7C82", color: "white", border: "none", borderRadius: 10, cursor: "pointer", boxShadow: "0 2px 8px rgba(79,124,130,0.3)" }}>
            + Nuevo proyecto
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input type="text" placeholder="Buscar por nombre o código..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 10, paddingLeft: 38, paddingRight: 12, paddingTop: 9, paddingBottom: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white" }}
            onFocus={(e) => { e.target.style.borderColor = "#4F7C82"; e.target.style.boxShadow = "0 0 0 3px rgba(79,124,130,0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }} />
        </div>

        {/* Grid de tarjetas */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 13 }}>Cargando proyectos...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <p style={{ fontWeight: 700, color: "#374151", margin: "0 0 6px" }}>
              {search ? "Sin resultados" : "Sin proyectos aún"}
            </p>
            <p style={{ color: "#9CA3AF", fontSize: 13, margin: 0 }}>
              {search ? "Intenta con otro término de búsqueda." : "Crea el primer proyecto con el botón de arriba."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filtered.map((p) => {
              const color = projectColor(p.code);
              return (
                <div key={p.id}
                  style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "transform 0.15s, box-shadow 0.15s", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
                  onClick={() => navigate(`/logistics/projects/${p.id}`)}>

                  {/* Cabecera de color */}
                  <div style={{ height: 6, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

                  <div style={{ padding: "18px 20px 16px" }}>
                    {/* Código + nombre */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 20 }}>📁</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: color + "15", color }}>
                            {p.code}
                          </span>
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "6px 0 0", lineHeight: 1.3 }}>{p.name}</p>
                        {p.created_at && (
                          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>
                            Creado {new Date(p.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Acción footer */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: color, display: "flex", alignItems: "center", gap: 5 }}>
                        Ver detalle 360° →
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={(e) => { e.stopPropagation(); setModal({ proj: p, mode: "edit" }); }}
                          title="Editar"
                          style={{ padding: "5px 10px", fontSize: 12, background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 7, cursor: "pointer" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#E5E7EB"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#F3F4F6"}>
                          ✏️
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setModal({ proj: p, mode: "delete" }); }}
                          title="Eliminar"
                          style={{ padding: "5px 10px", fontSize: 12, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 7, cursor: "pointer" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#FEE2E2"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#FEF2F2"}>
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>
            {filtered.length} de {projects.length} proyectos
          </p>
        )}
      </div>
    </Layout>
  );
}
