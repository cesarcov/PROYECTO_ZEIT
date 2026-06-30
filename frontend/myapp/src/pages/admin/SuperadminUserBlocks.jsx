import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";
import { useAuth, formatUsername } from "../../hooks/useAuth";
import { BLOCKS, LEVEL_LABELS, BLOCK_LABELS } from "../../constants/blocks";

export default function SuperadminUserBlocks() {
  const auth = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [panelBlocks, setPanelBlocks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch("/superadmin/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }

  function openPanel(user) {
    setSelectedUser(user);
    setSaveMsg("");
    const initial = {};
    BLOCKS.forEach((b) => {
      const assigned = user.blocks.find((ub) => ub.slug === b.slug);
      initial[b.slug] = assigned ? assigned.level : null;
    });
    setPanelBlocks(initial);
  }

  function cycleLevel(slug) {
    setPanelBlocks((prev) => {
      const cur = prev[slug];
      const next = cur === null ? "view" : cur === "view" ? "edit" : null;
      return { ...prev, [slug]: next };
    });
  }

  async function saveBlocks() {
    if (!selectedUser) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const blocks = Object.entries(panelBlocks)
        .filter(([, level]) => level !== null)
        .map(([slug, level]) => ({ slug, level }));
      await apiFetch(`/superadmin/users/${selectedUser.id}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      setSaveMsg("Guardado correctamente");
      await loadUsers();
      setSelectedUser((prev) => {
        const updated = users.find((u) => u.id === prev?.id);
        return updated ? { ...updated, blocks } : prev;
      });
    } catch {
      setSaveMsg("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const levelColor = (level) =>
    level === "edit" ? "var(--primary)" : level === "view" ? "var(--primary-soft, #6B93D6)" : "#D1D5DB";

  const levelLabel = (level) =>
    level === "edit" ? "Editar" : level === "view" ? "Ver" : "Sin acceso";

  return (
    <Layout>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)", margin: 0 }}>
              Gestión de Bloques de Acceso
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
              Asigna qué módulos puede ver o editar cada usuario
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selectedUser ? "1fr 340px" : "1fr", gap: 20 }}>
          {/* Tabla de usuarios */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Usuario
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Bloques asignados
                  </th>
                  <th style={{ padding: "10px 16px", width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: "1px solid #F3F4F6",
                      background: selectedUser?.id === user.id ? "#EFF6FF" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onClick={() => openPanel(user)}
                    onMouseEnter={(e) => { if (selectedUser?.id !== user.id) e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={(e) => { if (selectedUser?.id !== user.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
                        {formatUsername(user.username)}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{user.email}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {user.blocks.length === 0 ? (
                        <span style={{ background: "#FEF9C3", color: "#854D0E", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99 }}>
                          Sin acceso
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {user.blocks.map((b) => (
                            <span key={b.slug} style={{
                              background: b.level === "edit" ? "#EFF6FF" : "#F0FDF4",
                              color: b.level === "edit" ? "var(--primary)" : "#065F46",
                              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                              border: `1px solid ${b.level === "edit" ? "#BFDBFE" : "#BBF7D0"}`,
                            }}>
                              {BLOCK_LABELS[b.slug]} · {LEVEL_LABELS[b.level]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>Editar →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel lateral */}
          {selectedUser && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, alignSelf: "start" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    {formatUsername(selectedUser.username)}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{selectedUser.email}</div>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", fontSize: 18, lineHeight: 1, padding: 4 }}>
                  ×
                </button>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF", marginBottom: 10 }}>
                Clic para cambiar nivel
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {BLOCKS.map((block) => {
                  const level = panelBlocks[block.slug];
                  return (
                    <button
                      key={block.slug}
                      onClick={() => cycleLevel(block.slug)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 10,
                        border: `2px solid ${levelColor(level)}`,
                        background: level ? "#F8FBFF" : "#F9FAFB",
                        cursor: "pointer", transition: "all 0.12s", textAlign: "left",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#1F2937" }}>{block.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99,
                        background: level ? levelColor(level) : "#E5E7EB",
                        color: level ? "white" : "#6B7280",
                      }}>
                        {levelLabel(level)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 12 }}>
                Clic en un bloque: Sin acceso → Ver → Editar → Sin acceso
              </div>

              <button
                onClick={saveBlocks}
                disabled={saving}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 9, border: "none",
                  background: saving ? "#9CA3AF" : "var(--primary)",
                  color: "white", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>

              {saveMsg && (
                <div style={{
                  marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12,
                  background: saveMsg.includes("Error") ? "#FEF2F2" : "#F0FDF4",
                  color: saveMsg.includes("Error") ? "#DC2626" : "#065F46",
                  fontWeight: 600,
                }}>
                  {saveMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
