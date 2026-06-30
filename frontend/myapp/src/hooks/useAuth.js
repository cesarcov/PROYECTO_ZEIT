function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function useAuth() {
  const token = localStorage.getItem("access_token");

  const empty = {
    isAuthenticated: false,
    userId: null,
    role: null,
    permissions: [],
    isAdmin: false,
    can: () => false,
    hasPermission: () => false,
  };

  if (!token) return empty;

  const payload = decodeJwt(token);
  if (!payload) return empty;

  // Token expirado → limpiar sesión
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    localStorage.clear();
    return empty;
  }

  const permissions = payload.permissions || [];
  const isSuperadmin = payload.role === "superadmin";
  const isAdmin = isSuperadmin || permissions.some((p) => p.startsWith("admin:"));
  const role = localStorage.getItem("role") || payload.primary_module || "operations";
  const username = localStorage.getItem("username") || payload.sub || "usuario";

  // modules: lista de módulos accesibles del usuario (multi-rol)
  const storedModules = localStorage.getItem("modules");
  const modules = (storedModules ? JSON.parse(storedModules) : null)
    || payload.modules
    || [role];

  // blocks: lista de bloques asignados o "all" para superadmin
  const storedBlocks = localStorage.getItem("blocks");
  const blocks = isSuperadmin
    ? "all"
    : ((storedBlocks ? JSON.parse(storedBlocks) : null) || payload.blocks || []);

  return {
    isAuthenticated: true,
    userId: payload.sub,
    username,
    role,
    modules,
    blocks,
    permissions,
    isAdmin,
    isSuperadmin,
    can: (prefix) => isAdmin || permissions.some((p) => p.startsWith(prefix)),
    hasPermission: (exact) => isAdmin || permissions.includes(exact),
    canExact: (exact) => permissions.includes(exact),
    canEditBlock: (slug) => {
      if (isSuperadmin) return true;
      const block = (Array.isArray(blocks) ? blocks : []).find((b) => b.slug === slug);
      return block?.level === "edit";
    },
  };
}

export function formatUsername(uname) {
  if (!uname) return "";
  const lower = uname.toLowerCase();
  if (lower === "admin") return "TI - Ceshark";
  
  const DISPLAY_NAME_MAP = {
    frank_sonco: "Frank Sonco",
    juliet_alvis: "Juliet Alvis",
    yasmyn_machuca: "Yasmyn Machuca",
    wilfredo_flores: "Wilfredo Flores",
    cesar_huamani: "Cesar Huamani",
    felipe_choque: "Felipe Choque",
    lagartija_segura: "Lagartija Segura",
    tiburoncito_junior: "Tiburoncito Junior",
  };
  
  if (DISPLAY_NAME_MAP[lower]) {
    return DISPLAY_NAME_MAP[lower];
  }
  
  return uname
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

