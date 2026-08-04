# CLAUDE.md

Este repo es **spec anchored** vía la CLI de **OpenSpec**: `openspec/specs/<capability>/spec.md` es la fuente de verdad de requisitos funcionales, gestionada exclusivamente a través de los comandos `openspec` (o los skills `/opsx:*`) — nunca editada a mano.

**Antes de tocar código o proponer un change, leé:**

@AGENTS.md

`AGENTS.md` define el flujo completo (proponer → implementar → archivar) y las reglas de anclaje spec↔código que aplican igual acá que en GitHub Copilot CLI — no hay reglas "solo para Claude Code". Es la fuente canónica; si en algún momento este archivo pareciera decir algo distinto, `AGENTS.md` gana.

Regla corta para no perderla de vista en medio de una tarea: **antes de implementar algo, leé la spec de la capability relevante en `openspec/specs/`; si tu cambio altera un requisito ya documentado, pasa primero por un change de OpenSpec (`/opsx:propose` → `/opsx:apply` → `/opsx:archive`), no por una edición directa de la spec archivada.** El detalle completo está en `AGENTS.md` §2.
