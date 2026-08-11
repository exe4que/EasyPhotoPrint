import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const ARM_THRESHOLD_PX = 8;

export interface ArmedLibraryImageDrag {
  imageAssetId: string;
  clientX: number;
  clientY: number;
}

interface PointerStart {
  imageAssetId: string;
  pointerId: number;
  startX: number;
  startY: number;
}

export interface LibraryImageDragCardProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface LibraryImageDragGesture {
  createCardDragProps: (imageAssetId: string) => LibraryImageDragCardProps;
}

interface UseLibraryImageDragGestureOptions {
  /** Fires once, the moment a press crosses the arming threshold. */
  onArm?: () => void;
  /** Fires when an armed drag ends (pointerup or pointercancel), with the release position. Does
   * not fire for a plain tap (released without crossing the threshold) -- the browser's own click
   * still fires for that, unsuppressed, so the caller's ordinary click/select handling applies. */
  onDrop: (imageAssetId: string, clientX: number, clientY: number) => void;
}

/**
 * Pointer Events-based drag gesture for an Image Library card, following the same
 * `setPointerCapture` pattern `pointer-based-gestures` already established for divider resize and
 * freeform move/resize/rotate -- used in place of HTML5 drag-and-drop, which touch input can't
 * reliably start. A press followed by movement past `ARM_THRESHOLD_PX` arms the drag (capturing
 * the pointer so it keeps receiving events regardless of what's underneath); releasing below that
 * threshold is left as an ordinary tap.
 */
export function useLibraryImageDragGesture({ onArm, onDrop }: UseLibraryImageDragGestureOptions) {
  const [armedDrag, setArmedDrag] = useState<ArmedLibraryImageDrag | null>(null);
  const startRef = useRef<PointerStart | null>(null);
  const armedDragRef = useRef<ArmedLibraryImageDrag | null>(null);
  // Pointer capture only covers pointer events, not the "click" that follows pointerup -- capture
  // is released before click fires, so click still undergoes ordinary hit-testing and can land on
  // whatever's visually at the release point (a tab bar button, another card, anything). A
  // window-level capture-phase listener, installed only while a drag is armed, swallows exactly
  // that one trailing click regardless of which element it would otherwise have hit -- the general
  // form of the `suppressNextClickRef` pattern PageStage already uses for its own drags, needed
  // here because the drag can end over components this hook knows nothing about.
  const clickSuppressorRef = useRef<((event: MouseEvent) => void) | null>(null);

  const stopSuppressingClicks = useCallback(() => {
    const suppressor = clickSuppressorRef.current;
    if (!suppressor) {
      return;
    }
    clickSuppressorRef.current = null;
    // Deferred so the trailing click (dispatched right after pointerup) is still caught before
    // the listener comes off -- removing it synchronously here would race the click.
    setTimeout(() => window.removeEventListener('click', suppressor, { capture: true }), 0);
  }, []);

  const endGesture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) {
        return;
      }
      startRef.current = null;
      const wasArmed = armedDragRef.current !== null;
      armedDragRef.current = null;
      setArmedDrag(null);
      stopSuppressingClicks();
      if (wasArmed) {
        onDrop(start.imageAssetId, event.clientX, event.clientY);
      }
    },
    [onDrop, stopSuppressingClicks],
  );

  const createCardDragProps = useCallback(
    (imageAssetId: string): LibraryImageDragCardProps => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        startRef.current = {
          imageAssetId,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const start = startRef.current;
        if (!start || start.pointerId !== event.pointerId) {
          return;
        }

        if (!armedDragRef.current) {
          const dx = event.clientX - start.startX;
          const dy = event.clientY - start.startY;
          if (Math.hypot(dx, dy) < ARM_THRESHOLD_PX) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          const suppressor = (clickEvent: MouseEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
          };
          clickSuppressorRef.current = suppressor;
          window.addEventListener('click', suppressor, { capture: true });
          onArm?.();
        }

        const next: ArmedLibraryImageDrag = { imageAssetId, clientX: event.clientX, clientY: event.clientY };
        armedDragRef.current = next;
        setArmedDrag(next);
      },
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
    }),
    [endGesture, onArm],
  );

  return { armedDrag, createCardDragProps };
}
