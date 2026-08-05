# F-046 — tasks.md (14 tareas)

Ejecutar en orden de dependencia. Cada `[BE]` lista los tests que la validan.

- [ ] **T-01 [BD]** Migración 046 + down + `seed/test.sql` de finance.  Dep: —
- [ ] **T-02 [BE]** `queries.py` de finance (acceso puro).  Dep: T-01
- [ ] **T-03 [BE]** service: crear documento (RN-05, correlativo doc_sequences).  Dep: T-02
      Tests: `test_ca_1_1_generar_cxc`, `test_409_fuente_ya_facturada`
- [ ] **T-04 [BE]** service: registrar pago (RN-01, RN-02, RN-06; transacción
      pago+movimiento+doc+auditoría).  Dep: T-03
      Tests: `test_rn_01_excede_saldo`, `test_rn_02_saldo_insuficiente`,
      `test_ca_4_1_sobre_umbral_pending`
- [ ] **T-05 [BE]** service: anulación de pago y documento (RN-03,
      contra-movimiento).  Dep: T-04
      Tests: `test_rn_03_void_genera_contramovimiento`
- [ ] **T-06 [BE]** service: dashboard y aging (CA-3.1, CA-3.2, CA-1.3).  Dep: T-03
      Tests: `test_ca_3_2_tablero_cuadra`, `test_ca_1_3_vencido_en_aging`
- [ ] **T-07 [BE]** routers + 6 permisos RBAC nuevos.  Dep: T-03..T-06
- [ ] **T-08 [BE]** integración con panel Gerencia (pagos sobre umbral).  Dep: T-04
- [ ] **T-09 [TEST]** unitarios RN-01..RN-06.  Dep: T-03..T-05
- [ ] **T-10 [TEST]** integración de contratos + `test_rbac_matrix` ampliado.  Dep: T-07
- [ ] **T-11 [FE]** páginas: Cajas | Cuentas por cobrar | Cuentas por pagar.  Dep: T-07
- [ ] **T-12 [FE]** tablero financiero (gráficos de aging y flujo).  Dep: T-07
- [ ] **T-13 [FE]** flujo de aprobación en Gerencia.  Dep: T-08
- [ ] **T-14 [E2E]** cotización aceptada → CxC → cobro parcial → PAGADO.  Dep: T-11
