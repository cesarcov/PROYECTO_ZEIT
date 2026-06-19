import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, requirePermission }) {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requirePermission && !auth.can(requirePermission)) {
    const homeRoute =
      auth.role === "admin"
        ? "/admin"
        : auth.role === "logistics"
        ? "/logistics"
        : auth.role === "gerente"
        ? "/gerencia/aprobaciones"
        : auth.role === "administracion"
        ? "/admin/audit"
        : "/operations";

    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4fafb]">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-sm w-full mx-4">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso denegado</h2>
          <p className="text-gray-500 text-sm mb-6">
            Tu rol <span className="font-medium text-gray-700 capitalize">({auth.role})</span> no
            tiene permisos para acceder a esta sección.
          </p>
          <Link
            to={homeRoute}
            className="inline-block bg-w-dark text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-w-deep transition"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
