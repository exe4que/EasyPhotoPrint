import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { BoxMm, FocalPoint, ImageAsset, ImageRotationDeg } from '@epp/layout-engine';

import { panEnvelopeParentFocalPoint } from '../lib/imageDisplay.js';
import { pxToMm } from '../lib/units.js';

/** Below this many screen px of cumulative movement, a press is left as an ordinary tap (so
 * click-to-select keeps working on an envelopeParent slot) rather than arming a pan. */
const ARM_THRESHOLD_PX = 4;

export interface EnvelopeParentPanImageProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

interface CreatePanPropsParams {
  pageId: string;
  nodeId: string;
  asset: ImageAsset;
  slotBoxMm: BoxMm;
  rotationDeg: ImageRotationDeg | undefined;
  focalPoint: FocalPoint | undefined;
  previewZoom: number;
}

interface UseEnvelopeParentPanGestureOptions {
  /** Fires once, the moment a press arms (crosses ARM_THRESHOLD_PX) -- the caller suppresses the
   * trailing click here, the same way it already does for a divider or freeform drag. */
  onArm: () => void;
  /** Called only when a move actually changes the focalPoint (see this hook's own doc comment for
   * why a no-op move is filtered out here rather than left to the caller). The *first* call for a
   * given gesture happens before `pauseHistory` -- deliberately, so it lands as an ordinary tracked
   * update -- every call after that happens while paused. */
  onFocalPointChange: (pageId: string, nodeId: string, focalPoint: FocalPoint) => void;
  pauseHistory: () => void;
  resumeHistory: () => void;
  /** Fires once an armed drag ends (pointerup or pointercancel) that actually paused history --
   * i.e. it changed the focalPoint at least once. Never fires for a press that stayed below the
   * arm threshold, or that armed but never produced a real change. */
  onDragEnd: () => void;
}

interface Session extends CreatePanPropsParams {
  pointerId: number;
  armed: boolean;
  historyPaused: boolean;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  currentFocalPoint: FocalPoint;
  cleanup: () => void;
}

/**
 * Pointer Events-based drag gesture for panning an envelopeParent imageSlot's focalPoint --
 * following the same setPointerCapture pattern this capability already uses for divider resize,
 * freeform move/resize/rotate, and the Image Library card drag, in place of the removed
 * slot-to-slot HTML5 drag-and-drop the two features are incompatible with.
 *
 * Only one session is tracked (a single shared ref, not one per slot) since only one pointer can
 * be dragging at a time app-wide -- the same architecture useLibraryImageDragGesture uses. Arming
 * is threshold-based rather than immediate: a plain tap (no meaningful movement) never calls
 * onArm, so it's left entirely to the caller's existing click-to-select handling.
 *
 * Unlike NodeDivider/FreeformElementView (which call `pauseHistory` unconditionally on drag start,
 * before any live update), this hook calls `pauseHistory` *after* the first update that actually
 * changes focalPoint, not before it -- pausing zundo's tracking before the first update means that
 * update's own pre-drag snapshot is never captured, so the whole gesture ends up with *zero* undo
 * entries instead of one. Pausing only once the true "before" state has already been recorded
 * keeps the rest of the drag's live updates untracked (no spam) while still leaving exactly one
 * correct undo step behind.
 */
export function useEnvelopeParentPanGesture({ onArm, onFocalPointChange, pauseHistory, resumeHistory, onDragEnd }: UseEnvelopeParentPanGestureOptions) {
  const sessionRef = useRef<Session | null>(null);

  const createPanProps = useCallback(
    (params: CreatePanPropsParams): EnvelopeParentPanImageProps => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
          return;
        }

        const pointerId = event.pointerId;
        const element = event.currentTarget;
        const startClientX = event.clientX;
        const startClientY = event.clientY;

        const handleMove = (moveEvent: PointerEvent) => {
          const session = sessionRef.current;
          if (!session || moveEvent.pointerId !== session.pointerId) {
            return;
          }

          if (!session.armed) {
            const distancePx = Math.hypot(moveEvent.clientX - session.startClientX, moveEvent.clientY - session.startClientY);
            if (distancePx < ARM_THRESHOLD_PX) {
              return;
            }
            session.armed = true;
            element.setPointerCapture(pointerId);
            onArm();
          }

          moveEvent.preventDefault();
          const deltaXMm = pxToMm(moveEvent.clientX - session.lastClientX, session.previewZoom);
          const deltaYMm = pxToMm(moveEvent.clientY - session.lastClientY, session.previewZoom);
          session.lastClientX = moveEvent.clientX;
          session.lastClientY = moveEvent.clientY;

          const nextFocalPoint = panEnvelopeParentFocalPoint(
            session.asset,
            session.slotBoxMm,
            session.rotationDeg,
            session.currentFocalPoint,
            deltaXMm,
            deltaYMm,
          );
          if (nextFocalPoint.x === session.currentFocalPoint.x && nextFocalPoint.y === session.currentFocalPoint.y) {
            return;
          }
          session.currentFocalPoint = nextFocalPoint;
          onFocalPointChange(session.pageId, session.nodeId, nextFocalPoint);
          if (!session.historyPaused) {
            session.historyPaused = true;
            pauseHistory();
          }
        };

        const handleEnd = (endEvent: PointerEvent) => {
          const session = sessionRef.current;
          if (!session || endEvent.pointerId !== session.pointerId) {
            return;
          }
          sessionRef.current = null;
          session.cleanup();
          if (session.historyPaused) {
            resumeHistory();
            onDragEnd();
          }
        };

        const cleanup = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleEnd);
          window.removeEventListener('pointercancel', handleEnd);
        };

        sessionRef.current = {
          ...params,
          pointerId,
          armed: false,
          historyPaused: false,
          startClientX,
          startClientY,
          lastClientX: startClientX,
          lastClientY: startClientY,
          currentFocalPoint: params.focalPoint ?? { x: 0.5, y: 0.5 },
          cleanup,
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleEnd);
        window.addEventListener('pointercancel', handleEnd);
      },
    }),
    [onArm, onFocalPointChange, pauseHistory, resumeHistory, onDragEnd],
  );

  return { createPanProps };
}
