# F-046 — contracts/api.md

Todos los endpoints bajo `/api/v1/finance`. El frontend se construye contra este
contrato, no contra el código.

```
POST /api/v1/finance/documents
    permiso: finance:receivables:manage | finance:payables:manage (según direction)
    Request:  { direction, party_id, source_type?, source_id?,
                currency, exchange_rate, amount_total,
                issue_date, payment_terms_days }
    201: documento completo con number generado
    409: { error: { code: "FUENTE_YA_FACTURADA" } }  si cotización/OC ya tiene doc
```

```
POST /api/v1/finance/documents/{id}/payments
    permiso: finance:cash:manage
    Request:  { cash_account_id, amount, exchange_rate, paid_at, notes? }
    201: pago CONFIRMED (o PENDING_APPROVAL si supera umbral → RN-06)
    422: { error: { code: "EXCEDE_SALDO" } }        → RN-01
    422: { error: { code: "SALDO_INSUFICIENTE" } }  → RN-02 (solo pagables)
```

```
POST /api/v1/finance/payments/{id}/void
    permiso: finance:cash:manage
    Request:  { reason }               → RN-03, genera contra-movimiento de caja
    200: pago en estado VOID
```

```
GET /api/v1/finance/dashboard
    permiso: finance:view
    200: { cash_balances: [ { account, currency, balance } ],
           receivables: { current, overdue },
           payables:    { current, overdue },
           projection_weeks: [ { week, inflow, outflow } ] }
```

```
GET /api/v1/finance/aging?direction=RECEIVABLE&page=1&page_size=50
    permiso: finance:view
    200: buckets 0-30 / 31-60 / 61-90 / +90 con sus documentos
```

```
GET  /api/v1/finance/cash-accounts            permiso: finance:view
POST /api/v1/finance/cash-accounts            permiso: finance:cash:manage
PUT  /api/v1/finance/config                   permiso: finance:config
     Request: { approval_threshold }          → RN-06
```
