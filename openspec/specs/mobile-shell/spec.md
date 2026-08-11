# mobile-shell Specification

## Purpose

The mobile-shell capability defines the canvas-first, bottom-sheet editor shell shown below the desktop breakpoint — replacing the single-column stack the app would otherwise fall back to on a narrow viewport — so the editor stays usable on a phone-sized screen without the canvas being scrolled out of view, while reusing every panel component and all store logic the desktop shell already uses.

## Requirements

### Requirement: Viewport Width Selects Between Desktop and Mobile Shells
The application SHALL choose between the desktop shell and the mobile shell based on viewport width alone, evaluated reactively at runtime (not a one-time check at mount), using the same breakpoint the application's CSS already treats as the desktop/mobile boundary. This SHALL NOT be a platform check (Electron vs. Android) — a desktop window narrowed below the breakpoint SHALL show the mobile shell, and an Android device or emulator in a wide/landscape configuration at or above the breakpoint SHALL show the desktop shell.

#### Scenario: Narrowing a desktop window switches to the mobile shell
- **WHEN** the application is running on Electron and the window is resized from at or above the breakpoint to below it
- **THEN** the rendered shell SHALL switch from the desktop shell to the mobile shell without a reload
- **AND** the current document, selection, and undo/redo history SHALL be unaffected by the switch

#### Scenario: Widening back across the breakpoint restores the desktop shell
- **WHEN** the viewport width crosses back above the breakpoint
- **THEN** the rendered shell SHALL switch back to the desktop shell

### Requirement: Mobile Shell Is Canvas-First
In the mobile shell, the page canvas SHALL fill the available viewport and SHALL remain visible at all times — never scrolled out of view by other content, unlike the single-column stack the application falls back to today without this capability.

#### Scenario: The canvas is visible immediately on entering the mobile shell
- **WHEN** the mobile shell is showing, regardless of which bottom-sheet tab (if any) is open
- **THEN** the page canvas SHALL be visible without requiring the user to scroll

### Requirement: Bottom Tab Bar With Four Destinations
The mobile shell SHALL provide a persistent bottom tab bar with exactly four destinations — `Page`, `Layout`, `Photos`, and `Templates` — each corresponding to an existing desktop panel (page size/orientation/DPI settings, layout-mode controls and, in Nested mode, the Layout Tree, the image library, and the template gallery, respectively). Activating a destination SHALL open a bottom sheet showing that destination's content; activating the already-open destination, or dismissing the sheet, SHALL close it.

#### Scenario: Each tab opens its corresponding panel's content
- **WHEN** the user activates a bottom tab bar destination
- **THEN** a bottom sheet SHALL open showing the same panel component the desktop shell uses for that content, reading and writing the same application store

#### Scenario: The bottom tab bar has no fifth destination for Properties or Save Template
- **WHEN** the mobile shell is showing
- **THEN** the bottom tab bar SHALL NOT contain a destination for the Properties panel or for saving a template — both are reachable by other means (see the Properties requirement below, and the `editor-layout` capability's "Save Template Has No Standalone Panel" requirement, satisfied on mobile via the shared `Edit` menu)

### Requirement: Properties Rises As Its Own Sheet On Selection
In the mobile shell, the Properties panel SHALL NOT occupy a bottom tab bar destination. Instead, selecting a slot, freeform element, or library image SHALL automatically open a bottom sheet showing the Properties panel; clearing the selection SHALL automatically close it.

#### Scenario: Selecting a slot opens the Properties sheet automatically
- **WHEN** the user selects an image slot, freeform element, or library image in the mobile shell
- **THEN** a bottom sheet showing the Properties panel SHALL open automatically, without the user activating a tab bar destination

#### Scenario: Clearing the selection closes the Properties sheet automatically
- **WHEN** the selection is cleared while the Properties sheet is open
- **THEN** the Properties sheet SHALL close automatically

### Requirement: Mobile Shell Reuses Desktop Panel Components Without Duplicating Logic
The mobile shell's bottom sheets SHALL render the same panel components the desktop shell renders (`PageSetupPanel`, `PropertiesPanel`, `ImageLibraryPanel`, `TemplateGallery`, and — in Nested mode — `LayoutTreePanel`), reading and writing the same application store, rather than a parallel mobile-specific reimplementation of any panel's logic.

#### Scenario: A change made in a mobile sheet is visible on the desktop shell
- **WHEN** the user changes a value in a panel shown inside a mobile bottom sheet (for example, page DPI), then the viewport widens across the breakpoint
- **THEN** the desktop shell SHALL reflect that same change, because both shells render the same panel component against the same store

### Requirement: Persistent Page Navigation Strip
The mobile shell SHALL keep page navigation (previous/next page, add page) accessible at all times, without requiring the user to open a bottom sheet — switching between pages SHALL NOT be gated behind any tab.

#### Scenario: Page navigation works with every bottom sheet closed
- **WHEN** the mobile shell is showing with no bottom sheet open
- **THEN** the user SHALL be able to move to the previous or next page, or add a page, directly

### Requirement: Nested Layout Mode Works Identically On Mobile
The mobile shell SHALL support Nested layout mode with the same functionality the desktop shell provides — no reduced or read-only variant. The Layout Tree panel and divider-drag resizing SHALL both work inside the mobile shell's `Layout` tab sheet.

#### Scenario: Switching to Nested mode shows the Layout Tree panel in the Layout sheet
- **WHEN** the user switches to Nested layout mode in the mobile shell and opens the `Layout` tab
- **THEN** the sheet SHALL show the Layout Tree panel, the same component the desktop shell's right sidebar shows in Nested mode

#### Scenario: Divider dragging works the same as on desktop
- **WHEN** the user drags a container divider on the canvas in the mobile shell
- **THEN** sibling nodes SHALL resize exactly as they do in the desktop shell, using the same Pointer Events-based gesture handling `canvas-interaction` already defines
