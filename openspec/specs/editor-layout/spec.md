# editor-layout Specification

## Purpose

Documents which editor panels exist and where they live in the app shell, independent of what each panel's own content does — so a panel's position or presence is a tracked decision, not incidental layout.

## Requirements

### Requirement: Save Template Has No Standalone Panel
The application SHALL NOT show a "Save template" panel, or any other always-present sidebar control, for saving or overwriting a template. Saving the active page's structure as a template SHALL be reachable exclusively through `Save Template` and `Save Template As` items in the shared `Edit` menu (the same in-app menu-bar component, present on every host — the app builds no native application menu on any host, see the `electron-shell` capability's "No Custom Application Menu" requirement).

#### Scenario: No Save Template panel in either sidebar
- **WHEN** the editor is showing any page, in either layout mode
- **THEN** neither sidebar SHALL contain a "Save template" panel or button

#### Scenario: Save Template is reachable via the Edit menu on every host
- **WHEN** the user wants to save or overwrite the active page's structure as a template, on any host
- **THEN** the `Edit` menu SHALL contain a `Save Template` item, and activating it SHALL trigger the save/overwrite flow

### Requirement: Layout Tree Panel Lives in the Right Sidebar, Below Properties
This requirement describes the desktop shell (the wide-viewport layout shown at or above the `lg` breakpoint) specifically — see the `mobile-shell` capability for where the Layout Tree panel lives in the mobile shell, which has no sidebars. In the desktop shell, when the layout mode is Nested, the Layout Tree panel SHALL render in the right-hand sidebar, positioned below the Properties panel — not in the left sidebar.

#### Scenario: Nested mode shows the Layout Tree under Properties in the right sidebar
- **WHEN** the layout mode is Nested and the desktop shell is showing (viewport at or above the `lg` breakpoint)
- **THEN** the right sidebar SHALL show the Properties panel followed by the Layout Tree panel, in that order
- **AND** the left sidebar SHALL NOT contain the Layout Tree panel

#### Scenario: Simple mode shows no Layout Tree panel anywhere in the desktop shell
- **WHEN** the layout mode is Simple and the desktop shell is showing
- **THEN** neither sidebar SHALL show the Layout Tree panel, the same as today
