import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface ArmedLibraryImageDrag {
  imageAssetId: string;
  clientX: number;
  clientY: number;
}

export interface LibraryImageDragCardProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface LibraryImageDragGesture {
  createCardDragProps: (imageAssetId: string) => LibraryImageDragCardProps;
}

interface Session {
  imageAssetId: string;
  pointerId: number;
  armed: boolean;
  cleanup: () => void;
}

interface UseLibraryImageDragGestureOptions {
  /** Whether (clientX, clientY) is still inside the Image Library panel. While it is, the press is
   * left alone entirely -- no `preventDefault`, no pointer capture -- so the panel's own native
   * touch handling (its horizontal scroll) keeps working exactly as it would without this gesture.
   * Only once a point falls outside the panel does the press arm as a drag. */
  isInsidePanel: (clientX: number, clientY: number) => boolean;
  /** Fires once, the moment a press arms (its position has left the panel). */
  onArm?: () => void;
  /** Fires when an armed drag ends (pointerup or pointercancel), with the release position. Does
   * not fire for a plain tap or an in-panel scroll (never armed) -- the browser's own click still
   * fires for a tap, unsuppressed, so the caller's ordinary click/select handling applies. */
  onDrop: (imageAssetId: string, clientX: number, clientY: number) => void;
}

/**
 * Pointer Events-based drag gesture for an Image Library card, following the same
 * `setPointerCapture` pattern `pointer-based-gestures` already established for divider resize and
 * freeform move/resize/rotate -- used in place of HTML5 drag-and-drop, which touch input can't
 * reliably start.
 *
 * Calling `setPointerCapture` up front (on `pointerdown`, before knowing whether this press wants
 * to leave the panel) was tried and rejected: on-device testing showed it suppresses the browser's
 * native touch scrolling entirely, breaking the panel's own horizontal scroll for a press that
 * never intended to drag anything. Movement is tracked instead via `window`-level pointer
 * listeners registered for the life of the press -- these keep receiving events regardless of
 * which element the browser is currently hit-testing to -- and pointer capture is only engaged
 * once a move's position falls outside the Image Library panel (per `isInsidePanel`), at which
 * point the press commits to being a drag.
 *
 * That alone isn't quite enough on-device: the browser decides whether *any* touch counts as a
 * native pan/scroll gesture independently of pointer capture, purely from `touch-action` and the
 * gesture's direction -- and once it decides a vertical touch might be one (even one with nowhere
 * to scroll, since the panel doesn't overflow vertically), it cancels the pointer sequence
 * outright, so no further events reach any listener at all, window-level or not. The caller must
 * set `touch-action: pan-x` on each card (not `none`, and not the default `auto`) so horizontal
 * movement stays native (the panel's own scroll) while vertical movement is never eligible to be
 * claimed as a native pan in the first place, keeping this hook's move stream unbroken for the
 * upward swipe that leaves the panel.
 */
export function useLibraryImageDragGesture({ isInsidePanel, onArm, onDrop }: UseLibraryImageDragGestureOptions) {
  const [armedDrag, setArmedDrag] = useState<ArmedLibraryImageDrag | null>(null);
  const sessionRef = useRef<Session | null>(null);
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

  const createCardDragProps = useCallback(
    (imageAssetId: string): LibraryImageDragCardProps => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        const pointerId = event.pointerId;
        const element = event.currentTarget;

        const handleMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== pointerId) {
            return;
          }
          const session = sessionRef.current;
          if (!session) {
            return;
          }

          if (!session.armed) {
            if (isInsidePanel(moveEvent.clientX, moveEvent.clientY)) {
              // Still inside the panel -- leave this move as an ordinary scroll/tap gesture.
              return;
            }
            session.armed = true;
            element.setPointerCapture(pointerId);
            const suppressor = (clickEvent: MouseEvent) => {
              clickEvent.preventDefault();
              clickEvent.stopPropagation();
            };
            clickSuppressorRef.current = suppressor;
            window.addEventListener('click', suppressor, { capture: true });
            onArm?.();
          }

          // Armed: suppress whatever default touch handling this move would otherwise trigger.
          moveEvent.preventDefault();
          setArmedDrag({ imageAssetId, clientX: moveEvent.clientX, clientY: moveEvent.clientY });
        };

        const handleEnd = (endEvent: PointerEvent) => {
          if (endEvent.pointerId !== pointerId) {
            return;
          }
          const session = sessionRef.current;
          sessionRef.current = null;
          setArmedDrag(null);
          stopSuppressingClicks();
          session?.cleanup();
          if (session?.armed) {
            onDrop(imageAssetId, endEvent.clientX, endEvent.clientY);
          }
        };

        const cleanup = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleEnd);
          window.removeEventListener('pointercancel', handleEnd);
        };

        sessionRef.current = { imageAssetId, pointerId, armed: false, cleanup };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleEnd);
        window.addEventListener('pointercancel', handleEnd);
      },
    }),
    [isInsidePanel, onArm, onDrop, stopSuppressingClicks],
  );

  return { armedDrag, createCardDragProps };
}
