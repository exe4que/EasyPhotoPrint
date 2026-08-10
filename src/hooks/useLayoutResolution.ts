import { resolveLayout } from '@epp/layout-engine';
import { useMemo } from 'react';

import { createPageBoxMm } from '../lib/page.js';
import { useEPPStore } from '../store/index.js';

export function useLayoutResolution() {
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const sheetSize = useEPPStore((state) => state.document.sheetSize);
  const page = useEPPStore(
    (state) => state.document.pages.find((entry) => entry.id === activePageId) ?? state.document.pages[0],
  );

  return useMemo(() => {
    const pageBox = createPageBoxMm(sheetSize, page.pageConfig.orientation);
    return {
      page,
      pageBox,
      layout: resolveLayout(page.rootNode, pageBox),
    };
  }, [sheetSize, page]);
}

