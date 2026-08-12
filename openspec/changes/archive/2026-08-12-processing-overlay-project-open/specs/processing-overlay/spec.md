## MODIFIED Requirements

### Requirement: Blocking Overlay Shown During In-Flight Processing
The application SHALL show a full-viewport overlay, displaying a progress bar or, when determinate progress cannot be reported, a spinner, whenever one of the following operations is in flight: loading images into the Image Library, exporting the active document to PDF, printing the active document, or opening/loading a project via `File > Open`. While the overlay is shown, the application SHALL prevent all pointer and keyboard interaction with anything behind it, including navigation, other buttons, and keyboard shortcuts.

#### Scenario: Overlay appears while images are being added to the library
- **WHEN** the user adds one or more images to the Image Library and the images have not yet finished decoding and merging into the pool
- **THEN** the application SHALL show the blocking overlay for the duration of that operation

#### Scenario: Overlay appears while exporting to PDF
- **WHEN** the user activates "Export PDF" and the export has not yet completed
- **THEN** the application SHALL show the blocking overlay for the duration of the export

#### Scenario: Overlay appears while printing
- **WHEN** the user activates "Print" and the print operation has not yet completed
- **THEN** the application SHALL show the blocking overlay for the duration of the print operation

#### Scenario: Overlay appears while opening a project
- **WHEN** the user confirms `File > Open...` and the chosen project has not yet finished reading and extracting from disk
- **THEN** the application SHALL show the blocking overlay for the duration of that operation

#### Scenario: The overlay blocks interaction with the rest of the app
- **WHEN** the blocking overlay is shown
- **THEN** clicks, taps, and keyboard input directed at any other part of the application SHALL have no effect
- **AND** this SHALL include the preview screen's own page navigation, exit-preview control, and the export/print controls themselves
