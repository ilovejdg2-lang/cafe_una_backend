# Design: Inventory Location Stock Foundation (Backend)

## Technical Approach

Implement F06 as a dedicated `InventarioModule` over PostgreSQL/TypeORM. Add fixed locations and product-location balances, backfill central stock, and keep `productos.Stock` as an atomic compatibility mirror. New reads use balances; ecommerce continues using central stock. Synchronization remains disabled and tests never use shared Supabase.

## Architecture Decisions

| Decision | Choice | Rejected alternative | Rationale |
|---|---|---|---|
| Persistence boundary | `inventario_ubicaciones` plus `inventario_stock_ubicaciones` with unique `(ProductoId, UbicacionId)` | Store POS quantities in `productos.Stock` or JSON | Enforces isolation and database invariants. |
| Location identity | Four migration-seeded codes: `BODEGA_CENTRAL`, `POS_FUNA_UNA`, `POS_EDITORIAL`, `POS_STAND_FERIAS`; no location CRUD | User-editable location catalog | Codes are API/data keys and must remain stable for future sales/transfers. |
| Compatibility | `Producto.Stock` remains the central mirror until later contraction | Immediate column removal | Avoids breaking current consumers; dual writes are temporary and explicit. |
| Write consistency | One `QueryRunner` transaction, deterministic row locks on product and balance, then save both records | Independent repository saves | Prevents mirror drift and lost concurrent updates. |
| Module boundary | New `InventarioModule`; compatibility endpoint delegates to it | Put all concerns in `ProductosService` | Separates catalog and location inventory responsibilities. |

## Data Flow

```
HTTP request
  -> JwtAuthGuard + PermisosGuard
  -> InventarioController
  -> InventarioService
  -> QueryRunner transaction / repositories
  -> PostgreSQL (balance + Producto.Stock)
```

Reads resolve a canonical code, return only that location, and report `stock: 0` with `provisioned: false` when absent. A persisted zero returns `provisioned: true`.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/entities/inventario-ubicacion.entity.ts` | Create | Fixed code/name catalog entity. |
| `src/entities/inventario-stock-ubicacion.entity.ts` | Create | Product/location balance with unique composite key and non-negative constraint. |
| `src/entities/index.ts` | Modify | Register and export both entities. |
| `src/modules/inventario.module.ts` | Create | Registers repositories, controller, service, and `Producto`. |
| `src/controllers/inventario.controller.ts` | Create | Authorized location and balance reads; no arbitrary CRUD. |
| `src/services/inventario.service.ts` | Create | Lookup, reads, central transaction, validation, and mirror rules. |
| `src/controllers/productos.controller.ts` | Modify | Preserve `PUT /productos/:id/stock-central` while delegating to inventory service. |
| `src/services/productos.service.ts` | Modify | Remove direct central mutation or delegate without duplicating rules. |
| `src/app.module.ts` | Modify | Import `InventarioModule`. |
| `src/database/migrations/*-inventory-location-stock-foundation.ts` | Create | Schema, seed, backfill, constraints, and guarded down migration. |
| `test/inventory-location-stock.integration.spec.ts` | Create | Isolated migration, backfill, rollback, constraints, and concurrency tests. |
| `src/services/inventario.service.spec.ts` | Create | Validation, absent/zero, and transaction orchestration tests. |

## Interfaces / Contracts

- `GET /api/inventario/ubicaciones` requires `ver_inventario`.
- `GET /api/inventario/productos/:id/stock?locationCode=CODE` requires `ver_inventario`.
- Existing `PUT /api/productos/:id/stock-central` remains compatible, requires `actualizar_stock_productos`, accepts `stock` and `Stock`, and returns `{ productId, locationCode, stock }`.
- F06 does not expose POS writes. Invalid codes/quantities, missing products, and unauthorized requests fail without mutation.

## Testing Strategy

| Layer | Coverage | Approach |
|---|---|---|
| Unit | Validation, canonical lookup, absent vs zero, central zero clears `EsDestacado` | Jest with mocked repositories/query runner. |
| Integration | Idempotent migration, four seeds, backfill, constraints, guarded rollback | `TEST_DATABASE_URL`; `synchronize: false`; never Supabase. |
| Concurrency | Two central updates on the same product/location | Two query runners assert serialized commits and mirror equality. |
| Contract/E2E | Permission status, casing, legacy endpoint compatibility | Supertest when authenticated setup is available. |

The existing `AuditoriaSubscriber` remains active for entity updates; the transaction must use the same `DataSource` so audit context and data changes share the request boundary.

## Threat Matrix

HTTP routing is covered by API tests; the supplied VCS/document rows are N/A because this design adds no shell, subprocess, Git, commit, push, or PR automation.

| Boundary | Applicability | Safe/failure behavior and RED test |
|---|---|---|
| Documentation-like paths | N/A — no executable documentation | No test required. |
| Git repository selection | N/A — no Git automation | No test required. |
| Commit state | N/A — no commit automation | No test required. |
| Push state | N/A — no push automation | No test required. |
| PR commands | N/A — no PR automation | No test required. |

API RED coverage is required for unauthorized reads/writes, unknown codes, and unsupported CRUD; all fail without mutation.

## Migration / Rollout

The forward migration runs transactionally: create tables and constraints, seed canonical locations, then insert central balances from `Producto.Stock` and zero POS rows with conflict-safe inserts. Down migration MUST refuse when non-central balances are non-zero or central data differs from `Producto.Stock`; otherwise it removes new tables while preserving `productos.Stock`. Rollout is migration, backend, then frontend.

## Open Questions

- [ ] None blocking; F06 locations and zero-row backfill policy are confirmed.
