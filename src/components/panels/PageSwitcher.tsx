import { useEPPStore } from '../../store/index.js';

export function PageSwitcher() {
  const pages = useEPPStore((state) => state.document.pages);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const setActivePageId = useEPPStore((state) => state.setActivePageId);
  const addPage = useEPPStore((state) => state.addPage);
  const removePage = useEPPStore((state) => state.removePage);

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
    <div className="flex items-center gap-2">
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
      <button
        type="button"
        onClick={addPage}
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600"
      >
        Add Page
      </button>
      <button
        type="button"
        onClick={() => removePage(activePageId)}
        disabled={pageCount <= 1}
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Remove Page
      </button>
    </div>
  );
}
