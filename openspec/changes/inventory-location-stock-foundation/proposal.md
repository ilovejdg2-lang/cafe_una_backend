# Proposal: Inventory Location Stock Foundation

## Intent

Replace product-global stock with location-aware balances so Bodega Central and the three points of sale remain independent from ecommerce catalog data.

## Scope

### In Scope
- Persist a catalog with codes and names:
  `BODEGA_CENTRAL` / Bodega Central, `POS_FUNA_UNA` / FUNA-UNA,
  `POS_EDITORIAL` / Editorial, and `POS_STAND_FERIAS` / Stand Ferias.
- Persist and query non-negative integer product/location balances through an authorized API.
- Backfill central stock from `Producto.Stock`; keep it as a temporary atomic mirror.
- Use versioned migrations and isolated PostgreSQL tests; never use shared Supabase.

### Out of Scope
- Transfers, sales, movement history, assets, checkout, or arbitrary location CRUD.
- Removing `Producto.Stock`; that contraction requires a later coordinated release.
- Changing ecommerce availability away from central stock.

## Capabilities

### New Capabilities
- `inventory-locations`: fixed operational locations, identifiers, visibility, and authorization.
- `inventory-location-balances`: product-location persistence, central backfill, balance reads, and compatibility rules.

### Modified Capabilities
- None. No main specs currently exist; this establishes the baseline.

## Approach

Add location and product-location balance entities with unique keys, non-negative constraints, and explicit codes. Seed four locations and zero balances for every product-location pair; absence means zero. Route central writes through a transaction updating the balance and `Producto.Stock` atomically. Preserve `stock`/`Stock` compatibility. Split work into migration, transactional access, and API slices.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/entities`, `src/modules` | New | Location and balance persistence. |
| `src/services`, `src/controllers` | Modified | Balance queries/writes. |
| `src/database` | New/Modified | Migration, data source, isolated tests. |
| `src/common`, `src/guards` | Modified | Location permissions. |
| `Producto.Stock` | Transitional | Central compatibility mirror. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Central mirror drift | Medium | Atomic transaction, constraints, and reconciliation tests. |
| Concurrent updates | Medium | Transaction boundaries and pessimistic row locks. |
| Unsafe rollback | Medium | Refuse destructive down migration when non-central data exists. |

## Rollback Plan

Disable location-aware routes, revert application changes, and run the down migration only when non-central balances are empty and central/legacy values reconcile. Preserve `Producto.Stock` during compatibility.

## Dependencies

- Backend migrations precede frontend location views.
- Frontend must not use `product.stock` for point-of-sale quantities.
- Tests require isolated PostgreSQL via `TEST_DATABASE_URL`.

## Success Criteria

- [ ] Four locations and balances persist with uniqueness and non-negative integer guarantees.
- [ ] Central stock is backfilled without loss and synchronized with `Producto.Stock`.
- [ ] Authorized clients query balances; unauthorized writes are rejected.
- [ ] Idempotency, backfill, rollback, and concurrent updates are tested on isolated PostgreSQL.
- [ ] Existing frontend and ecommerce central-stock behavior remains compatible.
