# Location Stock Adjustments Specification

## Purpose

Define the controlled operation used to load and correct stock for an existing inventory location.

## Requirements

### Requirement: Authorized location-scoped adjustment

The system MUST expose an authenticated adjustment operation for an existing product and canonical location. It MUST require the dedicated inventory adjustment permission and MUST NOT modify another location.

#### Scenario: Administrator adjusts POS stock

- GIVEN an administrator, an existing product, and `POS_EDITORIAL`
- WHEN the administrator submits stock `12` with a reason
- THEN the Editorial balance becomes `12`
- AND Bodega Central and other POS balances remain unchanged

#### Scenario: Non-administrator is rejected

- GIVEN a user without the adjustment permission
- WHEN the user submits a location adjustment
- THEN the API returns `403`
- AND no balance or audit row changes

### Requirement: Strict validation and audit

The system MUST accept only integer stock values from `0` through `2147483647` and a non-empty bounded reason. A successful change MUST record the actor, location, product, previous stock, new stock, and reason in the same transaction.

#### Scenario: Invalid payload is rejected

- GIVEN a request with a negative, fractional, string, null, or out-of-range stock
- WHEN the adjustment is submitted
- THEN the API returns `400`
- AND no balance or audit row changes

#### Scenario: Missing data is rejected

- GIVEN an unknown product or non-canonical/uninitialized location
- WHEN the adjustment is submitted
- THEN the API returns `404` or `400` as appropriate
- AND no partial update is committed

### Requirement: Transactional consistency

The system MUST update the balance and audit record atomically and MUST serialize concurrent adjustments for the same product/location.

#### Scenario: Persistence fails during audit

- GIVEN a valid adjustment whose audit insert fails
- WHEN the transaction completes
- THEN the balance returns to its previous value
- AND the API reports an error
