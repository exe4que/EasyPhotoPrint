# CLAUDE.md

Este repo es **spec anchored**: `OPENSPEC.md` es la fuente de verdad de arquitectura, schema y algoritmos, y el código debe mantenerse sincronizado con él en ambas direcciones.

**Antes de tocar código o el spec, leé:**

@AGENTS.md
@OPENSPEC.md

`AGENTS.md` define las reglas de anclaje spec↔código (tags `@spec`, `SPEC_MAP.md`, checklist de cierre de tarea) que aplican igual acá que en GitHub Copilot CLI — no hay reglas "solo para Claude Code". Si en algún momento este archivo y `AGENTS.md` parecen decir cosas distintas, `AGENTS.md` gana.

Regla corta para no perderla de vista en medio de una tarea: **si tocás código con un tag `@spec`, releé esa sección de `OPENSPEC.md` antes de dar la tarea por terminada; si tocás `OPENSPEC.md`, greppeá `@spec` para encontrar el código afectado.** El detalle completo está en `AGENTS.md` §2.
