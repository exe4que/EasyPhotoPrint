// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { registerPlatformAdapter, type EppAPI } from '../../lib/platform/contract.js';
import { useEPPStore } from '../../store/index.js';
import { PropertiesPanel } from './PropertiesPanel.js';

// startNewProject() (run in this file's afterEach) fire-and-forgets fs.resetWorkingStorage(), so a
// platform adapter must be registered before any test runs -- see store/index.test.ts's identical need.
registerPlatformAdapter({
  fs: {
    saveProject: async () => null,
    openProject: async () => null,
    resetWorkingStorage: async () => {},
  },
  dialog: {
    relinkImage: async () => null,
  },
} as unknown as EppAPI);

describe('PropertiesPanel slot-clipboard menu', () => {
  afterEach(() => {
    cleanup();
    useEPPStore.getState().startNewProject();
  });

  it('shows the "⋮" slot-clipboard menu for an imageSlot (default page root, no selection)', () => {
    render(<PropertiesPanel />);

    expect(screen.getByRole('button', { name: 'Slot actions' })).toBeTruthy();
  });

  it('hides the "⋮" menu when the in-view node is a container, not an imageSlot', () => {
    useEPPStore.getState().retypeLayoutNode('page-1', 'root-grid', 'grid');

    render(<PropertiesPanel />);

    expect(screen.queryByRole('button', { name: 'Slot actions' })).toBeNull();
  });

  it('hides the "⋮" menu when a library image is selected', () => {
    useEPPStore.setState((state) => ({
      imagePool: [
        {
          id: 'image-a',
          originalPath: '/tmp/image-a.jpg',
          storedPath: '/tmp/image-a.jpg',
          fileName: 'image-a.jpg',
          widthPx: 100,
          heightPx: 100,
          thumbnailDataUrl: 'data:image/png;base64,',
        },
      ],
      ui: { ...state.ui, selection: { kind: 'image', id: 'image-a' } },
    }));

    render(<PropertiesPanel />);

    expect(screen.queryByRole('button', { name: 'Slot actions' })).toBeNull();
  });

  it('disables "Paste" until something has been copied, then enables it', () => {
    render(<PropertiesPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Slot actions' }));
    const pasteItemBefore = screen.getByRole('menuitem', { name: 'Paste' }) as HTMLButtonElement;
    expect(pasteItemBefore.disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' }); // close the menu deterministically (a disabled item ignores clicks)

    useEPPStore.getState().copySlotProperties('page-1', 'root-grid');

    fireEvent.click(screen.getByRole('button', { name: 'Slot actions' }));
    const pasteItemAfter = screen.getByRole('menuitem', { name: 'Paste' }) as HTMLButtonElement;
    expect(pasteItemAfter.disabled).toBe(false);
  });
});
