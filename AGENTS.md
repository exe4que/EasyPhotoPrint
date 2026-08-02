# AGENTS.md — Reglas de Operación para Agentes de IA

Este archivo es la fuente canónica de reglas de comportamiento para **cualquier** agente de código que trabaje en este repositorio — Claude Code CLI, GitHub Copilot CLI, o cualquier otro. `CLAUDE.md` y `.github/copilot-instructions.md` son puntos de entrada específicos de cada herramienta, pero ambos remiten aquí para el detalle completo. Las reglas de este archivo no son opcionales ni se relajan según qué herramienta las esté leyendo.

---

## 1. Este proyecto es "spec anchored"

**`OPENSPEC.md` (raíz del repo) es la única fuente de verdad** sobre arquitectura, schema de datos, algoritmos del layout engine y requisitos funcionales de Easy Photo Print. El código no es una reinterpretación libre del spec — es su implementación literal.

De acá se desprende una regla bidireccional, sin excepciones:

- **Si cambiás código** de forma que altere un comportamiento, schema, algoritmo o decisión de diseño ya documentado en `OPENSPEC.md` → **actualizás `OPENSPEC.md` en el mismo cambio**. No "en un follow-up", no "después lo sincronizo". Una tarea que deja el spec desactualizado no está terminada.
- **Si cambiás `OPENSPEC.md`** (agregás, modificás o eliminás un requisito, campo de schema, función del layout engine, decisión de diseño) → **revisás `SPEC_MAP.md`** para identificar qué archivos de código implementan esa sección y los actualizás en el mismo cambio. Si todavía no existe código para esa sección, no hay nada que tocar del lado del código, pero lo dejás anotado si corresponde.
- El spec y el código **nunca deben quedar en desacuerdo** al cerrar una tarea. Si notás una divergencia que no generaste vos (deuda preexistente), señalala explícitamente al usuario en vez de ignorarla o "arreglarla" silenciosamente sin decir nada.

Cuando una decisión de diseño cambia intencionalmente (el código *debería* comportarse distinto a como está documentado), el spec se reescribe — nunca se deja un comentario tipo `// TODO: el spec dice X pero hacemos Y` como estado permanente. Eso es exactamente la clase de divergencia que "spec anchored" existe para evitar.

## 2. Mecánica concreta de anclaje

### 2.1 Tags `@spec` en el código

Todo archivo de código que implemente una porción del spec lleva, cerca del inicio del archivo (o junto a la función/tipo específico si el archivo cubre varias secciones), un comentario ancla:

```ts
// @spec OPENSPEC.md §4.1.1 — resizeSiblingsByDrag, isDividerLocked, computeMinRequiredMainSizeMm
```

```json
// @spec OPENSPEC.md §3.2 — EPPTemplate JSON Schema
```

El número de sección (`§4.1.1`) tiene que existir en `OPENSPEC.md` en el momento del commit. Si la sección se renombra o se divide, el tag se actualiza en el mismo cambio.

### 2.2 `SPEC_MAP.md`

Es el índice legible de todos los tags `@spec` — una tabla `Sección del spec → archivo(s) de código → estado`. Se actualiza en el mismo cambio que agrega, mueve o elimina un tag `@spec`. Es lo que le permite a cualquier agente (o persona) responder rápido "¿qué implementa esta sección?" y "¿este archivo, a qué parte del spec le pertenece?" sin tener que grep-ear todo el repo.

### 2.3 Checklist antes de cerrar una tarea

Antes de dar una tarea por terminada:

1. **Tocaste código con un tag `@spec`?** → Releé la(s) sección(es) referenciada(s) en `OPENSPEC.md` y confirmá que siguen describiendo exactamente lo que el código hace. Si no, actualizá el spec (o el código, si el spec seguía siendo la intención correcta y el código se desvió por error).
2. **Tocaste `OPENSPEC.md`?** → Buscá (`grep -r "@spec OPENSPEC.md §<sección>"`) qué archivos referencian la(s) sección(es) que cambiaste y actualizalos.
3. **Agregaste/quitaste un tag `@spec`?** → Actualizá `SPEC_MAP.md` en el mismo cambio.
4. **El cambio en `OPENSPEC.md` es estructural** (nuevo campo de schema, nueva función del layout engine, nueva decisión de arquitectura — no solo una aclaración de redacción)? → Bumpeá el campo `Versión` en el header de `OPENSPEC.md` (semver simple: cambios que rompen compatibilidad de schema o alteran un algoritmo ya implementado suben minor/major; aclaraciones de texto no necesitan bump).

## 3. Reglas específicas para trabajar en este repo

- **Leé la sección del spec relevante antes de implementar algo.** Los nombres de campos, la forma exacta del JSON Schema, los algoritmos de layout (`distributeChildren`, `computeGridCells`, `resolveCrossAxis`, etc.) y las decisiones de diseño ya están tomadas en `OPENSPEC.md` — no se re-derivan ni se adivinan desde cero al escribir código.
- **No tomes decisiones de arquitectura nuevas directamente en el código.** Elegir una librería nueva, agregar un campo de schema, cambiar un algoritmo — eso son decisiones que primero se documentan en `OPENSPEC.md` (con su "Decisión de diseño" si corresponde) y después se implementan. El código no es el lugar para arquitectura no documentada en este repo.
- **Si un pedido del usuario entra en conflicto con `OPENSPEC.md`** y el usuario no pidió explícitamente cambiar el spec, señalá el conflicto en vez de implementar en silencio algo distinto a lo documentado. Puede que el usuario quiera actualizar el spec, o puede que no supiera que ya había una decisión tomada al respecto.
- **No dupliques este archivo.** `CLAUDE.md` y `.github/copilot-instructions.md` son puntos de entrada cortos que remiten acá — si necesitás agregar una regla de comportamiento nueva, se agrega en `AGENTS.md`, no en los archivos específicos de herramienta.
- **Al terminar un cambio independiente (una tarea, un fix, una feature — no cada mensaje suelto de la conversación), hacé commit y push vos mismo, sin esperar a que el usuario lo pida.** Esta es una autorización permanente y aplica a cualquier agente que trabaje en este repo (Claude Code, GitHub Copilot CLI, u otro): no hace falta confirmación puntual para el `git push` cada vez, ese es justamente el propósito de dejarlo escrito acá. Concretamente:
  1. Revisá `git status`/`git diff` antes de stagear — si aparece algo que no reconocés (archivos de credenciales, `.env`, claves) no lo commitees sin preguntar, aunque el resto sí se suba.
  2. `git add -A` (salvo que haya algo a excluir por el punto anterior).
  3. Redactá vos el mensaje de commit en base al diff real — qué cambió y por qué, en el estilo del historial existente (`git log`). Nada de mensajes genéricos tipo timestamp o "auto-commit": si no podés justificar en una línea qué hace el cambio, no está listo para commitear.
  4. `git push` a la rama activa contra `origin`.
  - Si el cambio deja el repo en un estado roto o a mitad de camino (tests rotos, build roto, tarea incompleta a pedido explícito de pausar), no commitees todavía — dejalo para cuando cierre en un estado coherente.
  - Esto no reemplaza el checklist de spec-anchoring de §2.3 — ambos corren al cerrar una tarea: primero sincronizás spec↔código, después commiteás el resultado ya sincronizado.

## 4. Mapa de archivos de este repo

| Archivo | Propósito |
|---|---|
| `OPENSPEC.md` | Fuente de verdad: arquitectura, schema, algoritmos, roadmap. |
| `AGENTS.md` | Este archivo — reglas de operación para cualquier agente. |
| `CLAUDE.md` | Punto de entrada para Claude Code CLI. |
| `.github/copilot-instructions.md` | Punto de entrada para GitHub Copilot CLI/Chat. |
| `SPEC_MAP.md` | Trazabilidad: sección del spec ↔ archivo(s) de código. |

Cuando exista código, su ubicación seguirá la estructura de carpetas ya definida en `OPENSPEC.md` §6.1 (`electron/`, `packages/layout-engine/`, `packages/migrations/`, `src/`, `shared/schemas/`).
