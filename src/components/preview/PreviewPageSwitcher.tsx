import { useEPPStore } from '../../store/index.js';

/** Page navigation for the print-preview screen: previous/next and "Page N of M" only -- no
 * Add/Remove controls, since those are editing actions that don't belong in a print-faithful
 * preview. */
export function PreviewPageSwitcher() {
  const pages = useEPPStore((state) => state.document.pages);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const setActivePageId = useEPPStore((state) => state.setActivePageId);

  const activeIndex = pages.findIndex((page) => page.id === activePageId);
  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  const pageCount = pages.length;

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setActivePageId(pages[currentIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (currentIndex < pageCount - 1) {
      setActivePageId(pages[currentIndex + 1].id);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1">
      <button
        type="button"
        onClick={goToPrevious}
        disabled={currentIndex === 0}
        aria-label="Previous page"
        className="flex h-6 w-6 items-center justify-center rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      <span className="min-w-24 text-center text-xs text-slate-300">
        Page {currentIndex + 1} of {pageCount}
      </span>
      <button
        type="button"
        onClick={goToNext}
        disabled={currentIndex === pageCount - 1}
        aria-label="Next page"
        className="flex h-6 w-6 items-center justify-center rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
