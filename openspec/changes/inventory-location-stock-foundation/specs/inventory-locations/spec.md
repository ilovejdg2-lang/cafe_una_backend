# Inventory Locations Specification

## Purpose

Define the fixed operational locations used by product inventory. This foundation MUST keep location identity stable before point-of-sale workflows are implemented.

## Requirements

### Requirement: Canonical operational locations

The system MUST provide exactly these canonical locations with stable unique codes and display names:
`BODEGA_CENTRAL` / `Bodega Central`, `POS_FUNA_UNA` / `FUNA-UNA`, `POS_EDITORIAL` / `Editorial`, and `POS_STAND_FERIAS` / `Stand Ferias`.

#### Scenario: Seed canonical locations

- GIVEN the location schema is initialized
- WHEN the initialization is applied more than once
- THEN all four canonical locations exist exactly once
- AND their codes and names remain unchanged

#### Scenario: Reject duplicate or unknown location identity

- GIVEN a request attempts to create or mutate a location identity
- WHEN the operation uses a duplicate code or an unapproved operational code
- THEN the system MUST reject the operation
- AND no canonical location is changed

### Requirement: Authorized location visibility

Clients with `ver_inventario` permission MUST be able to query the canonical location catalog. Clients without that permission MUST NOT receive location data and MUST receive an authorization error.

#### Scenario: Authorized client lists locations

- GIVEN an authenticated client has `ver_inventario`
- WHEN the client queries operational locations
- THEN the response contains the four canonical locations
- AND each item includes its stable code and display name

#### Scenario: Unauthorized client lists locations

- GIVEN an authenticated client lacks `ver_inventario`
- WHEN the client queries operational locations
- THEN the system returns HTTP 403
- AND no location data is returned

### Requirement: Fixed catalog boundary

The system MUST NOT expose arbitrary location CRUD in this change. Transfers, sales, assets, movement history, and point-of-sale workflows MUST NOT be implemented as location behavior here.

#### Scenario: Attempt arbitrary location administration

- GIVEN a client attempts to add, delete, or rename an operational location
- WHEN the request targets the F06 location API
- THEN the system MUST reject the unsupported operation
- AND the canonical catalog remains intact
