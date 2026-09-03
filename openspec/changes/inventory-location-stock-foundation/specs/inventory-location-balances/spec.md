# Inventory Location Balances Specification

## Purpose

Define non-negative product quantities scoped by canonical location while preserving ecommerce compatibility with the legacy central-stock column.

## Requirements

### Requirement: Product-location balance integrity

The system MUST persist at most one balance per product and canonical location. A balance MUST be a non-negative integer in the PostgreSQL integer range, and the database and API MUST enforce these invariants.

#### Scenario: Read a persisted balance

- GIVEN a product has a balance at `POS_FUNA_UNA`
- WHEN an authorized client queries that product and location
- THEN the response returns only that location's quantity
- AND it MUST NOT substitute Bodega Central or another location's quantity

#### Scenario: Reject invalid quantity

- GIVEN a balance write receives a negative number, a fractional number, a value outside the integer range, or a string/null coercion
- WHEN validation runs
- THEN the system MUST return a client validation error
- AND the persisted balance MUST remain unchanged

### Requirement: Authorized balance queries

Balance reads MUST require `ver_inventario`. Balance writes in F06 MUST require `actualizar_stock_productos` and MUST be limited to the central compatibility path; direct point-of-sale editing is out of scope.

#### Scenario: Reject unauthorized balance access

- GIVEN a client lacks the required inventory permission
- WHEN the client reads or writes a product-location balance
- THEN the system MUST return HTTP 403
- AND the balance MUST remain unchanged

### Requirement: Missing versus confirmed zero

For availability, an absent product-location balance MUST behave as zero. A location-aware response MUST distinguish an absent record from a persisted record whose quantity is explicitly zero.

#### Scenario: Missing balance

- GIVEN no balance row exists for a valid product and location
- WHEN an authorized client queries it
- THEN availability is reported as zero
- AND the response marks the balance as absent or unprovisioned

#### Scenario: Confirmed zero balance

- GIVEN a balance row exists with quantity zero
- WHEN an authorized client queries it
- THEN the response reports quantity zero
- AND the response marks the balance as provisioned

### Requirement: Central backfill and compatibility mirror

The migration MUST create the four locations and backfill each product's central balance from `Producto.Stock` without loss. During the compatibility window, `Producto.Stock` MUST mean only Bodega Central stock. A central update MUST atomically update both representations; a zero central balance MUST clear `EsDestacado`.

#### Scenario: Backfill legacy central stock

- GIVEN an existing product has `Producto.Stock = 12`
- WHEN the forward migration runs
- THEN its `BODEGA_CENTRAL` balance is 12
- AND non-central balances are initialized to zero

#### Scenario: Atomic central update

- GIVEN an authorized central-stock update changes a product to 7
- WHEN the transaction commits
- THEN the central balance and `Producto.Stock` both equal 7
- AND if the transaction fails, neither representation changes

### Requirement: Concurrent central updates

Central balance writes MUST execute within a transaction that prevents lost updates for the same product/location pair. Concurrent requests MUST serialize against the same balance and MUST preserve the final committed invariant.

#### Scenario: Concurrent updates to one central balance

- GIVEN two authorized requests update the same product's central balance concurrently
- WHEN both requests complete
- THEN each commit observes a valid non-negative integer
- AND the final central balance equals the value of the last committed update
- AND `Producto.Stock` equals that final central balance
