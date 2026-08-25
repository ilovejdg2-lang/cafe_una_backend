# Tasks: Inventory Location Stock Foundation

## Review Workload Forecast

| Field                   | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| Estimated changed lines | 500–750 authored lines                                     |
| 400-line budget risk    | High                                                       |
| Chained PRs recommended | Yes                                                        |
| Suggested split         | Persistence → reads → central compatibility → verification |
| Delivery strategy       | auto-chain                                                 |
| Chain strategy          | feature-branch-chain                                       |

delivery_strategy: auto-chain
chain_strategy: feature-branch-chain

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                       | Base → target     | Focused test command                                                                                           | Runtime harness                                             | Rollback boundary                                    |
| ---- | ------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Entities, migration, seed and backfill     | tracker → tracker | `npm run test:integration -- --runInBand inventory-location-stock.integration.spec.ts`                         | Isolated PostgreSQL via `TEST_DATABASE_URL`; never Supabase | Revert migration/entities; preserve `Producto.Stock` |
| 2    | Authorized location and balance reads      | PR1 → PR1         | `npm test -- --runInBand src/controllers/inventario.controller.spec.ts`                                        | `npm run start:dev` with authenticated Supertest            | Revert read controller/service only                  |
| 3    | Atomic central mirror compatibility        | PR2 → PR2         | `npm test -- --runInBand src/services/inventario.service.spec.ts src/controllers/productos.controller.spec.ts` | Local backend and isolated PostgreSQL; no shared writes     | Revert delegation/transaction code; retain reads     |
| 4    | Concurrency and migration regression proof | PR3 → PR3         | `npm run test:integration -- --runInBand`                                                                      | Disposable PostgreSQL, `synchronize: false`; never Supabase | Revert tests/harness only                            |

For Feature Branch Chain: PR1 branch `feature/inventory-f06-location-stock-foundation-p1`, PR2 `...-p2`, PR3 `...-p3`, PR4 `...-p4`; each targets the previous boundary. Only the tracker branch is promoted to `development`.

## Phase 1: Persistence Foundation (PR1)

- [x] 1.1 Write RED integration tests for four canonical seeds, idempotency, central backfill, zero POS rows, uniqueness, constraints, and guarded rollback in `test/inventory-location-stock.integration.spec.ts`.
- [x] 1.2 Create `src/entities/inventario-ubicacion.entity.ts` and `src/entities/inventario-stock-ubicacion.entity.ts` with stable codes, composite uniqueness, and non-negative integer constraints.
- [x] 1.3 Register entities in `src/entities/index.ts` and `src/modules/inventario.module.ts`.
- [x] 1.4 Create `src/database/migrations/*-inventory-location-stock-foundation.ts` with transactional seed, backfill, conflict-safe zero rows, and protected down migration.

## Phase 2: Authorized Reads (PR2)

- [x] 2.1 Write RED API tests for missing permission (403), unknown code, unsupported CRUD, absent balance, and provisioned zero; failures must not mutate data.
- [x] 2.2 Create `src/services/inventario.service.ts` and `src/controllers/inventario.controller.ts` for canonical location listing and location-scoped reads.
- [x] 2.3 Wire `src/app.module.ts` and verify `locationCode`, `stock`, `provisioned`, casing, and authorization responses.

### PR2 Work Unit Evidence

| Evidence          | Result                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `npm test -- --runInBand src/controllers/inventario.controller.spec.ts` — 1 suite, 8 tests passed.                                                                                  |
| Runtime harness   | Nest HTTP test application with `JwtAuthGuard` overridden only for deterministic role scenarios — authorization, casing, absent/provisioned balances and unsupported CRUD verified. |
| Regression/build  | `npm test -- --runInBand` — 3 suites, 21 tests passed; `npm exec -- tsc --noEmit` and `npm run build` passed; `git diff --check` passed.                                            |
| Rollback boundary | Revert `src/controllers/inventario.controller.ts`, `src/services/inventario.service.ts`, module wiring, and the PR2 controller tests; retain PR1 persistence.                       |

## Phase 3: Central Compatibility (PR3)

- [x] 3.1 Write RED unit tests for strict quantities, missing products, unauthorized writes, zero clearing `EsDestacado`, and `stock`/`Stock` compatibility.
- [ ] 3.2 Delegate `src/controllers/productos.controller.ts` and `src/services/productos.service.ts` to one QueryRunner transaction with deterministic locks and atomic mirror updates.
- [ ] 3.3 Verify no POS write route exists and failed requests leave both representations unchanged.

### PR3A Work Unit Evidence

| Evidence          | Result                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `npm test -- --runInBand src/services/inventario.service.spec.ts` — 1 suite, 11 tests passed.                                                       |
| Runtime harness   | QueryRunner unit harness verified strict validation, deterministic locks, dual saves, commit and rollback behavior without shared database writes. |
| Rollback boundary | Revert the central transaction method and its tests; retain PR1 persistence and PR2 reads.                                                         |

## Phase 4: Isolated Verification (PR4)

- [ ] 4.1 Extend `test/inventory-location-stock.integration.spec.ts` with concurrent central updates and final mirror equality.
- [ ] 4.2 Run all integration tests only with `TEST_DATABASE_URL`, `synchronize: false`, and never shared Supabase.
- [ ] 4.3 Run `npm test -- --runInBand`, `npm exec -- tsc --noEmit`, `npm run build`, and `git diff --check`.

