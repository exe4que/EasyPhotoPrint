# platform-adapter Specification

## Purpose

The platform-adapter capability defines the single contract through which the renderer reaches every capability its host provides — file pickers, project storage, PDF export, printing, settings, templates, image decoding, and host-initiated commands — and how a concrete implementation of that contract is selected at startup, so that one renderer codebase runs unmodified on every supported host (Electron desktop today, an Android WebView later) without platform branching leaking into shared code.

## Requirements

### Requirement: Single Platform Contract for Native Capabilities
Shared renderer code SHALL reach every host-provided capability exclusively through one contract object, obtained by calling the contract accessor at the point of use. Shared renderer code SHALL NOT detect, name, or branch on the host platform, and SHALL NOT read host globals (such as an injected preload object) directly.

#### Scenario: Renderer reaches a native capability through the contract
- **WHEN** shared renderer code needs to open a file picker, read or write a project, list/save/delete templates, read or write settings, export a PDF, print a document, decode a known image at a given size, or subscribe to host-initiated commands
- **THEN** it SHALL obtain the contract from the accessor and call the corresponding method on it
- **AND** it SHALL NOT reference any host-specific global to do so

#### Scenario: Shared code carries no platform branching
- **WHEN** a capability behaves differently on two hosts
- **THEN** that difference SHALL be expressed inside the adapter for each host
- **AND** shared renderer code SHALL contain no conditional selecting behavior by platform for that capability

### Requirement: The Platform Adapter Is Registered at Startup
Each supported host SHALL have its own entry point that registers a concrete adapter implementing the full contract before the application renders for the first time. Selecting which adapter to use SHALL be the entry point's responsibility, never shared code's. Registering an adapter when one is already registered SHALL replace it.

#### Scenario: The entry point registers its adapter before first render
- **WHEN** the application starts on a supported host
- **THEN** that host's entry point SHALL register its adapter
- **AND** it SHALL do so before the first render, so that no shared code can observe an unregistered state

#### Scenario: Requesting the contract before registration fails loudly
- **WHEN** the contract accessor is called and no adapter has been registered
- **THEN** it SHALL throw an error stating that no platform adapter has been registered
- **AND** the error SHALL NOT be a generic undefined-property failure

#### Scenario: Registering again replaces the previous adapter
- **WHEN** an adapter is registered while another is already registered
- **THEN** subsequent calls to the accessor SHALL return the newly registered adapter

### Requirement: The Platform Contract Is Total
Every registered adapter SHALL implement every member of the contract. A host that cannot provide a capability SHALL absorb that inside its own adapter with an implementation that still honors the member's shape and leaves application state unchanged — never by omitting the member, and never by requiring shared code to check whether it exists.

#### Scenario: A host without host-initiated commands still satisfies the contract
- **WHEN** a host has no native menu bar and therefore never issues menu commands
- **THEN** its adapter SHALL still implement every command subscription in the contract
- **AND** each subscription SHALL return a callable unsubscribe function, so shared code that subscribes on mount and unsubscribes on unmount works unchanged
- **AND** the subscribed callback SHALL simply never be invoked on that host

#### Scenario: Shared code never tests for a member's presence
- **WHEN** shared renderer code uses any contract member
- **THEN** it SHALL call that member directly
- **AND** it SHALL NOT guard the call with a presence or capability check

### Requirement: Location Identifiers Returned by the Contract Are Opaque
Values the contract returns to identify a stored location — such as the identifier for a saved project — SHALL be treated by shared renderer code as opaque handles. Shared code SHALL pass such an identifier back to the contract unmodified when re-addressing the same location, and SHALL NOT join, resolve, normalize, or hand it to any filesystem interface. Deriving a human-readable label from an identifier for display is permitted.

#### Scenario: A location identifier round-trips unmodified
- **WHEN** a project is saved and the contract returns an identifier for where it was stored
- **AND** the same project is saved again to that same location
- **THEN** shared code SHALL pass back exactly the identifier it received, byte for byte

#### Scenario: Identifier semantics are the adapter's business
- **WHEN** an adapter's identifiers are filesystem paths on one host and document URIs on another
- **THEN** shared renderer code SHALL require no change to work with either
- **AND** only the adapter SHALL interpret the identifier's internal structure

#### Scenario: Deriving a display label is allowed
- **WHEN** the application shows the user which project is open
- **THEN** it MAY derive a human-readable label from the identifier on a best-effort basis
- **AND** that derived label SHALL be used only for display, never to re-address the location
