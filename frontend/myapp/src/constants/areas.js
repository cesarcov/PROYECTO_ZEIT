// Áreas funcionales del ERP — espejo de `app/core/areas.py`.
//
// El backend cierra con 404 las rutas de las áreas que aún no se han soltado;
// aquí se decide qué NO mostrar en el sidebar, para que el usuario no vea
// enlaces que le van a dar error.
//
// Si cambias AREAS en el backend, cambia este archivo. El test
// `tests/test_beta_gate.py::test_el_frontend_conoce_las_mismas_areas`
// comprueba que los dos catálogos no se desincronicen.

// Área -> prefijos de ruta del FRONTEND que le pertenecen.
// Ojo: no son los mismos prefijos que en el backend. Hay páginas que viven
// bajo /admin pero consultan un backend de otra área (p. ej.
// /admin/planificacion llama a /planificacion), y por eso se mapean al área
// de la que realmente dependen.
export const AREA_RUTAS = {
  logistica: ["/logistics", "/materials"],
  admin: ["/admin/users", "/admin/roles", "/admin/audit", "/admin/reporting", "/admin/branding"],
  solicitudes: ["/requests", "/reservations"],

  operaciones: ["/operations", "/operaciones"],
  cotizaciones: ["/cotizaciones"],
  compras: ["/compras"],
  clientes: ["/clientes", "/admin/clientes-dashboard"],
  canal: ["/canal"],
  gerencia: ["/gerencia"],
  planificacion: ["/admin/planificacion", "/admin/productividad", "/admin/recursos-humanos"],
  requerimientos: ["/admin/requerimientos"],
};

export const AREA_LABELS = {
  logistica: "Logística",
  admin: "Administración",
  solicitudes: "Solicitudes",
  operaciones: "Operaciones",
  cotizaciones: "Cotizaciones",
  compras: "Compras",
  clientes: "Clientes",
  canal: "Canal",
  gerencia: "Gerencia",
  planificacion: "Planificación",
  requerimientos: "Requerimientos",
};

// Rutas transversales que nunca se ocultan.
const SIEMPRE_VISIBLES = ["/inicio", "/dashboard", "/perfil", "/preferencias", "/"];

function coincide(ruta, prefijo) {
  // Comparación por segmento: "/clientes" cubre "/clientes/7" pero no
  // "/clientesfalsos". Se ignora la query string.
  const limpia = ruta.split("?")[0];
  return limpia === prefijo || limpia.startsWith(prefijo + "/");
}

/** Área a la que pertenece una ruta del frontend, o null si es transversal. */
export function areaDeRuta(ruta) {
  if (SIEMPRE_VISIBLES.some((p) => coincide(ruta, p))) return null;

  // Prefijo más largo primero, para que /admin/planificacion gane sobre /admin.
  const pares = Object.entries(AREA_RUTAS)
    .flatMap(([area, prefijos]) => prefijos.map((p) => [p, area]))
    .sort((a, b) => b[0].length - a[0].length);

  for (const [prefijo, area] of pares) {
    if (coincide(ruta, prefijo)) return area;
  }
  return null;
}

/**
 * ¿Esta ruta está oculta para el usuario actual?
 * Oculta = pertenece a un área sin soltar y el usuario no es beta tester.
 */
export function rutaEstaOculta(ruta, auth) {
  if (auth?.esBetaTester) return false;
  const beta = auth?.modulosBeta;
  if (!Array.isArray(beta) || beta.length === 0) return false;
  const area = areaDeRuta(ruta);
  return area !== null && beta.includes(area);
}

/** ¿El usuario puede ver algo de esta área? */
export function areaEstaOculta(area, auth) {
  if (auth?.esBetaTester) return false;
  const beta = auth?.modulosBeta;
  if (!Array.isArray(beta)) return false;
  return beta.includes(area);
}
