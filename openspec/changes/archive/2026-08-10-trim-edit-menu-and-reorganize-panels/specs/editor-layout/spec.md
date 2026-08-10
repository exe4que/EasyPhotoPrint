## Purpose

Documents which editor panels exist and where they live in the app shell, independent of what each panel's own content does — so a panel's position or presence is a tracked decision, not incidental layout.

## ADDED Requirements

### Requirement: Save Template Has No Standalone Panel
The application SHALL NOT show a "Save template" panel, or any other always-present sidebar control, for saving or overwriting a template. Saving the active page's structure as a template SHALL be reachable only through the `Edit > Save Template` and `Edit > Save Template As...` menu items.

#### Scenario: No Save Template panel in either sidebar
- **WHEN** the editor is showing any page, in either layout mode
- **THEN** neither sidebar SHALL contain a "Save template" panel or button
- **AND** the only way to save the current page as a template SHALL be through the `Edit` menu

### Requirement: Layout Tree Panel Lives in the Right Sidebar, Below Properties
When the layout mode is Nested, the Layout Tree panel SHALL render in the right-hand sidebar, positioned below the Properties panel — not in the left sidebar.

#### Scenario: Nested mode shows the Layout Tree under Properties in the right sidebar
- **WHEN** the layout mode is Nested
- **THEN** the right sidebar SHALL show the Properties panel followed by the Layout Tree panel, in that order
- **AND** the left sidebar SHALL NOT contain the Layout Tree panel

#### Scenario: Simple mode shows no Layout Tree panel anywhere
- **WHEN** the layout mode is Simple
- **THEN** neither sidebar SHALL show the Layout Tree panel, the same as today
