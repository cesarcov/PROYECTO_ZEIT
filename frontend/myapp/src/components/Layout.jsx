import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, formatUsername } from "../hooks/useAuth";
import { BLOCK_TO_MODULES } from "../constants/blocks";
import ZeitLogo from "./ZeitLogo";
import { BASE_URL } from "../services/api";

// ── Iconos SVG monocromáticos (Feather-style) ─────────────────────────────────
function Icon({ name, size = 16 }) {
  const s = { width: size, height: size, flexShrink: 0 };
  const props = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  };

  const icons = {
    home:       <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    layers:     <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    package:    <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    barChart:   <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    arrowsLR:   <><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="3" y2="7"/><polyline points="7 21 3 17 7 13"/><line x1="3" y1="17" x2="21" y2="17"/></>,
    building:   <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    wrench:     <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>,
    folder:     <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
    lock:       <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    clipboard:  <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>,
    download:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    users:      <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield:     <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    eye:        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    settings:   <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    power:      <><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></>,
    chevronR:   <><polyline points="9 18 15 12 9 6"/></>,
    chevronL:   <><polyline points="15 18 9 12 15 6"/></>,
    cart:       <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>,
    truck:      <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    inbox:      <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
    briefcase:  <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    shoppingBag:<><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
    fileText:   <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></>,
    search:     <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    bell:       <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    mail:       <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
  };

  return <svg style={s} {...props}>{icons[name] ?? icons.package}</svg>;
}

// ── Definición de módulos (icon = clave del Icon) ─────────────────────────────
const MODULES = [
  {
    key:   "logistics",
    label: "Logística",
    icon:  "layers",
    roles: ["admin", "logistics"],
    home:  "/logistics",
    groups: [
      {
        title: "Inventario",
        items: [
          { label: "Materiales",       icon: "package",   path: "/materials" },
          { label: "Stock",            icon: "barChart",  path: "/logistics/stock" },
          { label: "Movimientos",      icon: "arrowsLR",  path: "/logistics/movements" },
          { label: "Almacenes",        icon: "building",  path: "/logistics/warehouses" },
          { label: "Trazabilidad Lotes", icon: "layers",  path: "/logistics/lots" },
          { label: "Transferencias",   icon: "arrowsLR",  path: "/logistics/transfers" },
          { label: "Inv. Físico",      icon: "clipboard", path: "/logistics/physical-inventory" },
        ],
      },
      {
        title: "Equipos",
        items: [
          { label: "Herramientas",  icon: "wrench",    path: "/logistics/tools" },
          { label: "Proyectos",     icon: "folder",    path: "/logistics/projects" },
          { label: "Reservas",      icon: "lock",      path: "/logistics/reservations" },
        ],
      },
      {
        title: "OTs / Consumos",
        items: [
          { label: "OTs Activas",      icon: "wrench",    path: "/operaciones/ot" },
        ],
      },
      {
        title: "Compras",
        items: [
          { label: "Proveedores",    icon: "users",       path: "/compras/proveedores" },
          { label: "Órdenes Compra", icon: "shoppingBag", path: "/compras/oc" },
        ],
      },
      {
        title: "Solicitudes",
        items: [
          { label: "Panel Pedidos", icon: "clipboard", path: "/logistics/requests" },
          { label: "Importar",      icon: "download",  path: "/logistics/import" },
        ],
      },
      {
        title: "Despachos",
        items: [
          { label: "Despachos",     icon: "truck",     path: "/logistics/dispatch" },
        ],
      },
      {
        title: "Comunicación",
        items: [
          { label: "Canal Inter-Módulo", icon: "inbox", path: "/canal" },
        ],
      },
    ],
  },
  {
    key:   "operations",
    label: "Operaciones",
    icon:  "settings",
    roles: ["admin", "operations"],
    home:  "/operations",
    groups: [
      {
        title: "Mis Proyectos",
        items: [
          { label: "Mis Proyectos",    icon: "briefcase",  path: "/operations/plans" },
        ],
      },
      {
        title: "Órdenes de Trabajo",
        items: [
          { label: "Mis OTs",          icon: "wrench",     path: "/operaciones/ot" },
        ],
      },
      {
        title: "Cotizaciones",
        items: [
          { label: "Mis Cotizaciones", icon: "fileText",    path: "/cotizaciones" },
          { label: "Baúles APU",       icon: "package",     path: "/cotizaciones/baules" },
          { label: "Tarifas Personal", icon: "users",       path: "/cotizaciones/tarifas-personal" },
          { label: "Tarifas MO",       icon: "calculator",  path: "/cotizaciones/recursos-mo" },
          { label: "Clientes",         icon: "briefcase",   path: "/clientes" },
        ],
      },
      {
        title: "Compras",
        items: [
          { label: "Mis OCs",          icon: "shoppingBag", path: "/compras/oc?mis=true" },
        ],
      },
      {
        title: "Mis Actividades",
        items: [
          { label: "Req. de Compra",   icon: "shoppingBag", path: "/operations/requisition" },
          { label: "Mis Solicitudes",  icon: "clipboard",   path: "/requests/my" },
          { label: "Mis Reservas",     icon: "lock",        path: "/reservations/my" },
          { label: "Mis Entregas",     icon: "inbox",       path: "/operations/deliveries" },
        ],
      },
      {
        title: "Comunicación",
        items: [
          { label: "Canal Inter-Módulo", icon: "inbox", path: "/canal" },
        ],
      },
    ],
  },
  {
    key:   "admin",
    label: "Admin",
    icon:  "shield",
    roles: ["admin"],
    home:  "/admin",
    groups: [
      {
        title: "Sistema",
        items: [
          { label: "Usuarios",  icon: "users",      path: "/admin/users" },
          { label: "Roles",     icon: "shield",     path: "/admin/roles" },
          { label: "Auditoría", icon: "eye",        path: "/admin/audit" },
          { label: "Reportes",  icon: "trendingUp", path: "/admin/reporting" },
          { label: "Marca",     icon: "settings",   path: "/admin/branding" },
        ],
      },
      {
        title: "Gestión",
        items: [
          { label: "Planificación",  icon: "clipboard", path: "/admin/planificacion" },
          { label: "Productividad",  icon: "barChart",  path: "/admin/productividad" },
          { label: "Clientes",       icon: "briefcase",  path: "/admin/clientes-dashboard" },
          { label: "Recursos Humanos", icon: "users",     path: "/admin/recursos-humanos" },
          { label: "Requerimientos", icon: "fileText",  path: "/admin/requerimientos" },
        ],
      },
      {
        title: "Comunicación",
        items: [
          { label: "Canal Inter-Módulo", icon: "inbox", path: "/canal" },
        ],
      },
    ],
  },
  {
    key:   "administracion",
    label: "Administración",
    icon:  "briefcase",
    roles: ["administracion"],
    home:  "/admin/audit",
    groups: [
      {
        title: "Gestión",
        items: [
          { label: "Auditoría",      icon: "eye",        path: "/admin/audit" },
          { label: "Reportes KPI",   icon: "trendingUp", path: "/admin/reporting" },
          { label: "Planificación",  icon: "clipboard",  path: "/admin/planificacion" },
          { label: "Productividad",  icon: "barChart",   path: "/admin/productividad" },
          { label: "Clientes",       icon: "briefcase",  path: "/admin/clientes-dashboard" },
          { label: "Recursos Humanos", icon: "users",     path: "/admin/recursos-humanos" },
          { label: "Requerimientos", icon: "fileText",  path: "/admin/requerimientos" },
        ],
      },
      {
        title: "Comunicación",
        items: [
          { label: "Canal Inter-Módulo", icon: "inbox", path: "/canal" },
        ],
      },
    ],
  },
  {
    key:   "gerente",
    label: "Gerencia",
    icon:  "briefcase",
    roles: ["admin", "gerente"],
    home:  "/gerencia/aprobaciones",
    groups: [
      {
        title: "Control Gerencial",
        items: [
          { label: "Aprobaciones", icon: "clipboard", path: "/gerencia/aprobaciones" },
        ],
      },
      {
        title: "Reportes",
        items: [
          { label: "Reportes KPI", icon: "trendingUp", path: "/admin/reporting" },
        ],
      },
      {
        title: "Comunicación",
        items: [
          { label: "Canal Inter-Módulo", icon: "inbox", path: "/canal" },
        ],
      },
    ],
  },
];

const ROLE_LABELS = {
  admin:          "Administrador",
  logistics:      "Logística",
  operations:     "Operaciones",
  administracion: "Administración",
  gerente:        "Gerente General",
};

const PAGE_LABELS = {
  materials: "Materiales", stock: "Stock", movements: "Movimientos",
  warehouses: "Almacenes", tools: "Herramientas y Equipos",
  projects: "Proyectos", reservations: "Reservas", requests: "Solicitudes",
  import: "Importar", users: "Usuarios", roles: "Roles",
  audit: "Auditoría", reporting: "Reportes", my: "Mis solicitudes",
  requisition: "Requisición de materiales",
  dispatch: "Despachos", deliveries: "Mis entregas", purchases: "Lista de Compras",
  aprobaciones: "Aprobaciones de Gerencia",
  plans: "Mis proyectos",
  logistics: "Panel", operations: "Panel", admin: "Panel",
  proveedores: "Proveedores", oc: "Órdenes de Compra", compras: "Compras",
  "clientes-dashboard": "Panel de Clientes",
  "recursos-humanos": "Recursos Humanos",
  "requerimientos": "Requerimientos",
};

const WIDE  = 240;
const SLIM  = 64;
const BREAK = 900; // px — por debajo de esto colapsa automáticamente

export default function Layout({ children }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const auth      = useAuth();

  const [collapsed, setCollapsed]           = useState(() => window.innerWidth < BREAK);
  const [menuOpen,  setMenuOpen]            = useState(false);
  const [pendingMaterials, setPendingMaterials] = useState(0);
  const menuRef = useRef(null);

  const [userProfile, setUserProfile]       = useState(null);
  const [bellCount, setBellCount]           = useState(0);
  const [mailCount, setMailCount]           = useState(0);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState([]);
  const [searching, setSearching]           = useState(false);
  
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  const getAvatarSrc = (url) => {
    if (!url) return `${BASE_URL}/avatar-assets/default.png`;
    if (url.startsWith("data:image/")) return url;
    return `${BASE_URL}${url}`;
  };

  // Cargar perfil de usuario (avatar_url) y contadores dinámicos de notificaciones
  useEffect(() => {
    if (auth.isAuthenticated) {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}` };
      
      fetch(`${BASE_URL}/auth/me`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setUserProfile(data); });
        
      const fetchCounts = () => {
        fetch(`${BASE_URL}/planificacion/actividades/my-pending-count`, { headers })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setBellCount(data.count); })
          .catch(() => {});
          
        fetch(`${BASE_URL}/canal/solicitudes/pending-count`, { headers })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setMailCount(data.count); })
          .catch(() => {});
      };
      
      fetchCounts();
      const interval = setInterval(fetchCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [auth.isAuthenticated]);

  // Listener para Ctrl+K y Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
          setSearchDropdownOpen(true);
        }
      }
      if (e.key === "Escape") {
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
        setSearchDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Consultar buscador reactivo con debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const token = localStorage.getItem("access_token");
    const delayDebounceFn = setTimeout(() => {
      fetch(`${BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setSearchResults(data.results);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Cargar contador de materiales pendientes (solo para roles logística / admin)
  useEffect(() => {
    const mods = auth.modules || [auth.role];
    if (!mods.some(m => m === "logistics" || m === "admin")) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;
    fetch(`${BASE_URL}/logistics/materials/pending-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setPendingMaterials(d.count ?? 0))
      .catch(() => {});
  }, [auth.role]);

  // Auto-colapsa cuando la ventana se hace pequeña; expande cuando vuelve a ser grande
  useEffect(() => {
    const handle = () => setCollapsed(window.innerWidth < BREAK);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Cierra el menú de usuario y el buscador al hacer clic fuera
  useEffect(() => {
    const handle = (e) => { 
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); 
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) setSearchDropdownOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const W = collapsed ? SLIM : WIDE;

  const visibleModules = (auth.role === "superadmin" || auth.role === "admin")
    ? MODULES
    : MODULES.filter((m) =>
        (Array.isArray(auth.blocks) ? auth.blocks : []).some(
          (b) => BLOCK_TO_MODULES[b.slug]?.includes(m.key)
        )
      );

  const activeModule =
    visibleModules.find((m) =>
      m.groups.some((g) => g.items.some((i) => location.pathname.startsWith(i.path))) ||
      location.pathname.startsWith(m.home)
    ) ||
    visibleModules.find((m) => m.roles.includes(auth.role)) ||
    visibleModules[0] ||
    MODULES[0];

  const handleStopImpersonation = () => {
    const adminAccess = sessionStorage.getItem("admin_access_token");
    const adminRefresh = sessionStorage.getItem("admin_refresh_token");
    const adminUsername = sessionStorage.getItem("admin_username");

    if (adminAccess) {
      localStorage.setItem("access_token", adminAccess);
      if (adminRefresh) {
        localStorage.setItem("refresh_token", adminRefresh);
      } else {
        localStorage.removeItem("refresh_token");
      }
      if (adminUsername) {
        localStorage.setItem("username", adminUsername);
      } else {
        localStorage.setItem("username", "admin");
      }
      
      sessionStorage.removeItem("admin_access_token");
      sessionStorage.removeItem("admin_refresh_token");
      sessionStorage.removeItem("admin_username");
      
      window.location.href = "/admin/users";
    }
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    sessionStorage.removeItem("admin_access_token");
    sessionStorage.removeItem("admin_refresh_token");
    sessionStorage.removeItem("admin_username");
    localStorage.clear();
    navigate("/");
  };

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const segments = location.pathname.split("/").filter(Boolean);
  const lastSeg  = segments[segments.length - 1];
  const pageName = PAGE_LABELS[lastSeg] ||
    (lastSeg ? lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1) : null);

  // ── Tooltip para modo colapsado ───────────────────────────────────────────
  const TIP = ({ label, children }) => {
    const [show, setShow] = useState(false);
    if (!collapsed) return children;
    return (
      <div style={{ position: "relative" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
        {show && (
          <span style={{
            position: "absolute", left: "calc(100% + 10px)", top: "50%", transform: "translateY(-50%)",
            background: "var(--primary)", color: "white", fontSize: 11, fontWeight: 600,
            padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap", pointerEvents: "none",
            zIndex: 99, boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}>
            {label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {sessionStorage.getItem("admin_access_token") && (
        <div style={{
          background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
          color: "white",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          position: "sticky",
          top: 0,
          zIndex: 2000,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span>
            <span>MODO IMPERSONACIÓN ACTIVO: Viendo el sistema como <strong>{formatUsername(auth.username)}</strong></span>
          </span>
          <button
            onClick={handleStopImpersonation}
            style={{
              background: "white",
              color: "#DC2626",
              border: "none",
              padding: "6px 14px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
              transition: "transform 0.1s, opacity 0.1s",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
          >
            Detener Impersonación
          </button>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: W,
        background: "var(--sidebar-bg)",
        display: "flex", flexDirection: "column", zIndex: 40,
        boxShadow: "2px 0 20px rgba(0,0,0,0.25)",
        transition: "width 0.22s ease",
        overflow: "hidden",
      }}>
        {/* Franja superior */}
        <div style={{ height: 3, flexShrink: 0, background: "linear-gradient(90deg, var(--primary), var(--accent), var(--primary))" }} />

        {/* Logo */}
        <div
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          style={{
            padding: collapsed ? "14px 0" : "16px 12px 12px",
            flexShrink: 0, display: "flex", alignItems: "center",
            justifyContent: "center",
            cursor: "pointer", userSelect: "none",
          }}
        >
          {collapsed
            ? <ZeitLogo size={32} onDark />
            : <ZeitLogo width={140} onDark showText />}
        </div>

        {/* Módulos */}
        {visibleModules.length > 1 && (
          <div style={{ padding: collapsed ? "0 8px 10px" : "0 10px 10px", flexShrink: 0 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(199,210,229,0.6)", padding: "0 8px", marginBottom: 5 }}>
                Módulos
              </div>
            )}
            {visibleModules.map((mod) => {
              const isMod = activeModule.key === mod.key;
              return (
                <TIP key={mod.key} label={mod.label}>
                  <Link to={mod.home} style={{
                    display: "flex", alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    gap: collapsed ? 0 : 9,
                    padding: collapsed ? "8px 0" : "7px 10px",
                    borderRadius: 9, marginBottom: 2,
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                    transition: "background 0.15s",
                    background: isMod ? "rgba(255,255,255,0.13)" : "transparent",
                    color: isMod ? "white" : "rgba(199,210,229,0.6)",
                    border: isMod ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                    position: "relative",
                  }}
                    onMouseEnter={(e) => { if (!isMod) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onMouseLeave={(e) => { if (!isMod) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Icon name={mod.icon} size={16} />
                    {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{mod.label}</span>}
                    {!collapsed && isMod && (
                      <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                    )}
                    {collapsed && isMod && (
                      <span style={{ position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 99, background: "var(--accent)" }} />
                    )}
                  </Link>
                </TIP>
              );
            })}
          </div>
        )}

        {/* Botón Inicio — visible para todos */}
        <div style={{ padding: collapsed ? "0 8px 6px" : "0 10px 6px", flexShrink: 0 }}>
          <TIP label="Inicio">
            <Link to="/inicio" style={{
              display: "flex", alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 9,
              padding: collapsed ? "8px 0" : "7px 10px",
              borderRadius: 9, textDecoration: "none", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
              background: location.pathname === "/inicio" ? "white" : "rgba(255,255,255,0.08)",
              color: location.pathname === "/inicio" ? "var(--primary)" : "var(--sidebar-text)",
              boxShadow: location.pathname === "/inicio" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              border: location.pathname === "/inicio" ? "none" : "1px solid rgba(255,255,255,0.1)",
            }}
              onMouseEnter={(e) => { if (location.pathname !== "/inicio") e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
              onMouseLeave={(e) => { if (location.pathname !== "/inicio") e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              <Icon name="home" size={15} />
              {!collapsed && <span style={{ whiteSpace: "nowrap" }}>Inicio</span>}
            </Link>
          </TIP>
        </div>

        {/* Divisor */}
        <div style={{ margin: "0 12px 10px", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />

        {/* Sub-nav */}
        {visibleModules.length === 0 && auth.role !== "superadmin" && auth.role !== "admin" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", textAlign: "center" }}>
            {!collapsed && (
              <>
                <div style={{ fontSize: 22, marginBottom: 10, opacity: 0.5 }}>🔒</div>
                <div style={{ color: "rgba(199,210,229,0.7)", fontSize: 11, fontWeight: 600, lineHeight: 1.5 }}>
                  Sin módulos asignados
                </div>
                <div style={{ color: "rgba(199,210,229,0.45)", fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
                  Contacta al TI para que te asigne acceso
                </div>
              </>
            )}
          </div>
        ) : (
        <nav style={{ flex: 1, padding: collapsed ? "0 8px" : "0 10px", overflowY: "auto", scrollbarWidth: "none" }}>
          {activeModule.groups.map((group, gi) => (
            <div key={group.title} style={{ marginBottom: gi < activeModule.groups.length - 1 ? 18 : 10 }}>
              {!collapsed && (
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(199,210,229,0.55)", padding: "0 8px", marginBottom: 3 }}>
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <TIP key={item.path} label={item.label}>
                    <Link to={item.path} style={{
                      display: "flex", alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: collapsed ? 0 : 9,
                      padding: collapsed ? "9px 0" : "7px 10px",
                      borderRadius: 9, marginBottom: 2,
                      fontSize: 13, textDecoration: "none",
                      transition: "all 0.15s",
                      background: active ? "white" : "transparent",
                      color: active ? "var(--primary)" : "rgba(199,210,229,0.75)",
                      boxShadow: active ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                      fontWeight: active ? 600 : 500,
                    }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <Icon name={item.icon} size={15} />
                      {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                      {!collapsed && item.path === "/materials" && pendingMaterials > 0 && (
                        <span style={{ marginLeft: "auto", background: "#EAB308", color: "white", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 800, lineHeight: "16px", flexShrink: 0 }}>
                          {pendingMaterials}
                        </span>
                      )}
                    </Link>
                  </TIP>
                );
              })}
            </div>
          ))}
        </nav>
        )}

        {/* Usuario + Logout */}
        <div style={{ padding: collapsed ? "10px 8px" : "10px 10px", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", marginBottom: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, var(--primary), var(--sidebar-bg))",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                  {auth.role?.charAt(0)}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "white", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ROLE_LABELS[auth.role] || auth.role}
                </div>
                <div style={{ color: "rgba(199,210,229,0.6)", fontSize: 10 }}>Sesión activa</div>
              </div>
            </div>
          )}
          <TIP label="Cerrar sesión">
            <button onClick={handleLogout} style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 8,
              padding: collapsed ? "9px 0" : "7px 10px",
              borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 500, background: "transparent",
              color: "rgba(199,210,229,0.55)", transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(199,210,229,0.55)"; }}
            >
              <Icon name="power" size={15} />
              {!collapsed && <span>Cerrar sesión</span>}
            </button>
          </TIP>
          {!collapsed && (
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 9.5, color: "rgba(199,210,229,0.6)", letterSpacing: "0.04em" }}>
              Powered by <strong style={{ fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>CeShark</strong> · ERP Engine
            </div>
          )}
        </div>
      </aside>

      {/* ── Área principal ────────────────────────────────────────────────────── */}
      <div style={{ marginLeft: W, minHeight: "100vh", display: "flex", flexDirection: "column", transition: "margin-left 0.22s ease" }}>

        {/* Topbar */}
        <header style={{
          position: "sticky", top: 0, zIndex: 30,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          padding: "0 24px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          {/* Lado izquierdo: Breadcrumbs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--surface-2)", padding: "5px 12px", borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: "var(--text)",
            }}>
              <Icon name={activeModule.icon} size={14} />
              <span>{activeModule.label}</span>
            </div>
            {pageName && segments.length > 0 && (
              <>
                <span style={{ color: "#D1D5DB", fontSize: 16 }}>›</span>
                <span style={{ color: "#6B7280", fontSize: 13, fontWeight: 500 }}>{pageName}</span>
              </>
            )}
          </div>

          {/* Lado derecho: Buscador + Notificaciones + Perfil */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            
            {/* Buscador de cabecera en línea */}
            <div 
              ref={searchContainerRef}
              style={{ position: "relative" }}
            >
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="Buscar en el sistema..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSearchDropdownOpen(true);
                }}
                onFocus={() => setSearchDropdownOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#F1F5F9",
                  border: searchDropdownOpen ? "1.5px solid var(--primary)" : "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "6px 12px 6px 34px",
                  width: 380, // Aumentado a 380px como solicitado
                  height: 34,
                  fontSize: 13,
                  color: "#1E293B",
                  outline: "none",
                  transition: "all 0.15s ease",
                }}
              />
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748B", pointerEvents: "none", display: "flex", alignItems: "center" }}>
                <Icon name="search" size={14} />
              </div>
              
              {/* Atajo Ctrl+K más sutil */}
              {!searchQuery && (
                <div style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#94A3B8", // Más sutil
                  opacity: 0.7,
                  background: "transparent",
                  userSelect: "none"
                }}>
                  Ctrl+K
                </div>
              )}

              {/* Autocomplete Dropdown */}
              {searchDropdownOpen && searchQuery.trim().length >= 2 && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  width: "100%",
                  background: "white",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                  zIndex: 999,
                  maxHeight: 350,
                  overflowY: "auto",
                  padding: "8px 0"
                }}>
                  {searching ? (
                    <div style={{ padding: "16px 20px", color: "#64748B", fontSize: 13, textAlign: "center" }}>
                      Buscando...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: "16px 20px", color: "#64748B", fontSize: 13, textAlign: "center" }}>
                      No se encontraron resultados para "{searchQuery}"
                    </div>
                  ) : (
                    // Agrupar resultados por categoría
                    Object.entries(
                      searchResults.reduce((acc, curr) => {
                        if (!acc[curr.category]) acc[curr.category] = [];
                        acc[curr.category].push(curr);
                        return acc;
                      }, {})
                    ).map(([category, items]) => (
                      <div key={category} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <div style={{
                          padding: "6px 14px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#94A3B8",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          background: "#F8FAFC"
                        }}>
                          {category}
                        </div>
                        <div style={{ padding: "4px 0" }}>
                          {items.map((item, idx) => (
                            <Link
                              key={idx}
                              to={item.link}
                              onClick={() => {
                                setSearchQuery("");
                                setSearchDropdownOpen(false);
                              }}
                              style={{
                                display: "block",
                                padding: "8px 14px",
                                textDecoration: "none",
                                transition: "background 0.1s"
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                {item.subtitle}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Icono de Mensajes (Envelope) */}
            <Link to="/canal" style={{ position: "relative", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Icon name="mail" size={18} />
              {mailCount > 0 && (
                <span style={{
                  position: "absolute", top: -2, right: -2,
                  background: "#EF4444", color: "white", fontSize: 10, fontWeight: 700,
                  borderRadius: "50%", minWidth: 16, height: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px", border: "2px solid white"
                }}>
                  {mailCount}
                </span>
              )}
            </Link>

            {/* Icono de Notificaciones (Bell) */}
            <Link to="/operaciones/ot" style={{ position: "relative", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Icon name="bell" size={18} />
              {bellCount > 0 && (
                <span style={{
                  position: "absolute", top: -2, right: -2,
                  background: "#F59E0B", color: "white", fontSize: 10, fontWeight: 700,
                  borderRadius: "50%", minWidth: 16, height: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px", border: "2px solid white"
                }}>
                  {bellCount}
                </span>
              )}
            </Link>

            {/* Separador vertical */}
            <div style={{ width: 1, height: 20, background: "#E2E8F0" }}></div>

            {/* Chip de usuario con dropdown */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  background: menuOpen ? "#F0F4F8" : "transparent",
                  border: "none",
                  borderRadius: 12, padding: "4px 8px 4px 4px",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = "#F1F5F9"; }}
                onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar circular */}
                <img 
                  src={getAvatarSrc(userProfile?.avatar_url)} 
                  alt="avatar" 
                  style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid #CBD5E1" }} 
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: 1 }}>
                  <span style={{ color: "#1E293B", fontSize: 12, fontWeight: 700 }}>
                    {formatUsername(auth.username)}
                  </span>
                  <span style={{ color: "#64748B", fontSize: 10, fontWeight: 500 }}>
                    {ROLE_LABELS[auth.role] || auth.role}
                  </span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

            {/* Dropdown */}
            {menuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: 240, background: "white",
                border: "1px solid #E5E7EB", borderRadius: 14,
                boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                zIndex: 50, overflow: "hidden",
              }}>
                {/* Header usuario */}
                <div style={{ padding: "14px 16px", background: "linear-gradient(135deg, var(--sidebar-bg), var(--primary))" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <ZeitLogo width={110} onDark showText />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img 
                      src={getAvatarSrc(userProfile?.avatar_url)} 
                      alt="avatar dropdown" 
                      style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.4)" }} 
                    />
                    <div>
                      <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>
                        {formatUsername(auth.username)}
                      </p>
                      <p style={{ color: "rgba(199,210,229,0.55)", fontSize: 11, margin: "2px 0 0" }}>
                        {ROLE_LABELS[auth.role] || auth.role}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Módulo activo */}
                <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "#F9FAFB" }}>
                    <Icon name={activeModule.icon} size={13} />
                    <div>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Módulo activo</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "1px 0 0" }}>{activeModule.label}</p>
                    </div>
                  </div>
                </div>

                {/* Opciones */}
                <div style={{ padding: "6px 10px" }}>
                  {[
                    { icon: "users",    label: "Mi cuenta",       sub: "Información del perfil",     link: "/profile" },
                    { icon: "settings", label: "Preferencias",    sub: "Ajustes de la sesión",       link: "/preferences" },
                    { icon: "eye",      label: "Auditoría",        sub: "Ver registro de actividad",  link: "/admin/audit" },
                    { icon: "barChart", label: "Reportes KPI",    sub: "Indicadores del sistema",    link: "/admin/reporting" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { setMenuOpen(false); if (item.link) navigate(item.link); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 8px", borderRadius: 8, border: "none",
                        background: "transparent", cursor: "pointer", textAlign: "left",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F3F4F6"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--primary)",
                      }}>
                        <Icon name={item.icon} size={14} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1F2937", margin: 0 }}>{item.label}</p>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>{item.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Cerrar sesión */}
                <div style={{ padding: "6px 10px 10px", borderTop: "1px solid #F3F4F6" }}>
                  <button
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8, border: "none",
                      background: "#FEF2F2", cursor: "pointer", textAlign: "left",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#FEE2E2"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#FEF2F2"}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: "rgba(220,38,38,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#DC2626",
                    }}>
                      <Icon name="power" size={14} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", margin: 0 }}>Cerrar sesión</p>
                      <p style={{ fontSize: 11, color: "#F87171", margin: "1px 0 0" }}>Terminar esta sesión</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

        {/* Contenido */}
        <main style={{ flex: 1, padding: 24 }}>
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
            padding: 24,
            minHeight: "calc(100vh - 56px - 48px)",
          }}>
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
