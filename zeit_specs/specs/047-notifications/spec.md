# [F-047] Sistema de notificaciones transversal

- **Estado:** APROBADA
- **Autor:** Plan Maestro SDD
- **Fecha:** 2026-08-05
- **Módulos afectados:** `notifications` (nuevo) + hooks en `gerencia`, `requests`, `logistics`, `finance`
- **Migración asignada:** 047

## 1. Problema

Hoy las aprobaciones y solicitudes funcionan por *polling humano*: el gerente
debe entrar al panel para descubrir que tiene algo pendiente. En la práctica,
esto convierte cada flujo de aprobación en un cuello de botella de horas o días
que depende de la memoria de las personas.

## 2. Historias de usuario

- **HU-1:** Como usuario, quiero ver una campana con mis notificaciones no leídas
  en el header, para enterarme sin salir de lo que estoy haciendo.
  - **CA-1.1:** DADO que ocurre un evento que me concierne, CUANDO estoy con la
    app abierta, ENTONCES el contador de la campana se actualiza en menos de
    30 segundos sin recargar.
  - **CA-1.2:** CUANDO abro la campana, ENTONCES veo las últimas 20, con no-leídas
    destacadas y click que navega a la entidad (deep-link).
  - **CA-1.3:** Puedo marcar todo como leído.

- **HU-2:** Como Gerente, quiero recibir un correo cuando hay aprobaciones
  pendientes (agrupadas), para reaccionar aunque no tenga la app abierta.
  - **CA-2.1:** DADO uno o más eventos de aprobación en la última hora, ENTONCES
    recibo UN correo resumen (digest), no uno por evento.
  - **CA-2.2:** Puedo desactivar el correo por tipo de evento en Preferencias.

- **HU-3:** Como Coordinador Logístico, quiero alertas de stock bajo mínimo, para
  reponer antes del quiebre.
  - **CA-3.1:** DADO un material con mínimo definido (F-045b), CUANDO un
    movimiento lo deja por debajo, ENTONCES se notifica a los usuarios con
    `logistics:stock:view` del almacén, **una sola vez por cruce de umbral** (sin
    spam en cada movimiento posterior).

## 3. Alcance

- **Incluye:** notificaciones in-app con polling ligero cada 25 s, digest por
  correo cada hora, preferencias por usuario y tipo, emisores desde Gerencia
  (aprobaciones), Requests (estados), Logística (stock mínimo) y Finance
  (documentos por vencer a 7 días).
- **NO incluye:** WebSockets/SSE (el polling de 25 s cumple CA-1.1 con una
  fracción de la complejidad; se reevaluará con métricas), push móvil, WhatsApp/SMS.

> **Decisión de diseño deliberada — polling antes que WebSockets.** Con cold
> starts y tier gratuito, mantener conexiones persistentes es frágil; un
> `GET /notifications/unread-count` cada 25 s (cacheable, barato) entrega el 95 %
> del valor con el 10 % del riesgo. El contrato de API no cambiaría al migrar a SSE.

## 4. Reglas de negocio

- **RN-01:** Una notificación siempre referencia `(event_type, entity_type,
  entity_id)`: el deep-link se deriva, no se guarda como URL.
- **RN-02:** Deduplicación: mismo evento + misma entidad + mismo destinatario en
  24 h = una sola notificación.
- **RN-03:** El fan-out de destinatarios se resuelve **por PERMISO, no por rol**
  (quién puede aprobar recibe la alerta de aprobación) — así el sistema se
  mantiene correcto cuando cambian los roles.
- **RN-04:** Retención 90 días; luego se purgan (no son auditoría).

## 5. Impacto RBAC

- No crea permisos de acceso nuevos: usa los permisos existentes para el fan-out
  (RN-03). Cada usuario solo ve SUS notificaciones.

## 6. Impacto en auditoría

- Las notificaciones NO son auditoría (la auditoría ya existe aparte). No se
  auditan; se purgan a los 90 días.

## 7. Preguntas abiertas

- [x] **P1:** ¿polling o WebSockets? → **Polling 25 s** (ver decisión de diseño).
- [ ] **P2:** ¿proveedor de correo? → Resend o Brevo (tier gratuito); decidir en T-08.

## 8. Métricas de éxito

Tiempo de aprobación de solicitudes ↓ 50 % (indicador 11 del plan). CA-1.1
verificado (< 30 s).

---

## Checklist /speckit-verify

- [ ] CA-1.1 (latencia < 30 s) verificado.
- [ ] RN-02 (dedupe 24 h) cubierto por test.
- [ ] RN-03 (fan-out por permiso) cubierto por test con cambio de rol.
- [ ] Digest agrupa (CA-2.1) y respeta preferencias (CA-2.2).
- [ ] Spec actualizada tras implementación.
