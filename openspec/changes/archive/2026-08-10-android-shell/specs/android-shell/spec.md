## Purpose

The android-shell capability defines how Easy Photo Print boots on Android — inside a WebView-hosted build of the same renderer used on desktop — and what backs each native capability (file access, settings, PDF export, printing) the platform-adapter contract requires, so the app is fully usable end to end on an Android device with no feature silently missing or fake.

## ADDED Requirements

### Requirement: Android Adapter Registered Before First Render
The Android build's entry point SHALL register a complete platform adapter, satisfying every member of the platform contract, before the application renders for the first time — the Android counterpart to the Electron entry point's own registration, per the `platform-adapter` capability's registration requirement.

#### Scenario: App starts on Android
- **WHEN** the application launches on an Android device or emulator
- **THEN** its entry point SHALL register the Android platform adapter before the first render
- **AND** the same renderer code that runs on desktop SHALL render without requiring any Android-specific code path in shared UI components, the store, or shared hooks

### Requirement: Native Document Picker Backs Image Ingest and Project Files
Selecting images to ingest, opening a project, and saving a project SHALL each invoke Android's native document picker, scoped to the same file-type expectations as the desktop native dialogs (image formats for ingest/relink, `.eppproj` for project open/save). A file selected or created through the picker SHALL be usable immediately — read for project/image ingestion, or written to for project save — without any additional user action beyond the picker interaction itself.

#### Scenario: Loading images opens the native picker
- **WHEN** the user activates "Load images" on Android
- **THEN** Android's native document picker SHALL open, filtered to common raster image formats
- **AND** each file selected SHALL be added to the image pool as a fully-formed image asset (with its decoded dimensions and a thumbnail), the same as selecting images does on desktop

#### Scenario: Opening a project opens the native picker and loads it
- **WHEN** the user activates "Open project" on Android and selects a `.eppproj` file in the native picker
- **THEN** the project SHALL load with all of its pages, layout, and images, the same as opening a project does on desktop

#### Scenario: Saving a project for the first time prompts for a location
- **WHEN** the user saves a project on Android that has never been saved before
- **THEN** Android's native document picker SHALL open in "create" mode, letting the user choose where the `.eppproj` file is created
- **AND** subsequent saves of that same project SHALL write to that same location without prompting again, until "Save As" is used

### Requirement: Settings Persist Outside Any Project on Android
The unit-system preference and default printer name SHALL persist across app restarts on Android, using the device's native per-app preference storage, the same durability guarantee `units-settings` already requires generically.

#### Scenario: Unit preference survives an app restart
- **WHEN** the user changes the active unit system on Android and then fully closes and reopens the app
- **THEN** the unit system SHALL still reflect the user's last choice

### Requirement: PDF Export and Printing Produce Real, Complete Output on Android
Activating "Export PDF" or "Print" on Android SHALL produce output equivalent in content to the desktop implementation — every page, every placed image at its configured position/scale/rotation, at a resolution sufficient for its configured print size and DPI — satisfying `pdf-export` and `printing`'s existing requirements on this host, not a reduced or placeholder version of them.

#### Scenario: Export PDF on Android writes a complete, valid file
- **WHEN** the user activates "Export PDF" on Android and chooses a destination in the native picker
- **THEN** the resulting file SHALL be a valid PDF containing one page per project page, in order, with every placed image rendered at its correct position, scale, and rotation

#### Scenario: Print on Android opens the OS print dialog with complete content
- **WHEN** the user activates "Print" on Android
- **THEN** Android's native print dialog SHALL open
- **AND** the document offered to it SHALL contain every page of the project, rendered the same way "Export PDF" renders them

### Requirement: Android Has No Native Menu
Android SHALL NOT have, or need, a native application menu bar. New/Open/Save/Save As/Undo/Redo/Save Template/Save Template As are reached exclusively through the shared in-app `File`/`Edit` menu bar (the same renderer-drawn component used on every host — see the `electron-shell` capability's "No Custom Application Menu" requirement), not through any Android-specific menu surface.

#### Scenario: The in-app menu bar is the only trigger for these actions on Android
- **WHEN** the user wants to start a new project, open or save a project, undo/redo, or save a template, on Android
- **THEN** they use the shared in-app `File`/`Edit` menu bar — the same component and same code path used on every host
