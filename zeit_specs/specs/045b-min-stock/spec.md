# [F-045b] Stock mínimo por material y almacén

- **Estado:** APROBADA
- **Autor:** C. Huamani
- **Fecha:** 2026-08-10
- **Módulos afectados:** logistics
- **Migración asignada:** 045b

> **Esta es la spec de referencia del proyecto.** Es pequeña a propósito, pero
> toca todas las capas (migración, queries, service, router, RBAC, frontend,
> tests). Úsala como plantilla mental para las specs grandes. El código completo
> ya está en `plan.md` y `contracts/api.md`.

## 1. Problema

Los quiebres de stock se descubren cuando un despacho falla. No existe forma de
declarar "de este material quiero tener siempre al menos X en el almacén Y".

## 2. Historias de usuario

- **HU-1:** Como Coordinador Logístico, quiero definir un stock mínimo por
  material y almacén, para que el sistema sepa cuándo estamos en zona de riesgo.
  - **CA-1.1:** DADO un material y un almacén, CUANDO guardo un mínimo de 25,
    ENTONCES la vista de stock muestra 25 en la columna "Mínimo" para esa
    combinación.
  - **CA-1.2:** DADO un mínimo guardado, CUANDO el stock actual es menor al
    mínimo, ENTONCES la fila se marca "BAJO MÍNIMO".
  - **CA-1.3:** CUANDO intento guardar un mínimo negativo, ENTONCES recibo error
    de validación y nada se guarda.

- **HU-2:** Como Gerente Logístico, quiero un reporte de todos los materiales bajo
  mínimo, para priorizar compras.
  - **CA-2.1:** El reporte lista material, almacén, stock actual, mínimo y déficit
    (mínimo − actual), ordenado por déficit descendente.

## 3. Alcance

- **Incluye:** campo mínimo, edición desde la vista de stock, reporte
  "Bajo mínimo", indicador visual en la tabla de stock.
- **NO incluye:** la notificación automática (eso es F-047, que consume este
  dato), sugerencia de cantidad a comprar, mínimos por proyecto.

## 4. Reglas de negocio

- **RN-01:** `min_qty >= 0`; cero significa "sin mínimo definido".
- **RN-02:** El mínimo es por `(material, almacén)`, no global.
- **RN-03:** Editar el mínimo requiere permiso propio (no basta ver stock); se
  audita con before/after.

## 5. Impacto RBAC

- Permiso nuevo: `logistics:stock:set_min`
- Roles: Gerente Logístico, Coordinador Logístico, Admin Maestro.
- Viewer y Operador **NO** lo reciben (solo ven la columna).

## 6. Impacto en auditoría

- Acción nueva: `STOCK_MIN_UPDATED { material, almacen, before, after }`

## 7. Preguntas abiertas

- [x] **P1:** ¿mínimo por empresa o por almacén? → **Por almacén** (resuelta
  2026-08-10, es la unidad operativa real).

## 8. Métricas de éxito

En 30 días: al menos 20 materiales con mínimo definido y el reporte "Bajo mínimo"
consultado semanalmente por logística.

---

## Checklist /speckit-verify

- [ ] CA-1.1, CA-1.3, CA-2.1 y RN-03 cubiertos por tests nombrados.
- [ ] CA-1.2 cubierto por test E2E del badge.
- [ ] `test_rbac_matrix` ampliado: `logistics:stock:set_min` × 12 roles.
- [ ] Migración 045b aplicada en staging → producción; `down` probado en local.
- [ ] Auditoría verificada: el update genera `STOCK_MIN_UPDATED` con before/after.
- [ ] Spec actualizada (decisión "estado calculado, no guardado" anotada en plan).
