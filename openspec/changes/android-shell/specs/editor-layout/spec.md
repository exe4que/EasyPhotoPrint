## MODIFIED Requirements

### Requirement: Save Template Has No Standalone Panel
The application SHALL NOT show a "Save template" panel, or any other always-present sidebar control, for saving or overwriting a template. Saving the active page's structure as a template SHALL be reachable through a toolbar button (present on every host) and — on a host with a native application menu — the `Edit > Save Template` and `Edit > Save Template As...` menu items as an additional trigger for the same action.

#### Scenario: No Save Template panel in either sidebar
- **WHEN** the editor is showing any page, in either layout mode
- **THEN** neither sidebar SHALL contain a "Save template" panel or button

#### Scenario: Save Template is reachable via a toolbar button on every host
- **WHEN** the user wants to save or overwrite the active page's structure as a template, on any host
- **THEN** a toolbar button (Save Template) SHALL be present and SHALL trigger the same save/overwrite flow the `Edit` menu triggers on a host that has one

#### Scenario: The application menu is an additional trigger where the host has one
- **WHEN** the application runs on a host with a native application menu (for example, Electron)
- **THEN** `Edit > Save Template` and `Edit > Save Template As...` SHALL also trigger saving a template, alongside the toolbar button
