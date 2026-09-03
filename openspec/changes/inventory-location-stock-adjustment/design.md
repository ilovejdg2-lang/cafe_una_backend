# Design: Location Stock Adjustments

## Technical Approach

Extend `InventarioModule` with a location-scoped write operation. The service validates input before opening a QueryRunner, locks the product and selected balance, updates the balance, inserts an `Auditoria` row, and commits both changes together. This slice does not introduce a movement ledger; transfers and sales will be separate changes.

## Architecture Decisions

| Decision | Choice | Rejected alternative | Rationale |
|---|---|---|---|
| Route boundary | `PUT /inventario/ubicaciones/:locationCode/productos/:productId/stock` | Reuse central-only product route | Makes location scope explicit and prevents accidental POS writes through the legacy contract. |
| Authorization | New `ajustar_stock_ubicaciones` permission for admins | Reuse vendor stock permission | Opening/administrative corrections must not be available to sellers. |
| Audit | Insert `Auditoria` in the same QueryRunner | Log after commit | Prevents an unaudited balance change. |
| Central mirror | Keep existing central endpoint unchanged | Make generic endpoint replace it now | Avoids breaking current frontend consumers; consolidation can happen later. |

## Data Flow

```text
HTTP + JWT
  -> permission guard
  -> InventarioController
  -> InventarioService + QueryRunner
  -> lock product/balance -> update balance -> insert audit -> commit
```

## Interfaces / Contracts

```text
PUT /api/inventario/ubicaciones/POS_EDITORIAL/productos/42/stock
{
  "stock": 12,
  "reason": "Carga inicial del punto de venta Editorial"
}

200 { productId, locationCode, previousStock, stock, reason }
```

The service accepts the existing PascalCase-normalized body convention as well as camelCase input. It rejects central writes through this new route until the legacy contract is deliberately consolidated.

## Testing Strategy

| Layer | Coverage | Approach |
|---|---|---|
| Unit | strict validation, locks, update, audit, rollback | Jest QueryRunner mock |
| HTTP | permission, casing, route params, error status | Nest + Supertest |
| Runtime | isolated PostgreSQL transaction | Existing `TEST_DATABASE_URL` harness; never Supabase |

## Threat Matrix

N/A — no routing automation, shell execution, VCS automation, or executable-file classification is introduced beyond normal HTTP routing.

## Migration / Rollout

No schema migration is required because the existing balance and audit tables are reused. Roll out backend contract first, then the POS adjustment UI.

## Open Questions

- [ ] Define transfer movement persistence in a later change.
