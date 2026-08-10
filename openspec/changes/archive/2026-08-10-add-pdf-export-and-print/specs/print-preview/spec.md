## MODIFIED Requirements

### Requirement: Export and Print Controls Are Wired
The top of the preview screen SHALL show an "Export PDF" control and a "Print" control. Activating "Export PDF" SHALL trigger the behavior defined by the `pdf-export` capability; activating "Print" SHALL trigger the behavior defined by the `printing` capability. While either action is in progress, its control SHALL indicate a busy state and SHALL NOT be re-activatable until that action completes (successfully, with an error, or via user cancellation of a dialog it opened).

#### Scenario: The controls are visible and wired
- **WHEN** the user is in preview mode
- **THEN** an "Export PDF" control and a "Print" control are visible at the top of the screen
- **AND** activating "Export PDF" starts the PDF export flow defined by the `pdf-export` capability
- **AND** activating "Print" starts the print flow defined by the `printing` capability

#### Scenario: A control is busy while its action runs
- **WHEN** the user activates "Export PDF" or "Print"
- **THEN** that control SHALL show a busy state and SHALL NOT trigger a second, overlapping run of the same action if activated again before the first completes
- **AND** the control SHALL return to its normal state once the action completes, fails, or is cancelled
