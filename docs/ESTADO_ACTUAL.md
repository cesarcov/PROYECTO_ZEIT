# Estado Actual del Proyecto

> Actualizar esta sección al terminar cada sesión de desarrollo.
> Última actualización: 2026-06-19

## Cambios recientes (SDD)

- **Feature 002 — Sistema de temas (apariencia), tramo 002a: motor + armazón** (rama `002-tema-apariencia`). Tras el rebrand a **ZEIT SOLUTIONS ERP** (constitución v1.1.0), se agregó el motor de temas por **tokens CSS** (`frontend/.../theme/themes.css` con 5 temas: zeit-claro/oscuro/oscuro-energia/turquesa/grafito) + `ThemeProvider` (selector en Preferencias, "seguir el sistema", anti-parpadeo). Preferencia **persistida en la cuenta** vía `GET/PUT /auth/me/preferences` (migración `034_user_preferencias.sql`, columna `users.preferencias` JSONB). Identidad **ZEIT** (logo `ZeitLogo`) + crédito "Powered by CeShark · ERP Engine". Migrado el armazón (Layout/Login); las ~70 vistas de módulo se migran a tokens en tramos siguientes. Regla: el naranja nunca como color principal.
- **Feature 001 — Filtro por responsable en el Exportar de Planificación** (rama `001-export-filtro-responsable`, primer feature por el pipeline Spec Kit). El modal de Exportar de Planificación ahora permite filtrar por responsable (una persona) y por "Sin responsable asignado", además de los filtros de fecha/prioridad/estado/cliente. Endpoint `GET /planificacion/actividades/export` con parámetro `responsable` (id de usuario o `__none__`). Sin migración. Ver `specs/001-export-filtro-responsable/`.

---

## Fases completadas

| # | Fase | Migration | Fecha |
|---|------|-----------|-------|
| 1 | Cotizaciones APU S10-style + PDF/Excel | 011 | 2026-06-01 |
| 2 | Órdenes de Trabajo SAP PM-style | 012 | 2026-06-01 |
| 3 | Proveedores + Órdenes de Compra Odoo-style | 013 | 2026-06-02 |
| 4 | Clientes + Ciclo Comercial de Cotización | 014 | 2026-06-02 |

## Migraciones aplicadas en BD

| N° | Archivo | Contenido |
|----|---------|-----------|
| 001 | roles_permissions_dispatch.sql | Roles, permisos, despachos |
| 002 | project_plans.sql | Planes de proyecto |
| 002b | project_plans_decouple.sql | Desacople plan/proyecto |
| 003 | material_validation.sql | Validación materiales |
| 004 | plan_submissions.sql | Submissions |
| 005 | roles_estructura_erp.sql | Roles empresariales |
| 006 | purge_legacy_roles.sql | Limpieza legacy |
| 007 | material_groups.sql | Bóvedas de materiales |
| 008 | demo_users_rename.sql | Renombrado usuarios demo |
| 009 | advanced_logistics.sql | Lotes, transferencias, inv. físico |
| 010 | canal_solicitudes.sql | Canal inter-módulo |
| 011 | cotizaciones_apu.sql | APU, partidas, recursos MO |
| 012 | ordenes_trabajo.sql | OTs, checklist, consumos, tiempos |
| 013 | ordenes_compra.sql | Proveedores, OC, recepción |
| 014 | clientes_ciclo_cotizacion.sql | Clientes + ciclo comercial cotización |

## Flujo de negocio implementado

```
COMERCIAL
  Cliente (CLI-YYYY-NNNN) → Operaciones crea Plan → Presupuesto APU
  → Exporta PDF/Excel → BORRADOR → ENVIADA (COT-YYYY-NNNN) → APROBADA

PLANIFICACIÓN
  Plan aprobado → OTs (OT-YYYY-NNNN) → Checklist + consumos + cronómetro
  → Cierre OT → stock OUT automático → Comparativa APU vs Real

ABASTECIMIENTO
  Stock insuficiente → OC (OC-YYYY-NNNN) a proveedor del catálogo
  → Recepción → stock IN automático
```

## Módulos activos en el sidebar

| Módulo | Sección | Items |
|--------|---------|-------|
| Logística | Inventario | Materiales, Stock, Movimientos, Almacenes, Lotes, Transferencias, Inv. Físico |
| Logística | Equipos | Herramientas, Proyectos, Reservas |
| Logística | OTs/Consumos | OTs Activas |
| Logística | Compras | Proveedores, Órdenes Compra |
| Logística | Solicitudes | Panel Pedidos, Importar |
| Logística | Despachos | Despachos |
| Operaciones | Mis Proyectos | Mis Proyectos |
| Operaciones | OTs | Mis OTs |
| Operaciones | Cotizaciones | Mis Cotizaciones, Tarifas MO, Clientes |
| Operaciones | Compras | Mis OCs |
| Admin | Sistema | Usuarios, Roles, Auditoría, Reportes |

## Pendiente inmediato / deuda técnica

- [ ] Auth en endpoints `/reporting/*` (actualmente sin token)
- [ ] Paginación en endpoints con alto volumen (materiales, movimientos, OTs)
- [ ] Tests unitarios e integración backend
- [ ] `qrcode` module falta en dependencias (router_advanced.py)
