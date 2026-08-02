# Instrucciones para GitHub Copilot en este repositorio

Este repo es **spec anchored**. Antes de generar o modificar código, leé `AGENTS.md` (raíz del repo) — son las reglas de operación completas, y aplican a vos exactamente igual que a Claude Code CLI: no hay un set de reglas distinto por herramienta. Este archivo es solo el punto de entrada que exige GitHub Copilot; el detalle vive en `AGENTS.md`.

## Regla central (repetida acá porque es la más importante)

`OPENSPEC.md` (raíz del repo) es la única fuente de verdad de arquitectura, schema de datos JSON, algoritmos del motor de layout y requisitos funcionales de Easy Photo Print.

- Si cambiás código de forma que altere algo ya documentado en `OPENSPEC.md` (un campo de schema, un algoritmo, una decisión de diseño), **actualizá `OPENSPEC.md` en el mismo cambio** — no en un PR separado, no "después".
- Si cambiás `OPENSPEC.md`, revisá `SPEC_MAP.md` para encontrar qué archivos de código implementan la sección que tocaste y actualizalos en el mismo cambio.
- Nunca dejes el spec y el código en desacuerdo al terminar una tarea. Nunca dejes un comentario tipo `// TODO: el spec dice X pero el código hace Y` como estado permanente — o se corrige el código, o se reescribe el spec.

## Tags `@spec`

El código que implementa una parte del spec lleva un comentario ancla cerca del inicio del archivo:

```ts
// @spec OPENSPEC.md §4.1.1 — resizeSiblingsByDrag, isDividerLocked, computeMinRequiredMainSizeMm
```

Mantené esos tags actualizados, y `SPEC_MAP.md` en sincro con ellos.

## Antes de implementar algo

Leé la sección correspondiente de `OPENSPEC.md` primero. Los nombres de campos del schema, la forma del JSON, los algoritmos de layout y las decisiones de diseño ya están definidos ahí — no se re-derivan desde cero en el código. No tomes decisiones de arquitectura nuevas (librerías, campos de schema, algoritmos) directamente en el código: primero se documentan en `OPENSPEC.md`.

Si un pedido entra en conflicto con lo ya documentado en `OPENSPEC.md` y no se pidió explícitamente cambiar el spec, señalá el conflicto en vez de implementar en silencio algo distinto.

Ver `AGENTS.md` para el checklist completo de qué revisar antes de cerrar una tarea.
