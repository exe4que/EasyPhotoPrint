## MODIFIED Requirements

### Requirement: Copy Captures a Slot's Image, Scaling Rule, Rotation, and Padding
The "Copy" action, invoked from the "⋮" menu on a selected `imageSlot`, SHALL capture that slot's assigned image (if any), scaling rule, image rotation, and padding into an in-memory clipboard, replacing any previously copied content. When the slot's scaling rule is `specificSize`, the clipboard SHALL also capture that slot's specific-size width and height. Copying does not modify the source slot or any other slot.

#### Scenario: Copying a slot with an assigned image
- **WHEN** the user selects an `imageSlot` that has an image assigned and chooses "Copy"
- **THEN** the clipboard stores that slot's image assignment, scaling rule, rotation, and padding

#### Scenario: Copying a slot with no assigned image
- **WHEN** the user selects an `imageSlot` with no image assigned and chooses "Copy"
- **THEN** the clipboard stores "no image assigned" along with that slot's scaling rule, rotation, and padding

#### Scenario: Copying again replaces the previous clipboard content
- **WHEN** the user has already copied one slot's properties and then chooses "Copy" on a different `imageSlot`
- **THEN** the clipboard discards the previous content and stores the newly copied slot's properties instead

#### Scenario: Copying a slot configured with a specific size
- **WHEN** the user selects an `imageSlot` whose scaling rule is `specificSize` and chooses "Copy"
- **THEN** the clipboard also stores that slot's specific-size width and height, alongside its image assignment, rotation, and padding

### Requirement: Copy to Siblings Applies Directly to Sibling Image Slots
The "Copy to siblings" action, invoked from the "⋮" menu on a selected `imageSlot`, SHALL apply that slot's image assignment, scaling rule, rotation, and padding — plus, when the scaling rule is `specificSize`, its specific-size width and height — directly to every other `imageSlot` node that shares the same parent container — without requiring a prior "Copy" or a subsequent "Paste" — as a single undoable change. Sibling nodes that are not `imageSlot` (e.g. a nested container) SHALL be left untouched. This action does not read from or write to the "Copy"/"Paste" clipboard.

#### Scenario: Applying to sibling slots
- **WHEN** the user selects an `imageSlot` that has one or more `imageSlot` siblings under the same parent and chooses "Copy to siblings"
- **THEN** every sibling `imageSlot` is updated to match the source slot's image assignment, scaling rule, rotation, and padding, in a single undo step

#### Scenario: Non-imageSlot siblings are skipped
- **WHEN** the source slot's parent also contains a sibling that is a `grid`, `horizontal`, `vertical`, or `freeformCanvas` node
- **THEN** that sibling is not modified by "Copy to siblings"

#### Scenario: No sibling image slots exist
- **WHEN** the selected `imageSlot` has no other `imageSlot` siblings under the same parent and the user chooses "Copy to siblings"
- **THEN** no slot is modified and no entry is added to the undo/redo history

#### Scenario: Applying a specific-size source slot to siblings
- **WHEN** the source slot's scaling rule is `specificSize` and the user chooses "Copy to siblings"
- **THEN** every sibling `imageSlot` is updated to match the source slot's specific-size width and height, along with its other properties

### Requirement: Copy to Page Applies Directly to Every Image Slot on the Page
The "Copy to page" action, invoked from the "⋮" menu on a selected `imageSlot`, SHALL apply that slot's image assignment, scaling rule, rotation, and padding — plus, when the scaling rule is `specificSize`, its specific-size width and height — directly to every other `imageSlot` node anywhere in the active page's layout tree, regardless of nesting depth — without requiring a prior "Copy" or a subsequent "Paste" — as a single undoable change. This action does not read from or write to the "Copy"/"Paste" clipboard, and it does not affect other pages.

#### Scenario: Applying to every slot on the page
- **WHEN** the user selects an `imageSlot` on the active page and chooses "Copy to page"
- **THEN** every other `imageSlot` node in that page's layout tree, at any nesting depth, is updated to match the source slot's image assignment, scaling rule, rotation, and padding, in a single undo step

#### Scenario: Other pages are unaffected
- **WHEN** the document has more than one page and the user chooses "Copy to page" on the active page
- **THEN** `imageSlot` nodes on other pages are not modified

#### Scenario: No other image slots exist on the page
- **WHEN** the active page's layout tree contains no `imageSlot` other than the selected one and the user chooses "Copy to page"
- **THEN** no slot is modified and no entry is added to the undo/redo history

#### Scenario: Applying a specific-size source slot to the page
- **WHEN** the source slot's scaling rule is `specificSize` and the user chooses "Copy to page"
- **THEN** every other `imageSlot` on the page is updated to match the source slot's specific-size width and height, along with its other properties

### Requirement: Paste Applies the Clipboard to the Selected Slot
The "Paste" action, invoked from the "⋮" menu on a selected `imageSlot`, SHALL apply the clipboard's stored image assignment, scaling rule, rotation, and padding — plus, when the clipboard's scaling rule is `specificSize`, its stored specific-size width and height — to that slot, overwriting its current values, as a single undoable change. "Paste" SHALL be inactive (not invokable) whenever the clipboard has no copied content, and MUST NOT be inactive based on which slot is selected once content has been copied — including pasting onto the same slot that was copied.

#### Scenario: Paste is inactive with an empty clipboard
- **WHEN** the user has not yet used "Copy" in the current session and opens the "⋮" menu on an `imageSlot`
- **THEN** the "Paste" option is inactive and cannot be invoked

#### Scenario: Pasting onto a different slot
- **WHEN** the clipboard holds a previously copied slot's properties and the user selects a different `imageSlot` and chooses "Paste"
- **THEN** that slot's image assignment, scaling rule, rotation, and padding are overwritten with the clipboard's values, in a single undo step

#### Scenario: Pasting onto the same slot that was copied
- **WHEN** the user chooses "Paste" on the same `imageSlot` the clipboard's content was copied from
- **THEN** the slot's properties are reapplied unchanged, without error

#### Scenario: Pasting a specific-size clipboard
- **WHEN** the clipboard's scaling rule is `specificSize` and the user chooses "Paste" on a different `imageSlot`
- **THEN** that slot's scaling rule, specific-size width, and specific-size height are all overwritten with the clipboard's stored values, alongside its image assignment, rotation, and padding
