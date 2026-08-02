// @spec OPENSPEC.md §1.3, §6.1 — drag-and-drop helpers for assigning library images to slots
import { useCallback } from 'react';
import type { DragEvent } from 'react';

const IMAGE_ASSET_DRAG_TYPE = 'application/x-epp-image-asset-id';

export function useDragAndDrop() {
  const createImageDragProps = useCallback((imageAssetId: string) => {
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(IMAGE_ASSET_DRAG_TYPE, imageAssetId);
      },
    };
  }, []);

  const createSlotDropProps = useCallback((onAssign: (imageAssetId: string) => void) => {
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
        onAssign(imageAssetId);
      },
    };
  }, []);

  return {
    createImageDragProps,
    createSlotDropProps,
  };
}

