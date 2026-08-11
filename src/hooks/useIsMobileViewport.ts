import { useEffect, useState } from 'react';

/** One pixel under Tailwind's `lg` breakpoint (1024px), so this hook and the desktop shell's own
 * `lg:` CSS agree on exactly where the line is. Reactive via `matchMedia`'s `change` event -- not
 * a one-time read at mount -- so `App.tsx` can switch shells live as the window is resized, which
 * is what makes the mobile shell testable by resizing the Electron window instead of needing a
 * real Android device for every iteration. */
const MOBILE_VIEWPORT_QUERY = '(max-width: 1023.98px)';

export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_VIEWPORT_QUERY).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

    setIsMobile(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
