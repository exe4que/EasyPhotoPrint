## Purpose

The units-settings capability lets a user choose whether all length measurements in the app are displayed and entered in millimeters or in inches, and persists that preference (along with an optional default printer name) outside any project so it survives across sessions and projects.

## ADDED Requirements

### Requirement: Metric/Imperial Unit Toggle
The system SHALL provide a toggle, exposed in the UI as `UnitToggle`, that lets the user switch the active unit system between `metric` and `imperial`. The active unit system SHALL be read from and written to the `settings` slice of the application store.

#### Scenario: User switches from metric to imperial
- **WHEN** the user clicks the "in" option in the unit toggle while the active unit system is `metric`
- **THEN** the store's `settings.unitSystem` SHALL become `imperial` and the toggle SHALL visually indicate `imperial` as the active option

#### Scenario: User switches from imperial to metric
- **WHEN** the user clicks the "mm" option in the unit toggle while the active unit system is `imperial`
- **THEN** the store's `settings.unitSystem` SHALL become `metric` and the toggle SHALL visually indicate `metric` as the active option

### Requirement: Millimeters Are the Only Persisted Unit
The system SHALL treat millimeters as the sole canonical unit for length values. Changing the active unit system SHALL NOT alter any persisted numeric value (e.g. page dimensions, custom size fields) — only how those values are formatted for display and how typed input is interpreted.

#### Scenario: Toggling units does not change underlying page dimensions
- **WHEN** a page has a custom size of `210` x `297` (stored in millimeters) and the user switches the unit system from `metric` to `imperial`
- **THEN** the underlying stored `widthMm`/`heightMm` values SHALL remain unchanged, and only their displayed representation SHALL switch to an inches-formatted string

### Requirement: Length Formatting Respects Active Unit System
The system SHALL provide a `formatLength` function that converts an internal millimeter value into a display string according to the active unit system: in `metric` it SHALL render the value with one decimal place followed by an `mm` suffix; in `imperial` it SHALL render the value converted to inches with two decimal places followed by a `"` suffix.

#### Scenario: Formatting a length in metric
- **WHEN** `formatLength` is called with a millimeter value and unit system `metric`
- **THEN** it SHALL return the value rounded to one decimal place with an `mm` suffix (e.g. `"210.0mm"`)

#### Scenario: Formatting a length in imperial
- **WHEN** `formatLength` is called with a millimeter value and unit system `imperial`
- **THEN** it SHALL return the value converted to inches, rounded to two decimal places, with a `"` suffix (e.g. `"8.27""`)

### Requirement: Length Parsing Respects Active Unit System
The system SHALL provide a `parseLength` function that interprets user-typed numeric text and returns a value in millimeters, honoring the active unit system: in `imperial` the typed number SHALL be interpreted as inches and converted to millimeters; in `metric` the typed number SHALL be interpreted as millimeters directly. Non-numeric characters other than digits, the decimal point, and a minus sign SHALL be stripped before parsing, and input that yields no finite number SHALL raise an error.

#### Scenario: Parsing user input in imperial
- **WHEN** `parseLength` is called with the text `"8.27"` and unit system `imperial`
- **THEN** it SHALL return the equivalent value in millimeters (inches × 25.4)

#### Scenario: Parsing user input in metric
- **WHEN** `parseLength` is called with the text `"210"` and unit system `metric`
- **THEN** it SHALL return `210` unchanged, interpreted as millimeters

#### Scenario: Parsing unparseable input
- **WHEN** `parseLength` is called with text that contains no extractable numeric value
- **THEN** it SHALL throw an error rather than returning `NaN` or a silently defaulted value

### Requirement: Numeric Inputs Across the App Use Shared Formatting
Numeric length inputs and labels in the page setup panel, properties panel, canvas dimension display, and freeform element controls SHALL use the shared `formatLength`/`parseLength` functions rather than each implementing their own conversion or rounding logic, so that a value displayed or entered in one part of the UI is consistent with every other part under the same active unit system.

#### Scenario: Page setup custom size field reflects active unit system
- **WHEN** the active unit system is `imperial` and the user opens the page setup panel with a `Custom` page size
- **THEN** the custom width and height fields SHALL display their default values formatted via `formatLength` in inches

### Requirement: DPI Is Not Affected by the Unit Toggle
The system SHALL always display and accept the page DPI value as a plain numeric DPI figure, independent of the active unit system. The unit toggle SHALL NOT convert or reformat the DPI field.

#### Scenario: DPI field ignores active unit system
- **WHEN** the active unit system is `imperial`
- **THEN** the DPI input SHALL still display and accept a raw DPI number with no unit conversion applied

### Requirement: Settings Persist Outside the Project via IPC
The system SHALL persist `AppSettings` (`unitSystem`, defaulting to `metric`, and an optional `defaultPrinterName`) to a `settings.json` file in the application's user-data directory, independent of any `.eppproj`/`.epptemplate` file. The renderer SHALL read and write this state exclusively through the `settings:get` and `settings:set` IPC channels, never by direct filesystem access.

#### Scenario: Settings are loaded on app startup
- **WHEN** the renderer application mounts
- **THEN** it SHALL invoke the settings-hydration action, which calls the `settings:get` IPC channel and populates the store's `settings` slice with the result

#### Scenario: Missing settings file falls back to defaults
- **WHEN** the `settings:get` handler is invoked and no `settings.json` file exists yet on disk
- **THEN** it SHALL return the default settings (`unitSystem: 'metric'`, no `defaultPrinterName`) without erroring

#### Scenario: Setting the unit system persists to disk
- **WHEN** the renderer calls the unit-system-setting action with a new value
- **THEN** it SHALL invoke the `settings:set` IPC channel with a patch containing that value, the main process SHALL merge it with the existing persisted settings and write the merged result to `settings.json`, and the renderer's `settings` slice SHALL be updated with the returned settings

#### Scenario: Partial settings patch preserves unrelated fields
- **WHEN** `settings:set` is called with a patch that includes only `unitSystem`
- **THEN** the previously persisted `defaultPrinterName` (if any) SHALL be preserved unchanged in the resulting settings

### Requirement: Settings Are Excluded From Document Undo/Redo History
The system SHALL exclude the `settings` slice from the document's undo/redo history tracking, so that changing the unit system is never itself an undoable/redoable action and never interacts with the document history stack.

#### Scenario: Undo history is unaffected by a unit system change
- **WHEN** the user changes the unit system and then triggers undo
- **THEN** the undo operation SHALL affect only document state (structure and assignments) and SHALL NOT revert the unit system change
