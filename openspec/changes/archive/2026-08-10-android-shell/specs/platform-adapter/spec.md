## MODIFIED Requirements

### Requirement: The Platform Contract Is Total
Every registered adapter SHALL implement every member of the contract. A host that cannot provide a capability SHALL absorb that inside its own adapter with an implementation that still honors the member's shape and leaves application state unchanged — never by omitting the member, and never by requiring shared code to check whether it exists.

#### Scenario: Shared code never tests for a member's presence
- **WHEN** shared renderer code uses any contract member
- **THEN** it SHALL call that member directly
- **AND** it SHALL NOT guard the call with a presence or capability check
