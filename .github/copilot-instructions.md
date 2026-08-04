# Instrucciones para GitHub Copilot en este repositorio

Este repo es **spec anchored** vía la CLI de **OpenSpec**. Antes de generar o modificar código, leé `AGENTS.md` (raíz del repo) — son las reglas de operación completas, y aplican a vos exactamente igual que a Claude Code CLI: no hay un set de reglas distinto por herramienta. Este archivo es solo el punto de entrada que exige GitHub Copilot; el detalle vive en `AGENTS.md`.

## Regla central (repetida acá porque es la más importante)

`openspec/specs/<capability>/spec.md` es la única fuente de verdad de requisitos funcionales de Easy Photo Print — no un documento único, sino una spec por capability (`layout-engine`, `template-schema`, `project-persistence`, `units-settings`, `electron-shell`, `undo-redo`, y las que se agreguen), gestionada solo a través de la CLI `openspec` o los skills `/opsx:*` (`opsx-propose`, `opsx-apply`, `opsx-archive`, etc. en `.github/skills/` y `.github/prompts/`).

- Si cambiás código de forma que altere un requisito ya documentado en una spec archivada, primero proponés un change (`openspec new change` / `/opsx:propose`) con una delta spec `MODIFIED Requirements`, lo implementás, y lo archivás (`openspec archive` / `/opsx:archive`) — recién ahí queda reflejado en `openspec/specs/`.
- Si el comportamiento no existe todavía en ninguna spec, mismo flujo con `ADDED Requirements`.
- Nunca dejes el código y una spec archivada en desacuerdo al terminar una tarea. Nunca dejes un comentario tipo `// TODO: la spec dice X pero el código hace Y` como estado permanente — o se corrige el código, o se propone un change que actualice la spec.

## Ya no hay tags `@spec` en el código

La trazabilidad requisito↔código vive en la estructura de OpenSpec (nombre de capability ↔ carpeta `openspec/specs/<capability>/`), no en comentarios ancla dentro de los archivos fuente ni en un `SPEC_MAP.md`. No agregues ese tipo de tags en código nuevo.

## Antes de implementar algo

Leé la spec de la capability correspondiente en `openspec/specs/` primero. Los nombres de campos del schema, la forma del JSON, los algoritmos de layout y las decisiones de diseño ya están definidos ahí — no se re-derivan desde cero en el código. No tomes decisiones de arquitectura nuevas (librerías, campos de schema, algoritmos) directamente en el código: primero se proponen como change de OpenSpec.

Si un pedido entra en conflicto con lo ya documentado en una spec archivada y no se pidió explícitamente cambiarla, señalá el conflicto en vez de implementar en silencio algo distinto.

Ver `AGENTS.md` para el checklist completo de qué revisar antes de cerrar una tarea.
