## Purpose

Defines a full-app blocking overlay shown while a long-running operation (adding images to the library, exporting to PDF, printing) is in flight, so the user cannot interact with — or navigate away from — an operation while it is still processing.

## ADDED Requirements

### Requirement: Blocking Overlay Shown During In-Flight Processing
The application SHALL show a full-viewport overlay, displaying a progress bar or, when determinate progress cannot be reported, a spinner, whenever one of the following operations is in flight: loading images into the Image Library, exporting the active document to PDF, or printing the active document. While the overlay is shown, the application SHALL prevent all pointer and keyboard interaction with anything behind it, including navigation, other buttons, and keyboard shortcuts.

#### Scenario: Overlay appears while images are being added to the library
- **WHEN** the user adds one or more images to the Image Library and the images have not yet finished decoding and merging into the pool
- **THEN** the application SHALL show the blocking overlay for the duration of that operation

#### Scenario: Overlay appears while exporting to PDF
- **WHEN** the user activates "Export PDF" and the export has not yet completed
- **THEN** the application SHALL show the blocking overlay for the duration of the export

#### Scenario: Overlay appears while printing
- **WHEN** the user activates "Print" and the print operation has not yet completed
- **THEN** the application SHALL show the blocking overlay for the duration of the print operation

#### Scenario: The overlay blocks interaction with the rest of the app
- **WHEN** the blocking overlay is shown
- **THEN** clicks, taps, and keyboard input directed at any other part of the application SHALL have no effect
- **AND** this SHALL include the preview screen's own page navigation, exit-preview control, and the export/print controls themselves

### Requirement: Overlay Always Resolves
The blocking overlay SHALL be dismissed as soon as the operation it is covering finishes, whether it finishes successfully, fails with an error, or is cancelled (for example, by the user dismissing a native file or print dialog). The application SHALL NOT leave the overlay visible once the underlying operation has settled.

#### Scenario: Overlay is dismissed on success
- **WHEN** an in-flight operation covered by the overlay completes successfully
- **THEN** the overlay SHALL be dismissed immediately, returning control of the application to the user

#### Scenario: Overlay is dismissed on failure
- **WHEN** an in-flight operation covered by the overlay fails with an error
- **THEN** the overlay SHALL be dismissed and any existing error-reporting behavior for that operation SHALL still occur

#### Scenario: Overlay is dismissed on cancellation
- **WHEN** the user cancels an in-flight operation covered by the overlay (for example, dismissing the native "Print" or file-open dialog without completing it)
- **THEN** the overlay SHALL be dismissed without an error being reported
