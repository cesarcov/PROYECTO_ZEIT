# F-045b — tasks.md

- [ ] **T-01 [BD]** Migración 045b + down.  Dep: —
      Validación: `run_migrations.py` aplica; `down` probado en local.
- [ ] **T-02 [BE]** queries: `upsert_min`, `get_min`, `SQL_BELOW_MIN`.  Dep: T-01
      Validación: tests unitarios de queries contra BD de test.
- [ ] **T-03 [BE]** service: `set_min_stock` (RN-01, RN-03 con auditoría
      before/after).  Dep: T-02
      Validación: `test_ca_1_3_minimo_negativo_rechazado` en verde.
- [ ] **T-04 [BE]** router + permiso nuevo `logistics:stock:set_min`.  Dep: T-03
      Validación: `test_ca_1_1_guardar_y_leer` + `test_rn_03_viewer_no_puede`.
- [ ] **T-05 [TEST]** unit RN-01 + integración contratos + RBAC (403 Viewer).
      Dep: T-04
- [ ] **T-06 [FE]** columna Mínimo editable en Stock (PermissionGate) + badge
      "BAJO MÍNIMO".  Dep: T-04
- [ ] **T-07 [FE]** página Reporte "Bajo mínimo".  Dep: T-04
- [ ] **T-08 [VERIFY]** checklist de spec + actualizar spec con decisiones.  Dep: todo
