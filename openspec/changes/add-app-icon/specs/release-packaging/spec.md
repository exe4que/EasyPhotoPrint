## ADDED Requirements

### Requirement: Application icon
Every release artifact SHALL carry Easy Photo Print's own application icon instead of a framework default: the Linux packages (AppImage, `.deb`, Arch package) and the Windows installer SHALL install it as the application's launcher/menu icon, the desktop application window SHALL use it as its window/taskbar icon, and the Android APK SHALL use it as its launcher icon, including an adaptive-icon variant whose artwork stays within the platform's safe zone so no launcher mask crops it. All variants SHALL be rendered from a single source design checked into the repository.

#### Scenario: Installed desktop app shows the app icon
- **WHEN** a Linux or Windows release artifact is installed
- **THEN** the application's launcher/menu entry and its open window SHALL show the Easy Photo Print icon, not Electron's default icon

#### Scenario: Android launcher shows the app icon
- **WHEN** the Android APK is installed
- **THEN** the launcher SHALL show the Easy Photo Print icon, not Capacitor's or Android's default icon, with the artwork uncropped under circular, squircle, and square launcher masks

#### Scenario: Icons are regenerated from one source
- **WHEN** the icon design is changed
- **THEN** regenerating the icons from the single checked-in source SHALL update every desktop and Android variant
