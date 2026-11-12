## ADDED Requirements

### Requirement: Print While a Print Dialog Is Still Open
If the user activates "Print" while the native print dialog opened by a previous activation has not been closed yet (for example, because it ended up behind the application window), the application SHALL NOT start a new print job and SHALL show the user a visible notice that a print dialog is already open and must be closed before printing again. The document and application state SHALL remain unchanged, and once that dialog is closed, activating "Print" SHALL open the native print dialog again as usual. This requirement takes precedence over "Print Sends Every Page" for that activation only.

#### Scenario: Print activated while the previous dialog is hidden behind the app window
- **WHEN** the user activates "Print", the native print dialog ends up behind the application window without being closed, and the user activates "Print" again
- **THEN** no new print job SHALL be started
- **AND** the application SHALL show a visible notice that a print dialog is already open
- **AND** the "Print" control SHALL NOT remain in a busy state

#### Scenario: Printing again after the pending dialog is closed
- **WHEN** the user closes the print dialog that was still open and activates "Print" again
- **THEN** the native print dialog SHALL open
