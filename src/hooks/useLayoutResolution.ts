// @spec OPENSPEC.md §4.1, §6.1 — memoized layout resolution for the active page
import { resolveLayout } from '@epp/layout-engine';
import { useMemo } from 'react';

import { createPageBoxMm } from '../lib/page.js';
import { useEPPStore } from '../store/index.js';

export function useLayoutResolution() {
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const page = useEPPStore(
    (state) => state.document.pages.find((entry) => entry.id === activePageId) ?? state.document.pages[0],
  );

  return useMemo(() => {
    const pageBox = createPageBoxMm(page.pageConfig);
    return {
      page,
      pageBox,
      layout: resolveLayout(page.rootNode, pageBox),
    };
  }, [page]);
}

