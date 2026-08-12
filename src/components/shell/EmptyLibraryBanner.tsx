import { useEPPStore } from '../../store/index.js';

/** Full-width prompt shown above the page canvas whenever the Image Library is empty, directing a
 * new user to the app's first required step. Purely reactive to `imagePool` -- no dismiss control,
 * so it reappears if the library becomes empty again later (see the `onboarding-banner` capability). */
export function EmptyLibraryBanner({ onActivate }: { onActivate: () => void }) {
  const isLibraryEmpty = useEPPStore((state) => state.imagePool.length === 0);

  if (!isLibraryEmpty) {
    return null;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      className="mb-4 flex-none cursor-pointer rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
    >
      Add images to library to start
    </div>
  );
}
