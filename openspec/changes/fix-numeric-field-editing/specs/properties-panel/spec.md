## ADDED Requirements

### Requirement: Numeric Property Fields Support Free-Text Editing
The panel's numeric fields (Rows, Columns, Slots) SHALL let the user clear the field's text entirely while editing, without the field snapping back to its previous or minimum value before the user has finished editing it. On commit (the field losing focus, or the user pressing Enter), text that is empty, does not parse to a valid number, or falls below the field's minimum SHALL cause the field to revert to its last valid committed value, rather than being silently clamped to an intermediate value mid-edit.

#### Scenario: Field can be cleared and retyped without snapping back
- **WHEN** the user selects a numeric field's text and deletes it entirely
- **THEN** the field displays empty text, not its previous or minimum value, until the user types a new value or leaves the field

#### Scenario: Invalid or below-minimum input reverts on commit
- **WHEN** the user leaves the field, or presses Enter, while it holds text that is empty, non-numeric, or below the field's minimum
- **THEN** the field's displayed value, and the underlying node's configuration, revert to the last valid committed value
