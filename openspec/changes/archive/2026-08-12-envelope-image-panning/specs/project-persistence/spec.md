## REMOVED Requirements

### Requirement: Assignment Logic Swaps When the Source Is Another Slot on the Same Page
**Reason**: The UI gesture that produced `source: 'page'` — pressing and dragging an already-assigned `imageSlot`'s image onto another slot — is removed (see `canvas-interaction`'s new envelopeParent panning requirement, which reuses that same press-and-drag on a slot's image and is not compatible with it). With no remaining caller ever passing `source: 'page'`, the swap/move branch it describes is unreachable and is removed along with it.
**Migration**: None needed for saved projects — `assignments` map entries are unaffected; this only removes a way of *changing* them. Any code still calling `assignImageToSlot`/`assignImageToPage` with `source: 'page'` must instead call it with the default `'library'` source (which replaces the target slot's assignment) and, if a swap-like result is still wanted, issue two calls to move each image explicitly.

The store's slot-assignment logic (`assignImageToPage`, exposed to the UI via the `assignImageToSlot` action) SHALL accept a `source` of `'library'` (the default) or `'page'`. The canvas SHALL determine this source at drop time: a drag that originates from the Image Library panel SHALL use `source: 'library'`, and a drag that originates from an already-assigned `imageSlot` on the same page SHALL use `source: 'page'`. When called with `source: 'page'` for an image that is already assigned to a different slot on the same page, the assignment logic SHALL swap the two slots' assignments (each ends up with the other's previous image) instead of one slot's assignment simply clobbering the other's.

#### Scenario: Dragging an assigned slot's image onto another slot swaps them
- **WHEN** the user drags the image out of a slot that already has an image assigned and drops it onto a different slot on the same page that also has an image assigned
- **THEN** the target slot SHALL receive the dragged image, and the source slot SHALL receive the image the target slot held before the drop

#### Scenario: Dragging an assigned slot's image onto an empty slot moves it
- **WHEN** the user drags the image out of a slot that has an image assigned and drops it onto an empty slot on the same page
- **THEN** the target slot SHALL become assigned to that image, and the source slot SHALL become unassigned

#### Scenario: Dragging from the Image Library panel never swaps
- **WHEN** an image is dragged from the Image Library panel (not from another slot) and dropped onto a slot, regardless of whether that image is already assigned elsewhere on the page
- **THEN** the target slot's assignment SHALL simply be replaced with the dropped image, and no other slot's assignment SHALL change as a side effect

#### Scenario: Page-source swap does not affect unrelated slots
- **WHEN** a page-source swap occurs between two slots
- **THEN** every other slot's assignment on that page SHALL remain unchanged
