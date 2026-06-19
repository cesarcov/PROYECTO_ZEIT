import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { apiFetch } from "../../services/api";

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_CFG = {
  BLOCKED:   { label: "Bloqueado",  bg: "#FEF9C3", color: "#854D0E" },
  CONFIRMED: { label: "Confirmado", bg: "#DCFCE7", color: "#166534" },
  RELEASED:  { label: "Liberado",   bg: "#F3F4F6", color: "#4B5563" },
  EXPIRED:   { label: "Vencido",    bg: "#FEE2E2", color: "#991B1B" },
};

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || { label: status, bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function ExpiryInfo({ expires_at, status }) {
  if (status !== "BLOCKED" || !expires_at) return null;
  const diffH = (new Date(expires_at) - Date.now()) / 3600000;
  if (diffH < 0)
    return <p className="text-xs text-red-600 font-semibold mt-1">Expiró hace {Math.abs(diffH).toFixed(1)}h</p>;
  return (
    <p className={`text-xs mt-1 ${diffH < 4 ? "text-yellow-600 font-semibold" : "text-gray-400"}`}>
      Vence en {diffH.toFixed(1)}h
    </p>
  );
}

export default function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/requests/reservations/my");
      setReservations(data);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = reservations.filter((r) => r.status === "BLOCKED" || r.status === "CONFIRMED");
  const history = reservations.filter((r) => r.status === "RELEASED" || r.status === "EXPIRED");

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis Reservas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Reservas de stock asociadas a tus solicitudes
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: "6px 14px", fontSize: 13, background: "white", border: "1px solid #E5E7EB", borderRadius: 8, color: "#374151", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Cargando..." : "↻ Actualizar"}
          </button>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
            Cargando reservas...
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">No tienes reservas de stock.</p>
            <p className="text-gray-400 text-xs mt-1">
              Las reservas se crean cuando logística aprueba y reserva stock para tus solicitudes.
            </p>
          </div>
        ) : (
          <>
            {/* Activas */}
            {active.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Activas ({active.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {active.map((r) => (
                    <div
                      key={r.id}
                      className={`bg-white border rounded-xl p-5 ${
                        r.status === "CONFIRMED" ? "border-green-200" : "border-yellow-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <StatusBadge status={r.status} />
                        <span className="font-mono text-lg font-bold text-gray-900">
                          {r.quantity} uds.
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 mb-1">{r.material_id}</p>
                      <p className="text-xs text-gray-500">Almacén: {r.warehouse_id}</p>
                      <p className="text-xs text-gray-400 mt-2">Creada: {fmt(r.created_at)}</p>
                      <ExpiryInfo expires_at={r.expires_at} status={r.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historial */}
            {history.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Historial ({history.length})
                </p>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cantidad</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Creada</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiró</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-gray-800">{r.quantity}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{fmt(r.created_at)}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{fmt(r.expires_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
