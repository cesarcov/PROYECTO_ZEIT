# F-047 — tasks.md

- [ ] **T-01 [BD]** Migración 047 (notifications + prefs).  Dep: —
- [ ] **T-02 [BE]** emitter + queries (`users_with_permission`,
      `insert_notification_dedup`) + prefs.  Dep: T-01
- [ ] **T-03 [BE]** endpoints: `unread-count`, `list`, `mark-read`, `prefs`.  Dep: T-02
- [ ] **T-04 [TEST]** RN-01..RN-04 + contratos (dedupe, fan-out por permiso).  Dep: T-03
- [ ] **T-05 [FE]** campana + panel (polling 25 s con TanStack Query).  Dep: T-03
- [ ] **T-06 [FE]** pantalla de Preferencias por tipo de evento.  Dep: T-03
- [ ] **T-07 [BE]** hooks en gerencia / requests / logistics (cruce mínimo) /
      finance (por vencer 7 días).  Dep: T-02
- [ ] **T-08 [JOB]** digest de correo (cron cada hora) + elección de proveedor.  Dep: T-02
- [ ] **T-09 [E2E]** evento de aprobación → aparece en campana < 30 s.  Dep: T-05
