# Tasks: Location Stock Adjustments

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–350 authored lines |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Contract/tests → service/controller → verification |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Permission, contract, RED HTTP tests | PR 1 | `npm test -- --runInBand src/controllers/inventario.controller.spec.ts` | Nest HTTP test app with guards | Revert permission, route tests, and contract |
| 2 | Atomic service adjustment and audit | PR 2 | `npm test -- --runInBand src/services/inventario.service.spec.ts` | QueryRunner unit harness | Revert service method and unit tests |
| 3 | Regression and isolated verification | PR 3 | `npm test -- --runInBand` | Existing isolated PostgreSQL harness | Revert verification-only changes |

## Phase 1: Contract and RED Tests

- [x] 1.1 Add `ajustar_stock_ubicaciones` to backend permissions.
- [x] 1.2 Add RED HTTP tests for authorization, casing, invalid location/product, and no mutation.

## Phase 2: Atomic Implementation

- [x] 2.1 Add strict adjustment validation and transaction orchestration to `InventarioService`.
- [x] 2.2 Insert audit details in the same transaction and expose the controller route.
- [x] 2.3 Add service tests for success, locks, rollback, no-op, and audit failure.

## Phase 3: Verification

- [x] 3.1 Run focused and full Jest suites, typecheck, build, and diff checks.
- [x] 3.2 Verify the route against isolated PostgreSQL; do not write shared Supabase data.

### Work Unit Evidence

| Unit | Evidence |
|------|----------|
| 1 | `npm test -- --runInBand src/controllers/inventario.controller.spec.ts` — 1 suite, 12 tests passed; Nest HTTP harness verified permission and casing. Rollback: revert permission, route tests, and contract. |
| 2 | `npm test -- --runInBand src/services/inventario.service.spec.ts` — 1 suite, 27 tests passed; QueryRunner harness verified locks, atomic audit, central rejection, no-op, and rollback. Rollback: revert service/controller implementation and unit tests. |
| 3 | `npm run test:integration -- --runInBand` — 3 suites, 14 tests passed against temporary PostgreSQL on `127.0.0.1:5433`; `npm test -- --runInBand` — 5 suites, 55 tests passed; `npm exec -- tsc --noEmit`, `npm run build`, focused ESLint (0 errors, 12 pre-existing warnings), and `git diff --check` passed. |
