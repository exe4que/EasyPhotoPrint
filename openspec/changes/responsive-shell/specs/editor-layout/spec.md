## MODIFIED Requirements

### Requirement: Layout Tree Panel Lives in the Right Sidebar, Below Properties
This requirement describes the desktop shell (the wide-viewport layout shown at or above the `lg` breakpoint) specifically — see the `mobile-shell` capability for where the Layout Tree panel lives in the mobile shell, which has no sidebars. In the desktop shell, when the layout mode is Nested, the Layout Tree panel SHALL render in the right-hand sidebar, positioned below the Properties panel — not in the left sidebar.

#### Scenario: Nested mode shows the Layout Tree under Properties in the right sidebar
- **WHEN** the layout mode is Nested and the desktop shell is showing (viewport at or above the `lg` breakpoint)
- **THEN** the right sidebar SHALL show the Properties panel followed by the Layout Tree panel, in that order
- **AND** the left sidebar SHALL NOT contain the Layout Tree panel

#### Scenario: Simple mode shows no Layout Tree panel anywhere in the desktop shell
- **WHEN** the layout mode is Simple and the desktop shell is showing
- **THEN** neither sidebar SHALL show the Layout Tree panel, the same as today
