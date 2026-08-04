## 1. Validate

- [x] 1.1 Run `openspec validate baseline-capture-existing-specs --strict` and fix any issues

## 2. Archive

- [x] 2.1 Archive the change with `openspec archive baseline-capture-existing-specs` so the 6 capability specs land in `openspec/specs/`
- [x] 2.2 Confirm with `openspec list --specs` that all 6 capabilities (`layout-engine`, `template-schema`, `project-persistence`, `units-settings`, `electron-shell`, `undo-redo`) are present
