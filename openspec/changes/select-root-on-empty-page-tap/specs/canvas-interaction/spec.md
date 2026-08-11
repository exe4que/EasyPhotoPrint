## ADDED Requirements

### Requirement: Tapping the Page Panel's Empty Space Selects the Root Node
Activating (clicking or tapping) the page-preview panel outside any slot, container gap, freeform canvas, or divider — specifically, the root node's own margin band (the area between the page edge and the root's padded content box) or the scrollable viewport's background outside the page rectangle's bounds — SHALL set the selection to the page's root node. This SHALL behave identically everywhere the page-preview panel is rendered (the Electron desktop build and the Android build), since both share the same panel implementation.

#### Scenario: Activating the root's margin band selects the root
- **WHEN** the user activates the area between the page edge and the root node's padded content box (the margin visualized today by a dashed outline)
- **THEN** the active page's selection SHALL become the root node

#### Scenario: Activating the viewport outside the page bounds selects the root
- **WHEN** the user activates the page-preview panel's scrollable background outside the page rectangle itself
- **THEN** the active page's selection SHALL become the root node

#### Scenario: Activating the root selection again clears it
- **WHEN** the root node is already selected and the user activates the margin band or the outside-page-bounds area again
- **THEN** the selection SHALL clear, the same toggle-off convention an `imageSlot` already uses

#### Scenario: Gaps between sibling slots are unaffected
- **WHEN** the user activates the gap space between adjacent children inside a `grid`, `horizontal`, or `vertical` container
- **THEN** no selection change SHALL occur — this requirement does not extend to inter-slot gap space

#### Scenario: A freeform canvas's own empty-area tap is unaffected
- **WHEN** the user activates an empty area of a `freeformCanvas` with no library image selected
- **THEN** the existing node-selection behavior SHALL occur (selecting the canvas node), unchanged by this requirement — the root is not selected in its place
