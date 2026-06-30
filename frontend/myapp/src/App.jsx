import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Materials from "./pages/Materials";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import SuperadminUserBlocks from "./pages/admin/SuperadminUserBlocks";
import AdminBranding from "./pages/admin/AdminBranding";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminCategoriasCosto from "./pages/admin/AdminCategoriasCosto";
import ReportingKPIs from "./pages/admin/ReportingKPIs";
import LogisticsDashboard from "./pages/logistics/LogisticsDashboard";
import StockView from "./pages/logistics/StockView";
import ReservationsView from "./pages/logistics/ReservationsView";
import WarehousesView from "./pages/logistics/WarehousesView";
import WarehouseInventory from "./pages/logistics/WarehouseInventory";
import MovementsView from "./pages/logistics/MovementsView";
import ToolsView from "./pages/logistics/ToolsView";
import ProjectsView from "./pages/logistics/ProjectsView";
import ProjectDetail from "./pages/logistics/ProjectDetail";
import ImportView from "./pages/logistics/ImportView";
import OperationsDashboard from "./pages/operations/OperationsDashboard";
import MyReservations from "./pages/operations/MyReservations";
import RequisitionView from "./pages/operations/RequisitionView";
import MyDeliveries from "./pages/operations/MyDeliveries";
import DispatchView from "./pages/logistics/DispatchView";
import MyProjects from "./pages/operations/MyProjects";
import ProjectPlanView from "./pages/operations/ProjectPlanView";
import PurchaseListView from "./pages/logistics/PurchaseListView";
import MyRequests from "./pages/requests/MyRequests";
import AllRequests from "./pages/requests/AllRequests";
import Profile from "./pages/Profile";
import Preferences from "./pages/Preferences";
import ProtectedRoute from "./components/ProtectedRoute";
import LotsView from "./pages/logistics/LotsView";
import TransfersView from "./pages/logistics/TransfersView";
import PhysicalInventoryView from "./pages/logistics/PhysicalInventoryView";
import CanalView from "./pages/canal/CanalView";
import RecursosMOView from "./pages/cotizaciones/RecursosMOView";
import PresupuestoView from "./pages/cotizaciones/PresupuestoView";
import CotizacionesListView from "./pages/cotizaciones/CotizacionesListView";
import BaulesView from "./pages/cotizaciones/BaulesView";
import TarifasPersonalView from "./pages/cotizaciones/TarifasPersonalView";
import ClientesView from "./pages/clientes/ClientesView";
import OrdenesTrabajoView from "./pages/operaciones/OrdenesTrabajoView";
import OTDetailView from "./pages/operaciones/OTDetailView";
import ProveedoresView from "./pages/compras/ProveedoresView";
import OrdenesCompraView from "./pages/compras/OrdenesCompraView";
import OCDetailView from "./pages/compras/OCDetailView";
import HomeDashboard from "./pages/HomeDashboard";
import AdminPlanificacion from "./pages/admin/AdminPlanificacion";
import PlanificacionDetalle from "./pages/admin/PlanificacionDetalle";
import AdminProductividad from "./pages/admin/AdminProductividad";
import ClientesDashboard from "./pages/admin/ClientesDashboard";
import AprobacionesGerencia from "./pages/gerencia/AprobacionesGerencia";
import RecursosHumanos from "./pages/admin/RecursosHumanos";
import Requerimientos from "./pages/admin/Requerimientos";

function App() {
  return (
    <Router>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Login />} />

        {/* Redirect inteligente al dashboard del rol */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Inicio — visible para todos los roles autenticados */}
        <Route
          path="/inicio"
          element={
            <ProtectedRoute>
              <HomeDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requirePermission="admin:">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requirePermission="admin:">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/users"
          element={
            <ProtectedRoute requirePermission="admin:">
              <SuperadminUserBlocks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/branding"
          element={
            <ProtectedRoute requirePermission="admin:">
              <AdminBranding />
            </ProtectedRoute>
          }
        />

        {/* Logística */}
        <Route
          path="/logistics"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <LogisticsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/materials"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <Materials />
            </ProtectedRoute>
          }
        />

        {/* Operaciones — cualquier usuario autenticado */}
        <Route
          path="/operations"
          element={
            <ProtectedRoute>
              <OperationsDashboard />
            </ProtectedRoute>
          }
        />

        {/* Solicitudes — mi vista (operaciones) */}
        <Route
          path="/requests/my"
          element={
            <ProtectedRoute>
              <MyRequests />
            </ProtectedRoute>
          }
        />

        {/* Solicitudes — panel logística (ver todas + aprobar/rechazar) */}
        <Route
          path="/logistics/requests"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <AllRequests />
            </ProtectedRoute>
          }
        />

        {/* Stock disponible */}
        <Route
          path="/logistics/stock"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <StockView />
            </ProtectedRoute>
          }
        />

        {/* Reservas de stock (logistics) */}
        <Route
          path="/logistics/reservations"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <ReservationsView />
            </ProtectedRoute>
          }
        />

        {/* Auditoría (admin) */}
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute requirePermission="admin:">
              <AdminAudit />
            </ProtectedRoute>
          }
        />

        {/* Roles y permisos (admin) */}
        <Route
          path="/admin/roles"
          element={
            <ProtectedRoute requirePermission="admin:">
              <AdminRoles />
            </ProtectedRoute>
          }
        />

        {/* Planificación Semanal (admin / administracion / gerente) */}
        <Route
          path="/admin/planificacion"
          element={
            <ProtectedRoute requirePermission="planificacion:">
              <AdminPlanificacion />
            </ProtectedRoute>
          }
        />

        {/* Detalle de Actividad — página dedicada (reemplaza al modal flotante) */}
        <Route
          path="/admin/planificacion/:id"
          element={
            <ProtectedRoute requirePermission="planificacion:">
              <PlanificacionDetalle />
            </ProtectedRoute>
          }
        />

        {/* Productividad (admin / administracion / gerente) */}
        <Route
          path="/admin/productividad"
          element={
            <ProtectedRoute requirePermission="planificacion:">
              <AdminProductividad />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clientes-dashboard"
          element={
            <ProtectedRoute requirePermission="planificacion:">
              <ClientesDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/recursos-humanos"
          element={
            <ProtectedRoute requirePermission="planificacion:">
              <RecursosHumanos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/requerimientos"
          element={
            <ProtectedRoute requirePermission="planificacion:">
              <Requerimientos />
            </ProtectedRoute>
          }
        />

        {/* Categorías de costo (admin) */}
        <Route
          path="/admin/categorias-costo"
          element={
            <ProtectedRoute requirePermission="admin:">
              <AdminCategoriasCosto />
            </ProtectedRoute>
          }
        />

        {/* Reportes KPIs (admin / administracion / gerente) */}
        <Route
          path="/admin/reporting"
          element={
            <ProtectedRoute requirePermission="reporting:">
              <ReportingKPIs />
            </ProtectedRoute>
          }
        />

        {/* Almacenes — lista */}
        <Route
          path="/logistics/warehouses"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <WarehousesView />
            </ProtectedRoute>
          }
        />

        {/* Almacén — inventario detallado */}
        <Route
          path="/logistics/warehouses/:warehouseId"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <WarehouseInventory />
            </ProtectedRoute>
          }
        />

        {/* Movimientos de stock */}
        <Route
          path="/logistics/movements"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <MovementsView />
            </ProtectedRoute>
          }
        />

        {/* Equipos y herramientas */}
        <Route
          path="/logistics/tools"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <ToolsView />
            </ProtectedRoute>
          }
        />

        {/* Proyectos — lista */}
        <Route
          path="/logistics/projects"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <ProjectsView />
            </ProtectedRoute>
          }
        />

        {/* Proyecto — detalle 360° */}
        <Route
          path="/logistics/projects/:projectId"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <ProjectDetail />
            </ProtectedRoute>
          }
        />

        {/* Importación masiva */}
        <Route
          path="/logistics/import"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <ImportView />
            </ProtectedRoute>
          }
        />

        {/* Despachos (logistics) */}
        <Route
          path="/logistics/dispatch"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <DispatchView />
            </ProtectedRoute>
          }
        />

        {/* Lista de compras (logistics) */}
        <Route
          path="/logistics/purchases"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <PurchaseListView />
            </ProtectedRoute>
          }
        />

        {/* Trazabilidad por Lote */}
        <Route
          path="/logistics/lots"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <LotsView />
            </ProtectedRoute>
          }
        />

        {/* Transferencias entre almacenes */}
        <Route
          path="/logistics/transfers"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <TransfersView />
            </ProtectedRoute>
          }
        />

        {/* Inventario físico */}
        <Route
          path="/logistics/physical-inventory"
          element={
            <ProtectedRoute requirePermission="logistics:">
              <PhysicalInventoryView />
            </ProtectedRoute>
          }
        />

        {/* Requisición de materiales (operations) */}
        <Route
          path="/operations/requisition"
          element={
            <ProtectedRoute>
              <RequisitionView />
            </ProtectedRoute>
          }
        />

        {/* Mis reservas (operations) */}
        <Route
          path="/reservations/my"
          element={
            <ProtectedRoute>
              <MyReservations />
            </ProtectedRoute>
          }
        />

        {/* Mis entregas (operations) */}
        <Route
          path="/operations/deliveries"
          element={
            <ProtectedRoute>
              <MyDeliveries />
            </ProtectedRoute>
          }
        />

        {/* Mis proyectos — lista */}
        <Route
          path="/operations/plans"
          element={
            <ProtectedRoute>
              <MyProjects />
            </ProtectedRoute>
          }
        />

        {/* Plan detalle */}
        <Route
          path="/operations/plans/:planId"
          element={
            <ProtectedRoute>
              <ProjectPlanView />
            </ProtectedRoute>
          }
        />

        {/* Canal inter-módulo — cualquier usuario autenticado */}
        <Route
          path="/canal"
          element={
            <ProtectedRoute>
              <CanalView />
            </ProtectedRoute>
          }
        />

        {/* Cotizaciones / APU */}
        <Route
          path="/cotizaciones"
          element={
            <ProtectedRoute>
              <CotizacionesListView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cotizaciones/recursos-mo"
          element={
            <ProtectedRoute>
              <RecursosMOView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cotizaciones/baules"
          element={
            <ProtectedRoute>
              <BaulesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cotizaciones/tarifas-personal"
          element={
            <ProtectedRoute>
              <TarifasPersonalView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations/plans/:planId/presupuesto"
          element={
            <ProtectedRoute>
              <PresupuestoView />
            </ProtectedRoute>
          }
        />

        {/* Clientes */}
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <ClientesView />
            </ProtectedRoute>
          }
        />

        {/* Órdenes de Trabajo — Fase 2 */}
        <Route
          path="/operaciones/ot"
          element={
            <ProtectedRoute>
              <OrdenesTrabajoView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operaciones/ot/:otId"
          element={
            <ProtectedRoute>
              <OTDetailView />
            </ProtectedRoute>
          }
        />

        {/* Compras — Fase 3 */}
        <Route
          path="/compras/proveedores"
          element={
            <ProtectedRoute>
              <ProveedoresView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compras/oc"
          element={
            <ProtectedRoute>
              <OrdenesCompraView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compras/oc/:ocId"
          element={
            <ProtectedRoute>
              <OCDetailView />
            </ProtectedRoute>
          }
        />

        {/* Perfil y preferencias — cualquier usuario autenticado */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/preferences"
          element={
            <ProtectedRoute>
              <Preferences />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gerencia/aprobaciones"
          element={
            <ProtectedRoute>
              <AprobacionesGerencia />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
