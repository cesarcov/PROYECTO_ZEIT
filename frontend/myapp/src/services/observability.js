// Observabilidad del frontend — F-000 / T-04.
//
// Sentry es OPCIONAL: sin VITE_SENTRY_DSN todo aquí es un no-op y la app se
// comporta igual que antes. Nunca se rompe el arranque por culpa de la
// telemetría.
//
// La correlación con el backend se hace por `request_id`: cada error de API
// que el backend devuelve trae ese identificador (cabecera X-Request-ID y
// campo error.request_id). Al reportarlo aquí como tag, el mismo id aparece
// en el panel de Sentry del frontend y del backend.
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN ?? "";

let activo = false;

export function initObservability() {
  if (!DSN) return false;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_ENV ?? import.meta.env.MODE,
    release: import.meta.env.VITE_GIT_COMMIT ?? "dev",
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // No enviar datos personales ni cuerpos de petición: el ERP maneja datos
    // de clientes y de personal.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) delete event.request.headers.Authorization;
      return event;
    },
  });

  activo = true;
  return true;
}

// Reporta un error de API ligándolo al request_id que devolvió el backend.
export function reportApiError(error) {
  if (!activo) return;
  Sentry.withScope((scope) => {
    if (error?.requestId) scope.setTag("request_id", error.requestId);
    if (error?.code) scope.setTag("error_code", error.code);
    if (error?.status) scope.setTag("http_status", String(error.status));
    Sentry.captureException(error);
  });
}

export { Sentry };
