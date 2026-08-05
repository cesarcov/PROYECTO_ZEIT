# [F-0XX] Nombre de la funcionalidad

- **Estado:** BORRADOR | EN REVISIÓN | APROBADA | IMPLEMENTADA
- **Autor:** ...
- **Fecha:** AAAA-MM-DD
- **Módulos afectados:** ...
- **Migración asignada:** 0XX

## 1. Problema

(2–4 líneas: qué duele hoy y a quién. Un ejemplo real del negocio ayuda.)

## 2. Historias de usuario

- **HU-1:** Como `<rol>`, quiero `<acción>` para `<beneficio>`.
  - **CA-1.1:** DADO ... CUANDO ... ENTONCES ...
  - **CA-1.2:** DADO ... CUANDO ... ENTONCES ...

## 3. Alcance

- **Incluye:** ...
- **NO incluye (explícito):** ...  ← evita que la implementación "se estire".

## 4. Reglas de negocio

- **RN-01:** ...
- **RN-02:** ...

## 5. Impacto RBAC

- Permisos nuevos: `<módulo>:<recurso>:<acción>`
- Roles que los reciben: ...

## 6. Impacto en auditoría

- Acciones a registrar: ...

## 7. Preguntas abiertas

- [ ] **P1:** ... → Resuelta el __/__ por: ...

## 8. Métricas de éxito

(Cómo sabremos que la feature cumple su objetivo.)

---

## Checklist /speckit-verify

- [ ] Cada CA tiene un test automatizado que lo nombra.
- [ ] `test_rbac_matrix` ampliado con los permisos nuevos × todos los roles.
- [ ] Migración aplicada en staging antes que en producción.
- [ ] Acciones de escritura auditadas (verificado por test).
- [ ] Spec actualizada con lo que cambió durante la implementación.
