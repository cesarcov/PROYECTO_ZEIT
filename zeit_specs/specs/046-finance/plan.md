# F-046 — plan.md (diseño técnico)

## Arquitectura

Finance **nace ya con la estructura objetivo** (es el módulo de referencia del
nuevo estándar): `router.py` (HTTP + permisos) → `service.py` (SOLO negocio) →
`queries.py` (SOLO SQL) → PostgreSQL.

## Decisiones clave

- **Kardex de caja con `balance_after`**: cada movimiento guarda el saldo
  resultante, igual que el kardex de stock. Permite auditar la caja punto a punto
  sin recalcular.
- **Estados calculados, no duplicados**: `VENCIDO` en el aging se calcula
  (`due_date < today AND balance > 0`), no se guarda. El `status` almacenado solo
  distingue OPEN/PARTIAL/PAID/VOID.
- **Aprobación reutiliza `gerencia_approvals`**: no se crea un sistema paralelo;
  un pago sobre umbral crea una aprobación en el módulo existente y queda en
  `PENDING_APPROVAL` hasta resolverse (CA-4.1).
- **Multi-moneda con TC por operación** (RN-05): el `exchange_rate` se congela en
  cada documento y cada pago; los consolidados se expresan en PEN.

## Transaccionalidad (crítico)

Registrar un pago es **una sola transacción** que hace TRES cosas:
1. inserta el pago,
2. inserta el movimiento de caja con `balance_after`,
3. actualiza `amount_paid` y `status` del documento,
4. registra auditoría.

Si cualquiera falla, **todo** hace rollback. Nunca debe quedar un pago sin su
movimiento de caja, ni un saldo descontado sin pago.

## Integraciones

- **Cotizaciones**: al pasar a `ACEPTADA`, se habilita "Generar CxC" (CA-1.1).
  El endpoint rechaza con `FUENTE_YA_FACTURADA` si ya existe documento (evita duplicar).
- **Compras**: al pasar OC a `RECIBIDA`, se habilita "Generar CxP" (CA-2.1).
- **Gerencia**: pagos sobre umbral → panel de aprobaciones (CA-4.1).
- **Reporting**: el tablero financiero se expone como widget del dashboard ejecutivo.

## Contratos

Ver `contracts/api.md`.
