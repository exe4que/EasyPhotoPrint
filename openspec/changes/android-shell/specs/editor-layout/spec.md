## MODIFIED Requirements

### Requirement: Save Template Has No Standalone Panel
The application SHALL NOT show a "Save template" panel, or any other always-present sidebar control, for saving or overwriting a template. Saving the active page's structure as a template SHALL be reachable exclusively through a toolbar button (the same component, present on every host — the app builds no native application menu on any host, see the `electron-shell` capability's "No Custom Application Menu" requirement).

#### Scenario: No Save Template panel in either sidebar
- **WHEN** the editor is showing any page, in either layout mode
- **THEN** neither sidebar SHALL contain a "Save template" panel or button

#### Scenario: Save Template is reachable via a toolbar button on every host
- **WHEN** the user wants to save or overwrite the active page's structure as a template, on any host
- **THEN** a toolbar button (Save Template) SHALL be present and SHALL trigger the save/overwrite flow
