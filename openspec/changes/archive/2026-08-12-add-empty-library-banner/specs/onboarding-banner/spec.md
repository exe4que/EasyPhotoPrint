## Purpose

Guides a new user toward the app's first required action — adding images to the library — with a visible prompt above the page canvas whenever that step hasn't been done yet.

## ADDED Requirements

### Requirement: Banner Shown While the Image Library Is Empty
The application SHALL show a full-width warning banner, positioned directly above the page canvas, reading "Add images to library to start", whenever the image pool contains no images. The banner SHALL be hidden as soon as the image pool contains at least one image, and SHALL reappear if the image pool later becomes empty again (for example, after removing every image). The banner SHALL NOT provide a manual dismiss control — its visibility SHALL be driven entirely by whether the image pool is empty.

#### Scenario: Banner appears on an empty project
- **WHEN** the active project's image pool contains no images
- **THEN** the application shows the banner above the page canvas

#### Scenario: Banner disappears once an image is added
- **WHEN** the image pool transitions from empty to containing at least one image
- **THEN** the banner is no longer shown

#### Scenario: Banner reappears if the library becomes empty again
- **WHEN** every image is removed from a project whose image pool previously had at least one image
- **THEN** the banner is shown again

### Requirement: Banner Click Directs the User to the Image Library
Activating the banner SHALL direct the user to the Image Library, using the mechanism appropriate to the current shell. On the desktop shell, where the Image Library panel is already visible on screen, activating the banner SHALL scroll it into view if it isn't already, and play a brief highlight/bounce animation on it. On the mobile shell, where the Image Library lives in a bottom sheet reached from the tab bar, activating the banner SHALL open that sheet.

#### Scenario: Activating the banner on desktop highlights the Image Library panel
- **WHEN** the user activates the banner on the desktop shell
- **THEN** the Image Library panel scrolls into view if needed and plays a brief highlight/bounce animation

#### Scenario: Activating the banner on mobile opens the Photos sheet
- **WHEN** the user activates the banner on the mobile shell
- **THEN** the Photos bottom sheet opens, the same as tapping the Photos tab in the bottom tab bar
