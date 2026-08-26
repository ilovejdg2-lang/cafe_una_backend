## Exploration: Inventory Location Stock Foundation

### Current State

The backend is a NestJS 11 REST API using TypeORM 0.3 and PostgreSQL on Supabase. PostgreSQL configuration has `synchronize: false`; a TypeORM migration `DataSource`, migration scripts, and an isolated PostgreSQL test helper already exist, but no inventory schema migration is present yet. Integration tests reject Supabase hosts and require `TEST_DATABASE_URL` for a separate local PostgreSQL database.

Inventory is currently product-global: `Producto` owns the mutable `Stock` column, and `ProductosService` creates, updates, decrements, and validates featured products against that value. `PUT /api/productos/:id/stock-central` currently writes the same global column and returns `locationCode: BODEGA_CENTRAL` as a hard-coded response value; it does not persist a location balance. The existing adjustment transaction also operates on `Producto.Stock` without pessimistic row locks.

There is no location entity, product-location balance entity, location repository, or inventory module. `ProductosModule` registers only `Producto`. The permission catalog already contains `ver_inventario`, `actualizar_inventario`, and `actualizar_stock_productos`, while `PermisosGuard` supports route-level permission checks. The legacy product update route accepts an OR of catalog, stock, and inactivation permissions, so it must not become the authorization boundary for location-specific writes without field-aware checks.

The prior OpenSpec change `separate-product-catalog-from-location-stock` established an expand-and-contract direction and intentionally limited its first slice to `BODEGA_CENTRAL`, excluding sales-point balances, transfers, sales, assets, and stock-history workflows. This F06 exploration extends the foundation to the requested four fixed locations while retaining the compatibility constraints from that change.

### Affected Areas

- `src/entities/producto.entity.ts` — currently contains the only persisted stock quantity and must remain a transitional central-stock mirror until a later contraction.
- `src/entities/index.ts` — must register location and product-location balance entities when implementation starts.
- `src/modules/productos.module.ts` — must register the new repositories; a separate inventory module may be preferable if location operations grow beyond product concerns.
- `src/services/productos.service.ts` — currently owns global stock mutations, featured rules, and legacy compatibility behavior; central writes will eventually need a transaction and row locking.
- `src/controllers/productos.controller.ts` — exposes the hard-coded central-stock contract and a broad legacy update route; location-aware read/write endpoints need explicit contracts and authorization.
- `src/common/permisos.ts` and `src/guards/permisos.guard.ts` — existing inventory and stock permissions need a clear distinction between viewing locations, managing balances, and managing the location catalog.
- `src/config/postgres.config.ts` and `src/database/data-source.ts` — production uses Supabase with migrations disabled from automatic synchronization; migration execution must remain explicit and versioned.
- `src/database/postgres-test-data-source-options.ts` and `test/support/postgres-test-data-source.ts` — provide the isolated PostgreSQL path for migration, constraint, backfill, and concurrency tests; tests must never use the shared Supabase project.
- `src/services/database-bootstrap.service.ts` — currently performs an ad-hoc `ALTER TABLE`; new location tables should not be added here because schema evolution belongs in versioned migrations.
- `src/controllers/productos.controller.spec.ts` and `src/services/productos.service.spec.ts` — existing tests cover only the hard-coded central endpoint and global `Producto.Stock`; they will need compatibility and location-boundary coverage in later implementation slices.
- `openspec/changes/separate-product-catalog-from-location-stock/` — existing proposal, design, specs, and tasks are the baseline and contain the prior central-only scope that this F06 change must clarify or supersede.

### Approaches

1. **Four-location foundation with compatibility mirror** — add a stable location catalog seeded with `BODEGA_CENTRAL` and three fixed point-of-sale codes, add one non-negative balance per product-location pair, backfill central balances from `Producto.Stock`, and keep `Producto.Stock` as a temporary central mirror. Do not implement transfers, sales, movements, assets, or arbitrary location administration in this slice.
   - Pros: Enables real separation by location without breaking the current frontend/API; preserves rollback; makes all four operational locations explicit before sales and transfers are built.
   - Cons: Temporarily keeps duplicated central data; requires a reconciliation rule and atomic dual writes; canonical point-of-sale codes and display names must be confirmed.
   - Effort: Medium

2. **Immediate location cutover** — remove or ignore `Producto.Stock` and require every product read and mutation to use a location balance immediately.
   - Pros: One source of truth and no compatibility mirror.
   - Cons: Breaks the existing frontend and legacy callers; requires synchronized database/application deployment; makes rollback and review substantially harder.
   - Effort: High

3. **Location metadata without persisted balances** — add only location records and keep quantities in the product row or an inferred structure until sales/transfer work begins.
   - Pros: Smallest initial schema change.
   - Cons: Does not provide inventory by location; invites mixing central and point-of-sale stock; would force another data-model migration before the requested workflows.
   - Effort: Low initially, High overall

### Recommendation

Use **Approach 1: four-location foundation with a compatibility mirror**. Persist four stable locations, using explicit canonical codes that must be agreed before the proposal (for example, `BODEGA_CENTRAL` plus three `PUNTO_VENTA_*` codes), and enforce unique codes and non-negative integer quantities at the database level. The migration should be idempotent, seed the four locations, backfill existing `Producto.Stock` only into the central balance, and initialize point-of-sale balances to zero or create them lazily according to the approved data-volume decision.

The location-balance table should be authoritative for new location-aware behavior. During the compatibility window, `Producto.Stock` MUST mean only central stock and MUST be updated atomically with central balance writes. Existing casing behavior (`stock` input, PascalCase compatibility input, camelCase responses) should remain stable. The existing central endpoint should not continue pretending that a global column is location-aware; a later implementation slice must either route it through the central balance transaction or keep it explicitly transitional until that cutover is complete.

Implementation should be split into reviewable slices: migration and constraints first; transactional balance access and reconciliation second; location-aware read/contract and authorization third. Each slice requires isolated PostgreSQL tests for migration idempotency, unique/non-negative constraints, backfill preservation, rollback safety, and concurrent writes. Supabase may be used only as the application integration target after migration review; it MUST NOT be used as the integration-test database.

This foundation must explicitly exclude assets, sales, transfers, movement history, point-of-sale checkout behavior, and location CRUD. Those workflows should consume the location model later rather than introducing competing stock representations now.

### Risks

- Canonical codes and names for the three points of sale are not present in the current backend; guessing them would create an API/data contract that is difficult to rename safely.
- Keeping `Producto.Stock` and central balance duplicated can cause drift if any stock mutation bypasses the transaction service.
- The current `PUT /productos/:id` permission OR semantics could allow a stock-only role to change catalog fields unless field-aware authorization is introduced before broadening location writes.
- The existing stock adjustment and central endpoint do not use pessimistic locks, so concurrent decrements remain unsafe until the transactional cutover is implemented.
- A destructive migration rollback could lose non-central balances; the down migration must refuse rollback when non-central data or central/legacy drift exists.
- The current Supabase pooler configuration is suitable for the application but is not an acceptable test database; local PostgreSQL or another isolated non-Supabase instance is required.
- Seeding four locations does not by itself implement transfers or sales; those features need separate invariants, permissions, and transaction boundaries.

### Ready for Proposal

Yes, with two decisions recorded in the proposal before implementation: the canonical codes/display names for the three points of sale, and whether the migration creates zero-valued balance rows for every product-location pair or creates non-central rows lazily. The proposal should also state that this F06 foundation supersedes the prior central-only scope while preserving the existing expand-and-contract and Supabase-safe testing strategy.
