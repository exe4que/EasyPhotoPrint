import { useCallback } from 'react';
import type { DragEvent } from 'react';

const IMAGE_ASSET_DRAG_TYPE = 'application/x-epp-image-asset-id';
const IMAGE_DRAG_SOURCE_TYPE = 'application/x-epp-image-drag-source';

export type ImageDragSource = 'library' | 'page';

export function useDragAndDrop() {
  const createImageDragProps = useCallback((imageAssetId: string, source: ImageDragSource = 'library') => {
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(IMAGE_ASSET_DRAG_TYPE, imageAssetId);
        event.dataTransfer.setData(IMAGE_DRAG_SOURCE_TYPE, source);
      },
    };
  }, []);

  const createSlotDropProps = useCallback((onAssign: (imageAssetId: string, source: ImageDragSource) => void) => {
    return {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (event.dataTransfer.types.includes(IMAGE_ASSET_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        const imageAssetId = event.dataTransfer.getData(IMAGE_ASSET_DRAG_TYPE);
        if (!imageAssetId) {
          return;
        }

        event.preventDefault();
        const source = event.dataTransfer.getData(IMAGE_DRAG_SOURCE_TYPE) === 'page' ? 'page' : 'library';
        onAssign(imageAssetId, source);
      },
    };
  }, []);

  /** Like createSlotDropProps, but hands the drop event back too — for drop targets (e.g. a
   * freeformCanvas node) that need the cursor position at drop time, not just the asset id. */
  const createPositionalDropProps = useCallback(
    (onDrop: (imageAssetId: string, event: DragEvent<HTMLElement>) => void) => {
      return {
        onDragOver: (event: DragEvent<HTMLElement>) => {
          if (event.dataTransfer.types.includes(IMAGE_ASSET_DRAG_TYPE)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          const imageAssetId = event.dataTransfer.getData(IMAGE_ASSET_DRAG_TYPE);
          if (!imageAssetId) {
            return;
          }

          event.preventDefault();
          onDrop(imageAssetId, event);
        },
      };
    },
    [],
  );

  return {
    createImageDragProps,
    createSlotDropProps,
    createPositionalDropProps,
  };
}

