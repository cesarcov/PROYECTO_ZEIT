# [F-046] Módulo Finance — Cuentas por cobrar/pagar, caja y resultados

- **Estado:** APROBADA
- **Autor:** Plan Maestro SDD
- **Fecha:** 2026-08-05
- **Módulos afectados:** `finance` (nuevo), `compras`, `cotizaciones`, `gerencia`, `reporting`
- **Migración asignada:** 046

## 1. Problema

El ERP registra el flujo operativo (cotizar, comprar, despachar) pero **el dinero
es invisible**: no se sabe cuánto nos deben los clientes, cuánto debemos a
proveedores, ni el saldo de caja. Gerencia decide con información operativa pero
sin información financiera — exactamente la mitad del panorama.

## 2. Historias de usuario y criterios de aceptación

- **HU-1:** Como Tesorería, quiero registrar los documentos por cobrar generados
  desde cotizaciones aceptadas, para dar seguimiento a la cobranza.
  - **CA-1.1:** DADO que una cotización pasa a estado `ACEPTADA`, CUANDO Tesorería
    genera el documento por cobrar, ENTONCES se crea con el monto total de la
    cotización, fecha de emisión, condición de pago (contado / crédito N días) y
    fecha de vencimiento calculada.
  - **CA-1.2:** DADO un documento por cobrar vigente, CUANDO registro un cobro
    parcial, ENTONCES el saldo pendiente disminuye y el documento pasa a
    `PARTIAL`; al llegar a cero pasa a `PAID`.
  - **CA-1.3:** DADO un documento con fecha de vencimiento pasada y saldo > 0,
    ENTONCES el sistema lo muestra como `VENCIDO` en el aging.

- **HU-2:** Como Tesorería, quiero registrar las cuentas por pagar originadas en
  órdenes de compra recibidas, para programar pagos sin sorpresas.
  - **CA-2.1:** DADO una OC en estado `RECIBIDA`, CUANDO genero su cuenta por
    pagar, ENTONCES hereda proveedor, monto y moneda de la OC, y queda vinculada
    a ella (trazabilidad OC → CxP → pagos).
  - **CA-2.2:** DADO una cuenta por pagar, CUANDO registro un pago, ENTONCES debo
    indicar la caja/banco de origen y el movimiento descuenta el saldo de esa caja.

- **HU-3:** Como Gerente General, quiero un tablero financiero con caja actual,
  aging de cobranzas, aging de pagos y flujo proyectado a 30/60/90 días.
  - **CA-3.1:** DADO el tablero, ENTONCES muestra: saldo por caja/banco, total por
    cobrar (vigente/vencido), total por pagar (vigente/vencido) y gráfico de flujo
    proyectado por semana.
  - **CA-3.2:** Los montos del tablero cuadran exactamente con la suma de los
    documentos subyacentes (invariante verificado por test).

- **HU-4:** Como Gerente General, quiero que los pagos por encima de un umbral
  configurable pasen por el panel de aprobaciones de Gerencia existente.
  - **CA-4.1:** DADO un pago que supera el umbral, CUANDO Tesorería lo registra,
    ENTONCES queda en `PENDING_APPROVAL` y aparece en el panel de Gerencia; solo
    al aprobarse impacta la caja.

## 3. Alcance

- **Incluye:** cajas y bancos (saldos y movimientos), documentos por cobrar y por
  pagar con pagos parciales, vínculo con cotizaciones y OC, aging, tablero
  financiero, aprobación de pagos sobre umbral, todo multi-moneda PEN/USD con
  tipo de cambio manual por operación.
- **NO incluye (explícito):** contabilidad de partida doble completa ni plan
  contable PCGE; facturación electrónica SUNAT (spec F-048); conciliación
  bancaria automática por importación de extractos; detracciones/retenciones
  (segunda iteración).

## 4. Reglas de negocio

- **RN-01:** Un pago jamás puede exceder el saldo pendiente del documento.
- **RN-02:** Un movimiento de caja jamás deja el saldo negativo (rechazo con
  `SALDO_INSUFICIENTE`).
- **RN-03:** Documentos y pagos no se eliminan: se **anulan** con motivo
  obligatorio, generando el contra-movimiento de caja correspondiente.
- **RN-04:** Toda operación registra evento de auditoría con diff before/after.
- **RN-05:** El tipo de cambio se guarda en cada operación (histórico inmutable);
  los totales consolidados se expresan en PEN al TC de cada operación.
- **RN-06:** El umbral de aprobación es configurable por empresa (default: S/ 5 000).

## 5. Impacto RBAC

- Permisos nuevos: `finance:view`, `finance:receivables:manage`,
  `finance:payables:manage`, `finance:cash:manage`, `finance:approve_payments`,
  `finance:config`.
- Asignación:
  - Tesorería → los tres `manage`.
  - Gerente General → `finance:view` + `finance:approve_payments`.
  - Administrador Maestro → todos.
  - **Viewer → `finance:view`** (coherente con su diseño de solo lectura).
  - Auditor → `finance:view`.

## 6. Impacto en auditoría

- `FINANCE_DOC_CREATED`, `FINANCE_PAYMENT_REGISTERED`, `FINANCE_PAYMENT_VOIDED`,
  `FINANCE_DOC_VOIDED` — todas con before/after (RN-04).

## 7. Preguntas abiertas

- [x] **P1:** ¿multi-moneda desde v1? → Sí, PEN/USD con TC manual por operación
  (resuelta; el mercado peruano lo exige).
- [ ] **P2:** ¿el umbral de aprobación es único o por tipo de pago? → pendiente;
  default único por empresa hasta que un cliente pida lo contrario.

## 8. Métricas de éxito

Gerencia consulta el tablero financiero semanalmente; el aging refleja la
cobranza real; ningún pago sobre umbral impacta caja sin aprobación.

---

## Checklist /speckit-verify

- [ ] Cada CA (1.1 a 4.1) tiene test automático referenciado por nombre.
- [ ] `test_rbac_matrix` ampliado con los 6 permisos nuevos × 12 roles.
- [ ] El tablero cuadra contra la suma de documentos (CA-3.2) con 1 000 docs sintéticos.
- [ ] Migración 046 aplicada en staging 24 h antes que producción, sin errores.
- [ ] Spec actualizada con decisiones tomadas durante implementación.
