# F-046 — data-model.md (migración 046)

```sql
-- migrations/046_finance_core.sql

CREATE TABLE finance_cash_accounts (
    id           SERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL REFERENCES companies(id),
    name         TEXT NOT NULL,              -- "Caja principal", "BCP Soles"
    kind         TEXT NOT NULL CHECK (kind IN ('CASH','BANK')),
    currency     TEXT NOT NULL CHECK (currency IN ('PEN','USD')),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (company_id, name)
);

CREATE TABLE finance_documents (
    id            SERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL REFERENCES companies(id),
    direction     TEXT NOT NULL CHECK (direction IN ('RECEIVABLE','PAYABLE')),
    number        TEXT NOT NULL,             -- correlativo doc_sequences
    party_id      INTEGER NOT NULL,          -- cliente o proveedor
    source_type   TEXT,                      -- 'COTIZACION' | 'OC' | NULL
    source_id     INTEGER,
    currency      TEXT NOT NULL CHECK (currency IN ('PEN','USD')),
    exchange_rate NUMERIC(8,4) NOT NULL DEFAULT 1,
    amount_total  NUMERIC(14,2) NOT NULL CHECK (amount_total > 0),
    amount_paid   NUMERIC(14,2) NOT NULL DEFAULT 0
                  CHECK (amount_paid >= 0 AND amount_paid <= amount_total), -- RN-01
    issue_date    DATE NOT NULL,
    due_date      DATE NOT NULL,
    status        TEXT NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','PARTIAL','PAID','VOID')),
    void_reason   TEXT,
    created_by    INTEGER NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, direction, number)
);

CREATE TABLE finance_payments (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES finance_documents(id),
    cash_account_id INTEGER NOT NULL REFERENCES finance_cash_accounts(id),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    exchange_rate   NUMERIC(8,4) NOT NULL DEFAULT 1,
    paid_at         DATE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'CONFIRMED'
                    CHECK (status IN ('PENDING_APPROVAL','CONFIRMED','VOID')),
    approval_id     INTEGER REFERENCES gerencia_approvals(id),
    notes           TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finance_cash_movements (
    id              SERIAL PRIMARY KEY,
    cash_account_id INTEGER NOT NULL REFERENCES finance_cash_accounts(id),
    payment_id      INTEGER REFERENCES finance_payments(id),
    kind            TEXT NOT NULL CHECK (kind IN ('IN','OUT','ADJUST')),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    balance_after   NUMERIC(14,2) NOT NULL,   -- kardex de caja (como el de stock)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      INTEGER NOT NULL REFERENCES users(id)
);

-- Configuración por empresa (RN-06)
CREATE TABLE finance_config (
    company_id       INTEGER PRIMARY KEY REFERENCES companies(id),
    approval_threshold NUMERIC(14,2) NOT NULL DEFAULT 5000
);

CREATE INDEX idx_findocs_aging
    ON finance_documents (company_id, direction, status, due_date);
CREATE INDEX idx_cashmov_account
    ON finance_cash_movements (cash_account_id, created_at DESC);
```

```sql
-- migrations/046_finance_core.down.sql
DROP TABLE finance_cash_movements;
DROP TABLE finance_payments;
DROP TABLE finance_documents;
DROP TABLE finance_config;
DROP TABLE finance_cash_accounts;
```

## Notas de diseño

- Las reglas RN-01 y RN-02 viven **parcialmente en el esquema**
  (`CHECK amount_paid <= amount_total`); el resto de RN-02 (saldo de caja) se
  valida en `service.py` antes de insertar el movimiento.
- `balance_after` implementa un **kardex de caja** idéntico conceptualmente al
  kardex de stock de Logística: el mismo patrón mental del ERP, aplicado al dinero.
- Los correlativos de `number` se generan con la tabla `doc_sequences`
  (ver `CONSTITUTION.md` / cap. de base de datos), nunca con `MAX()+1`.
