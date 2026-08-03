# SPEC_MAP.md — Trazabilidad Spec ↔ Código

Índice de qué archivo de código implementa cada sección de `OPENSPEC.md`. Es la herramienta concreta detrás de la regla de "spec anchoring" definida en `AGENTS.md` §2.

**Regla de actualización:** este archivo se actualiza en el mismo cambio que agrega, mueve o elimina un comentario `@spec OPENSPEC.md §X` en el código — nunca en un paso separado. Si agregás un archivo nuevo que implementa una sección del spec, agregalo acá. Si borrás o movés un archivo, actualizá su fila.

**Estado:** `No implementado` (archivo aún no existe) · `Parcial` (existe pero no cubre toda la sección) · `Completo` (implementa la sección tal como está documentada) · `Desactualizado` (el código diverge del spec — bandera roja, resolver antes de cerrar cualquier tarea que toque ese archivo).

---

## §2 Technical Architecture

| Sección | Tema | Archivo(s) destino | Estado |
|---|---|---|---|
| §2.2 | Arquitectura de procesos Electron, reglas de seguridad, contextBridge | `electron/main/index.ts`, `electron/preload/index.ts` | Completo |
| §2.2 | Impresión siempre vía PDF (temp file + `webContents.print`) | `electron/main/ipc/print.handlers.ts` | No implementado |
| §2.3 | Store Zustand + `zundo`, slices `document`/`ui`/`imagePool` | `src/store/documentSlice.ts`, `src/store/uiSlice.ts`, `src/store/imagePoolSlice.ts`, `src/store/index.ts` | Parcial |
| §2.3 | `pageConfig` por página (no global) | `src/store/documentSlice.ts` | Completo |
| §2.3 | Swap vs. reemplazo al asignar imagen a un slot | `src/store/documentSlice.ts` (`assignImageToSlot`) | Completo |
| §2.3 | Selección nunca vacía en `Simple` (cae al root, no a `[]`) | `src/store/uiSlice.ts` (`clearSelection`, `setLayoutMode`, `setActivePageId`), `src/App.tsx`, `src/components/canvas/PageStage.tsx` | Completo |
| §2.3 | Gating del botón `Simple` (`isSimpleModeCompatible`) + auto-switch a `nested` al aplicar un template incompatible | `packages/layout-engine/src/simpleMode.ts`, `src/App.tsx`, `src/components/templates/TemplateGallery.tsx` | Completo |
| §2.4 | `AppSettings` (unitSystem, defaultPrinterName), persistencia | `electron/main/ipc/settings.handlers.ts`, `electron/main/ipc/settings.helpers.ts`, `src/store/settingsSlice.ts` | Completo |
| §2.4 | Conversión/formateo de unidades (`formatLength`/`parseLength`/`mmToInches`) | `src/lib/units.ts` | Completo |
| §2.4 | Toggle de unidades en la UI | `src/components/settings/UnitToggle.tsx` | Completo |

## §3 Data Schema

| Sección | Tema | Archivo(s) destino | Estado |
|---|---|---|---|
| §3.2 | JSON Schema `EPPTemplate` (`.epptemplate`) | `shared/schemas/template.schema.json`, `packages/layout-engine/src/types.ts` | Completo |
| §3.2 | Migración de schema por versión | `packages/migrations/src/index.ts` | Parcial |
| §3.3 | Modelo `EPPProject`/`ImageAsset`/`PageConfig` (`.eppproj`) | `shared/schemas/project.schema.json`, `electron/main/ipc/fs.handlers.ts` | Parcial |
| §3.3 | Reconciliación de templates (versionado in-place) | `packages/layout-engine/src/reconcileTemplate.ts` | Completo |
| §3.3 | UI Save/Save as/Delete de templates + popup de confirmación reutilizado | `src/components/templates/SaveTemplateDialog.tsx`, `src/components/templates/TemplateGallery.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/hooks/useTemplateLibrary.ts`, `src/store/documentSlice.ts` (`linkPageToTemplate`) | Completo |

## §4 Layout Engine Design

| Sección | Tema | Archivo(s) destino | Estado |
|---|---|---|---|
| §4.1 | `resolveLayout` (algoritmo principal, dos pasadas) | `packages/layout-engine/src/resolveLayout.ts` | Completo |
| §4.1 | `distributeChildren`, `resolveCrossAxis`, `applyPadding` | `packages/layout-engine/src/flexDistribution.ts` | Completo |
| §4.1 | `computeGridCells`, `resolveDimensions` | `packages/layout-engine/src/grid.ts` | Completo |
| §4.1.1 | `resizeSiblingsByDrag`, `isDividerLocked`, `computeMinRequiredMainSizeMm` (incl. piso de `specificSizeMm`), `fixedSizeMm` | `packages/layout-engine/src/flexDistribution.ts` | Completo |
| §4.1.1 | UI de divisoria arrastrable | `src/components/canvas/NodeDivider.tsx`, `src/components/canvas/PageStage.tsx` | Completo |
| §4.1.1.1 | `scalingRule: 'specificSize'` — resolución de eje derivado, `growSlotToMinimum`, `setSlotSpecificSize` | `src/store/documentSlice.ts` | Completo |
| §4.1.1.1 | `computeSpecificSize`, `isSpecificSizeUnsatisfied` (offset/tamaño puro, sin acceso a `ImageAsset`) | `packages/layout-engine/src/imageFit.ts`, `src/lib/imageDisplay.ts` | Completo |
| §4.1.1.1 | UI — outline rojo + tooltip en la imagen, inputs de ancho/alto en `PropertiesPanel` | `src/components/canvas/PageStage.tsx`, `src/components/canvas/FreeformElement.tsx`, `src/components/panels/PropertiesPanel.tsx` | Completo |
| §4.1.2 | `validateLayoutFeasibility` | `packages/layout-engine/src/feasibility.ts` | Completo |
| §4.1, §4.1.1.1 | Etiquetas de dimensión por hover (`DimensionOverlay`, slot + imagen; siempre visible + candado cuando `specificSize`) | `src/components/canvas/DimensionOverlay.tsx`, `src/components/canvas/PageStage.tsx` | Completo |
| §4.1 | `freeformCanvas` anidable como cualquier otro tipo de nodo (opción de tipo de nodo raíz en `Simple`, retype/add en `nested`; sin modo `Freeform` de nivel superior) | `src/store/documentSlice.ts`, `src/components/panels/LayoutTreePanel.tsx`, `src/components/panels/PropertiesPanel.tsx`, `src/App.tsx`, `src/store/uiSlice.ts` | Completo |
| §4.2 | Transform freeform (mover/rotar/escalar con DOM + CSS), agregar/quitar elementos, clip al área imprimible | `src/components/canvas/FreeformElement.tsx`, `src/components/canvas/PageStage.tsx`, `src/store/documentSlice.ts` (`addFreeformElement`/`removeFreeformElement`/`updateFreeformElementTransform`) | Parcial (falta snapping) |
| §4.2 | Contención — `clampFreeformPosition`/`computeRotatedAabbMm` (el elemento no puede salir por completo del área del nodo) | `packages/layout-engine/src/freeform.ts` | Completo |
| §4.1.1, §4.2 | `pauseHistory`/`resumeHistory` alrededor de gestos de drag (divisorias y freeform) | `src/hooks/useUndoRedo.ts`, `src/components/canvas/PageStage.tsx`, `src/components/canvas/FreeformElement.tsx`, `src/components/canvas/NodeDivider.tsx` | Completo |

## §5 PDF Generation Strategy

| Sección | Tema | Archivo(s) destino | Estado |
|---|---|---|---|
| §5.1 | Conversión de coordenadas mm↔px↔pt | `src/lib/units.ts`, `electron/main/services/pdf-builder.ts` | Parcial |
| §5.2 | Pipeline de exportación (`pdf:export` IPC) | `electron/main/ipc/pdf.handlers.ts`, `electron/main/services/pdf-builder.ts` | No implementado |
| §5.3 | Validación de resolución / DPI efectivo | `electron/main/services/image-processor.ts` | No implementado |
| §5.4 | `computeFitInParent`, `computeEnvelopeCrop`, `computeStretch`, `computeSpecificSize` | `packages/layout-engine/src/imageFit.ts` | Completo |
| §5.5 | Clip al área imprimible en PDF (`drawClippedImage`) | `electron/main/services/pdf-builder.ts` | No implementado |

## Componentes de UI sin sección numerada dedicada

Estos archivos implementan funcionalidad descrita en el spec (schema de `ImageAsset`, user journey §1.3, estructura de carpetas §6.1) sin tener un algoritmo propio en una sección numerada — igual deben llevar su tag `@spec` apuntando a la referencia más específica disponible.

| Tema | Archivo(s) destino | Referencia | Estado |
|---|---|---|---|
| Ingesta de imágenes (dialog + DnD + pool) | `src/components/panels/ImageLibraryPanel.tsx`, `src/hooks/useDragAndDrop.ts`, `electron/main/ipc/fs.handlers.ts`, `src/store/imagePoolSlice.ts` | §1.3, §3.3 (`ImageAsset`) | Parcial |
| Panel de árbol de layout editable | `src/components/panels/LayoutTreePanel.tsx` | §4.1, §6.1 | Parcial |
| Inspector contextual (alignment, gap, `fixedSizeMm`, `specificSizeMm`, cantidad de slots en `horizontal`/`vertical`) | `src/components/panels/PropertiesPanel.tsx`, `src/store/documentSlice.ts` (`setContainerChildCount`, `setSlotSpecificSize`) | §4.1, §4.1.1, §4.1.1.1, §2.4, §2.3 | Parcial |
| Setup de página por página | `src/components/panels/PageSetupPanel.tsx` | §2.3, §2.4 | Completo |
| Galería y miniaturas de templates (generadas dinámicamente) | `src/components/templates/TemplateGallery.tsx`, `src/components/templates/TemplateThumbnail.tsx` | §6.1 (decisión de diseño) | Completo |
| CRUD de templates (list/save/delete) | `src/components/templates/SaveTemplateDialog.tsx`, `electron/main/ipc/templates.handlers.ts`, `electron/main/ipc/templates.helpers.ts` | §3.1, §3.3 | Completo |

---

## Cómo usar este archivo

- **Antes de escribir código nuevo para una sección del spec:** buscá la fila correspondiente acá para saber en qué archivo va, según la estructura ya decidida en §6.1.
- **Antes de cambiar `OPENSPEC.md`:** buscá la(s) sección(es) que vas a tocar en la columna "Sección", y revisá el estado de sus archivos. Si dicen `Completo` o `Parcial`, ese código necesita el mismo cambio.
- **Al terminar cualquier tarea que toque código:** actualizá el `Estado` de las filas afectadas.
