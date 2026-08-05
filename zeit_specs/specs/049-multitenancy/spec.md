# [F-049] Multi-tenancy formal (aislamiento por empresa)

- **Estado:** BORRADOR (se cierra la decisión al llegar a la Fase 3)
- **Autor:** Plan Maestro SDD
- **Fecha:** 2026-08-05
- **Módulos afectados:** transversal (`core`, `superadmin`, todos los módulos con datos)
- **Migración asignada:** 049

## 1. Problema

La migración 038 ("estructura multi-base de datos") y el módulo `superadmin`
indican que el multi-tenancy ya empezó, pero de forma parcial. Falta cerrar
formalmente el modelo de aislamiento, automatizar el onboarding de una empresa
nueva y garantizar por test que **ningún cliente vea datos de otro**.

## 2. Decisión de arquitectura (a cerrar)

| Modelo | A favor | En contra |
|---|---|---|
| BD por empresa (camino de 038) | Aislamiento total; backup/restore por cliente | Migraciones × N bases; costo por BD; conexión dinámica por request |
| BD compartida + `company_id` en cada tabla | Una sola migración; operación simple; barato | Un `WHERE company_id` olvidado = fuga entre clientes |
| **Híbrido recomendado: compartida + `company_id` + RLS de Postgres** ✅ | La seguridad vive en la BD: aunque el código olvide el filtro, Postgres lo aplica; Supabase soporta RLS nativo | Requiere disciplina en `SET app.company_id` por conexión + tests dedicados |

**Recomendación: RLS (Row-Level Security).** El `WHERE` que no se puede olvidar.

```sql
ALTER TABLE finance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON finance_documents
    USING (company_id = current_setting('app.company_id')::int);

-- En get_conn(), tras obtener la conexión del pool:
--   SET app.company_id = <empresa del JWT del usuario>;
-- Desde ese momento, CUALQUIER consulta sobre la tabla solo ve filas de esa
-- empresa, aunque el SQL no filtre.
```

## 3. Historias de usuario

- **HU-1:** Como Superadmin, quiero crear una empresa nueva desde una pantalla,
  para dar de alta un cliente sin trabajo manual.
  - **CA-1.1:** DADO el formulario "Nueva empresa", CUANDO lo completo, ENTONCES
    se crea la compañía, se aplican roles y permisos base, se crea el admin
    inicial con contraseña generada y se configura el branding por defecto.
- **HU-2:** Como cliente, quiero la certeza de que ningún otro cliente ve mis datos.
  - **CA-2.1:** DADO dos empresas con datos, CUANDO consulto cualquier endpoint
    con el token de una, ENTONCES **jamás** aparecen filas de la otra (verificado
    por la suite anti-fuga).

## 4. Alcance

- **Incluye:** decisión de modelo cerrada (recomendado RLS), políticas RLS en
  todas las tablas con `company_id`, `SET app.company_id` en `get_conn`,
  onboarding automatizado desde Superadmin, suite de fuga entre empresas, límites
  por plan (usuarios máximos, almacenamiento, módulos habilitados).
- **NO incluye:** facturación del propio SaaS a los clientes (cobro de la
  suscripción), self-service signup público.

## 5. Reglas de negocio

- **RN-01:** Toda tabla con datos de negocio tiene `company_id` y política RLS.
- **RN-02:** `app.company_id` se fija desde el JWT en cada conexión; un request
  sin empresa válida es rechazado.
- **RN-03:** El onboarding es idempotente y transaccional (o crea todo, o nada).

## 6. Impacto RBAC

- Sin permisos nuevos de negocio; refuerza que Superadmin es el único que crea
  empresas.

## 7. Preguntas abiertas

- [ ] **P1:** ¿migrar las tablas existentes a RLS de una vez o por módulo? →
  decidir en plan; probable "por módulo tocado" salvo las críticas (finance, logistics).
- [ ] **P2:** ¿límites por plan configurables o fijos por tier? → configurables.

## 8. Métricas de éxito

Una empresa demo creada 100 % desde la pantalla de Superadmin; suite de fuga en
verde; indicador 12 del plan (empresas onboardeadas sin intervención manual ≥ 1).

---

## Checklist /speckit-verify

- [ ] RLS habilitado y probado en tablas críticas (finance, logistics).
- [ ] Suite anti-fuga: dos empresas, ningún endpoint cruza datos.
- [ ] Onboarding transaccional e idempotente (test).
- [ ] Límites por plan aplicados.
