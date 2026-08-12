## MODIFIED Requirements

### Requirement: Export and Print Controls Are Wired
The top of the preview screen SHALL show an "Export PDF" control and a "Print" control. Activating "Export PDF" SHALL trigger the behavior defined by the `pdf-export` capability; activating "Print" SHALL trigger the behavior defined by the `printing` capability. While either action is in progress, the application SHALL show the blocking overlay defined by the `processing-overlay` capability, and neither control SHALL be re-activatable until that action completes (successfully, with an error, or via user cancellation of a dialog it opened).

#### Scenario: The controls are visible and wired
- **WHEN** the user is in preview mode
- **THEN** an "Export PDF" control and a "Print" control are visible at the top of the screen
- **AND** activating "Export PDF" starts the PDF export flow defined by the `pdf-export` capability
- **AND** activating "Print" starts the print flow defined by the `printing` capability

#### Scenario: The whole app is blocked while an action runs
- **WHEN** the user activates "Export PDF" or "Print"
- **THEN** the application SHALL show the blocking overlay defined by the `processing-overlay` capability for the duration of that action
- **AND** neither control, nor any other part of the preview screen, SHALL be interactable while the overlay is shown, so a second overlapping run of the same action cannot be triggered
- **AND** the overlay SHALL be dismissed and both controls SHALL return to their normal state once the action completes, fails, or is cancelled
