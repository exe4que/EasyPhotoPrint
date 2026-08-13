# AGENTS.md — Reglas de Operación para Agentes de IA

Este archivo es la fuente canónica de reglas de comportamiento para **cualquier** agente de código que trabaje en este repositorio — Claude Code CLI, GitHub Copilot CLI, o cualquier otro. `CLAUDE.md` y `.github/copilot-instructions.md` son puntos de entrada específicos de cada herramienta, pero ambos remiten aquí para el detalle completo. Las reglas de este archivo no son opcionales ni se relajan según qué herramienta las esté leyendo.

---

## 1. Este proyecto es "spec anchored" — vía la CLI de OpenSpec

**`openspec/specs/<capability>/spec.md` es la única fuente de verdad** sobre requisitos funcionales de Easy Photo Print. No es un documento narrativo único (eso era el viejo `OPENSPEC.md`, retirado): son specs por capability, en formato requirement/scenario, gestionadas exclusivamente a través de la CLI `openspec` (o los skills `/opsx:*` que la envuelven) — nunca editadas a mano fuera de ese flujo.

**Capabilities actuales** (`openspec spec list` para la lista viva): `layout-engine`, `template-schema`, `project-persistence`, `units-settings`, `electron-shell`, `undo-redo`. Nuevas capabilities (p. ej. `pdf-export`, `printing`) se agregan a medida que se implementan, nunca antes.

De acá se desprende una regla bidireccional, sin excepciones:

- **Si vas a cambiar código** de forma que altere un comportamiento, schema o algoritmo ya documentado en una spec existente → primero proponés un **change** de OpenSpec (`openspec new change` o `/opsx:propose`) con una delta spec `MODIFIED Requirements` para esa capability, la implementás (`/opsx:apply`), y la archivás (`openspec archive` o `/opsx:archive`) — recién ahí el cambio de comportamiento queda reflejado en `openspec/specs/`. No se edita código que contradiga una spec archivada sin pasar por ese flujo.
- **Si el comportamiento que necesitás no existe en ninguna spec todavía** (capability nueva, o requisito nuevo dentro de una capability existente) → mismo flujo: `ADDED Requirements` en la delta spec del change.
- El código y las specs archivadas **nunca deben quedar en desacuerdo** al cerrar un change. Si notás una divergencia preexistente (código que ya no coincide con una spec archivada, deuda de antes de este flujo), señalala explícitamente al usuario en vez de ignorarla o "arreglarla" silenciosamente sin decir nada.

Cuando una decisión de diseño cambia intencionalmente, la spec se actualiza a través de un change con `MODIFIED Requirements` — nunca se deja un comentario tipo `// TODO: la spec dice X pero hacemos Y` como estado permanente.

## 2. Mecánica concreta: el flujo de OpenSpec

Este repo tiene la CLI `openspec` instalada e inicializada (`openspec/config.yaml`, schema `spec-driven`). El ciclo de vida de cualquier trabajo que toque comportamiento de la app es:

1. **Proponer** (`/opsx:propose` o `openspec new change <nombre>`): crea `openspec/changes/<nombre>/` con `proposal.md` (qué y por qué), `specs/<capability>/spec.md` (delta — qué requisitos se agregan/modifican/eliminan), `design.md` (cómo, solo si aplica: cambio cross-cutting, dependencia nueva, decisión técnica ambigua — se omite en changes triviales) y `tasks.md` (checklist de implementación).
2. **Implementar** (`/opsx:apply` o trabajo manual siguiendo `tasks.md`): el código se escribe para satisfacer los requisitos de la delta spec. Los checkboxes de `tasks.md` se van marcando a medida que se completan.
3. **Archivar** (`/opsx:archive` o `openspec archive <nombre>`): fusiona la delta spec del change dentro de `openspec/specs/<capability>/spec.md` (crea la capability si es nueva, aplica ADDED/MODIFIED/REMOVED/RENAMED si ya existía) y mueve el change a `openspec/changes/archive/`. Recién en este paso la spec archivada pasa a ser la fuente de verdad vigente.

`openspec status --change <nombre> --json` y `openspec validate --strict` son las herramientas para chequear en qué estado está un change antes de avanzar al siguiente paso. Correr `openspec validate --strict --all` antes de dar por cerrada cualquier tarea que haya tocado `openspec/`.

### 2.1 Checklist antes de cerrar una tarea

1. **¿Tocaste código que implementa una capability existente?** → Releé `openspec/specs/<capability>/spec.md` y confirmá que el código sigue satisfaciendo cada requirement/scenario documentado. Si el comportamiento cambió a propósito, ese cambio debe haber pasado por un change de OpenSpec con delta spec — no una edición directa de la spec archivada.
2. **¿Agregaste una capability nueva o un requisito nuevo?** → Verificá que exista un change archivado (`openspec/changes/archive/`) que lo introdujo vía `ADDED`/`MODIFIED Requirements`, y que `openspec/specs/<capability>/spec.md` ya lo refleje.
3. **¿El change sigue sin archivar?** → No des la tarea por terminada solo porque el código funciona; el ciclo se cierra con `openspec archive`, que es lo que sincroniza specs con código.

No existe ya el mecanismo de tags `@spec OPENSPEC.md §X` en comentarios ni el archivo `SPEC_MAP.md` — la trazabilidad requisito↔código vive en la estructura misma de OpenSpec (nombre de capability ↔ carpeta `openspec/specs/<capability>/`), no en anotaciones dentro del código fuente. No agregues tags de ese estilo en código nuevo.

## 3. Reglas específicas para trabajar en este repo

- **Leé la spec de la capability relevante antes de implementar algo.** Los nombres de campos, la forma exacta de un schema, los algoritmos de layout (`distributeChildren`, `computeGridCells`, `resolveCrossAxis`, etc.) y las decisiones de diseño ya documentadas en `openspec/specs/layout-engine/spec.md` (y las demás capabilities) no se re-derivan ni se adivinan desde cero al escribir código.
- **No tomes decisiones de arquitectura nuevas directamente en el código.** Elegir una librería nueva, agregar un campo de schema, cambiar un algoritmo — eso son decisiones que primero se proponen como change de OpenSpec (con su `design.md` si la decisión lo amerita) y después se implementan. El código no es el lugar para arquitectura no documentada en `openspec/`.
- **Si un pedido del usuario entra en conflicto con una spec archivada** y el usuario no pidió explícitamente cambiar esa spec, señalá el conflicto en vez de implementar en silencio algo distinto a lo documentado. Puede que el usuario quiera proponer un change que la modifique, o puede que no supiera que ya había una decisión tomada al respecto.
- **No dupliques este archivo.** `CLAUDE.md` y `.github/copilot-instructions.md` son puntos de entrada cortos que remiten acá — si necesitás agregar una regla de comportamiento nueva, se agrega en `AGENTS.md`, no en los archivos específicos de herramienta.
- **El trabajo de un change vive en su propia rama de feature — nunca se commitea directo a `main`.** `/opsx:apply` es responsable de crear (si no existe) y pararse sobre una rama con el nombre del change antes de tocar código. Dentro de esa rama, seguís teniendo autorización permanente para commitear y pushear vos mismo al terminar un cambio independiente (una tarea, un fix, una feature — no cada mensaje suelto de la conversación), sin esperar a que el usuario lo pida. Esto aplica a cualquier agente que trabaje en este repo (Claude Code, GitHub Copilot CLI, u otro): no hace falta confirmación puntual para el `git push` cada vez, ese es justamente el propósito de dejarlo escrito acá. Concretamente:
  1. Revisá `git status`/`git diff` antes de stagear — si aparece algo que no reconocés (archivos de credenciales, `.env`, claves) no lo commitees sin preguntar, aunque el resto sí se suba.
  2. `git add -A` (salvo que haya algo a excluir por el punto anterior).
  3. Redactá vos el mensaje de commit en base al diff real — qué cambió y por qué, en el estilo del historial existente (`git log`). Nada de mensajes genéricos tipo timestamp o "auto-commit": si no podés justificar en una línea qué hace el cambio, no está listo para commitear.
  4. `git push` a la rama de feature activa contra `origin` — nunca a `main` directamente.
  - Si el cambio deja el repo en un estado roto o a mitad de camino (tests rotos, build roto, tarea incompleta a pedido explícito de pausar), no commitees todavía — dejalo para cuando cierre en un estado coherente.
  - Esto no reemplaza el checklist de spec-anchoring de §2.1 — ambos corren al cerrar una tarea: primero sincronizás spec↔código (incluido archivar el change si corresponde), después commiteás el resultado ya sincronizado.
  - `main` solo recibe código a través del merge automático descripto en §3.1 — nunca por un push directo de un agente.

### 3.1 Ciclo de vida de un change: rama de feature → PR → merge

1. **`/opsx:apply`** — antes de implementar la primera tarea de `tasks.md`, asegurate de estar parado en una rama con el mismo nombre que el change (`git checkout -b <nombre-del-change>` desde un `main` local actualizado con `origin/main`, si esa rama no existe todavía). A partir de ahí, todo commit/push de esa sesión de trabajo va a esa rama, siguiendo la autorización permanente del punto anterior. Cuando `tasks.md` queda completo (o la sesión de implementación cierra en un estado coherente) y ya se hizo el push a la rama, abrí el pull request de esa rama hacia `main` con `gh pr create` si todavía no existe uno (`gh pr list --head <rama>` para chequear) — autorización permanente, no hace falta confirmar cada vez. El PR en este punto refleja el código implementado, todavía **sin** las specs archivadas (eso lo hace `/opsx:archive` más adelante, actualizando el mismo PR).
2. **`/opsx:archive`** — además de lo que ya hace (sincronizar las specs delta a `openspec/specs/` y mover el change a `openspec/changes/archive/`), al cerrar:
   1. Committeá y pusheá el resultado del archive (specs sincronizadas + change movido) en esa misma rama de feature — esto actualiza el PR ya abierto por `/opsx:apply`, no crea uno nuevo.
   2. Si por algún motivo el PR no existiera todavía en este punto (p. ej. `/opsx:apply` no llegó a abrirlo), abrilo ahora con `gh pr create` — mismo fallback, misma autorización permanente.
   3. Mergeá el PR a `main` vos mismo (`gh pr merge --delete-branch`) — sin gate de CI adicional, sin pedir confirmación puntual para el merge en sí. Esta es la única vía por la que código llega a `main`. El flag `--delete-branch` borra la rama de feature tanto en el remoto (`origin`) como localmente como parte del mismo comando; si por algún motivo se mergeó sin ese flag (p. ej. merge manual desde la UI de GitHub), borrá la rama remota aparte con `git push origin --delete <rama>` — misma autorización permanente, no hace falta confirmar puntualmente.
   - `/opsx:archive` no incluye el adversarial code review — ver §3.2. Es un paso desacoplado y opcional: si querés que corra, invocalo vos (o pedímelo) antes de archivar. `/opsx:archive` no espera a que corra ni lo dispara automáticamente.

### 3.2 Adversarial code review — paso opcional, desacoplado de `/opsx:archive`

El comando `/adversarial-review` (`.claude/commands/adversarial-review.md`) corre el mismo review de 5 agentes en paralelo que antes vivía adentro de `/opsx:archive`, pero como paso independiente que se invoca a mano — no corre automáticamente en ningún punto del flujo de OpenSpec (ni `/opsx:apply` ni `/opsx:archive` lo disparan por su cuenta).

- **Cuándo correrlo:** el momento recomendado es sobre la rama de feature, antes de `/opsx:archive` — el PR ya existe desde que `/opsx:apply` terminó, así que podés revisar directamente contra ese PR (pasándole el número) o contra el diff local de la rama. Correrlo antes de archivar deja que `/opsx:archive` termine en un solo tramo limpio (sync → commit → push → merge) sin tener que volver atrás a arreglar hallazgos post-merge.
- **Qué hace:** lanza en paralelo los mismos 5 roles (`code-reviewer`, `silent-failure-hunter`, `type-design-analyzer`, `pr-test-analyzer`, `comment-analyzer`) sobre el diff de la rama actual contra `main` (o contra el PR indicado), puntúa cada hallazgo 0–100 con el mismo rubric que `/code-review`, y solo reporta los que llegan a ≥80. Si el plugin `pr-review-toolkit` no está registrado como agent type invocable en el entorno, el comando cae automáticamente a agentes `general-purpose` cargando la persona real de cada rol — no hace falta que vos ni yo lo notemos ni lo resolvamos a mano cada vez.
- **Qué hago con los hallazgos ≥80:** los arreglo cuando el fix es puramente técnico y de bajo riesgo (bug, tipo, comentario engañoso, etc.), committeo, pusheo, y vuelvo a correr un review dirigido sobre ese diff incremental. Si un hallazgo implica una decisión de producto/UX/arquitectura (ej.: un trade-off de comportamiento que nadie pidió explícitamente) no lo resuelvo en silencio — te lo presento con opciones concretas y espero tu decisión, igual que documentado en §3 (no tomar decisiones de arquitectura nuevas directamente en el código).
- Correrlo es una recomendación, no una obligación: si un change es chico o de bajo riesgo, está bien saltarlo y archivar directo.

## 4. Mapa de archivos de este repo

| Archivo/carpeta | Propósito |
|---|---|
| `openspec/config.yaml` | Configuración de la CLI de OpenSpec (schema `spec-driven`). |
| `openspec/specs/<capability>/spec.md` | Fuente de verdad vigente por capability — requisitos funcionales en formato requirement/scenario. |
| `openspec/changes/<nombre>/` | Change en curso (proposal/specs delta/design/tasks) — no archivado todavía. |
| `openspec/changes/archive/` | Changes ya archivados (historial). |
| `AGENTS.md` | Este archivo — reglas de operación para cualquier agente. |
| `CLAUDE.md` | Punto de entrada para Claude Code CLI. |
| `.github/copilot-instructions.md` | Punto de entrada para GitHub Copilot CLI/Chat. |
| `.github/skills/`, `.github/prompts/` | Skills/prompts de OpenSpec para Copilot (equivalentes a los skills `/opsx:*` de Claude Code). |
| `.claude/commands/adversarial-review.md` | Comando `/adversarial-review` — review de 5 agentes en paralelo, desacoplado de `/opsx:archive` (ver §3.2). No es parte del flujo generado por `openspec update`, así que no se pisa al actualizar la CLI. |
| `.claude/commands/deploy-to-phone.md` | Comando `/deploy-to-phone` — `npm run build:android` + `./gradlew assembleDebug` (build fresco) seguido de `adb install -r` del APK debug en el teléfono de test. No es parte del flujo generado por `openspec update`. |

La ubicación del código sigue la estructura de carpetas ya en uso (`electron/`, `packages/layout-engine/`, `packages/migrations/`, `src/`, `shared/`) — no hay un mapeo formal spec↔carpeta más allá del nombre de la capability; para encontrar qué código implementa una capability, `grep` es suficiente dado que los nombres de capability (`layout-engine`, `template-schema`, etc.) coinciden con los nombres de paquete/carpeta reales.
