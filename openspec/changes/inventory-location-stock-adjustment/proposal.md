# Proposal: Adjust Stock by Inventory Location

## Intent

Administrators need to load the real opening stock of each point of sale without changing Bodega Central or editing the database directly.

## Scope

### In Scope
- Add an authenticated, location-scoped stock adjustment endpoint.
- Update the selected product/location balance atomically.
- Record the actor, previous value, new value, and reason in audit history.
- Keep the existing central-stock endpoint compatible.

### Out of Scope
- Transfers between locations.
- Sales stock deduction.
- The Points of Sale sidebar and detail UI.
- Creating or deleting locations.

## Capabilities

### New Capabilities
- `location-stock-adjustments`: Authorized, audited stock adjustments for an existing product and canonical location.

### Modified Capabilities
- None.

## Approach

Add a guarded `InventarioController` write route backed by one QueryRunner transaction. Lock the product and balance deterministically, validate strict integer quantities and a bounded reason, update only the selected location, and write an audit record in the same transaction. Bodega Central continues to mirror `Producto.Stock` through its legacy endpoint.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| Inventory service/controller | Modified | New location-scoped adjustment contract and authorization. |
| Permissions | Modified | Dedicated administrator permission. |
| Tests | Modified | RED/green service and HTTP coverage. |
| Audit | Modified | Adjustment details recorded transactionally. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| POS balance is changed without traceability | Low | Require permission, reason, actor, and atomic audit insert. |
| Concurrent edits lose stock | Low | Pessimistic locks and one transaction. |

## Rollback Plan

Revert the adjustment route, permission, service method, audit mapping, and tests. Existing location reads and central compatibility remain intact.

## Dependencies

- The location/stock migration must already be applied in the target database.

## Success Criteria

- [ ] An authorized administrator can adjust a POS balance with a reason.
- [ ] Unauthorized, invalid, missing, and concurrent requests fail safely without partial writes.
- [ ] Existing central stock behavior remains compatible.
