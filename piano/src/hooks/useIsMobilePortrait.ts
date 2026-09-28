'use client';

import { useState, useEffect } from 'react';

const MOBILE_PORTRAIT_QUERY = '(max-width: 768px) and (orientation: portrait)';

/**
 * Custom hook to detect if the viewport is in mobile portrait mode.
 * Evaluates (max-width: 768px) and (orientation: portrait).
 * Listens to media query changes, window resize, and orientation changes.
 */
export function useIsMobilePortrait(): boolean {
  const [isMobilePortrait, setIsMobilePortrait] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(MOBILE_PORTRAIT_QUERY);

    const updateMatch = () => {
      setIsMobilePortrait(mediaQueryList.matches);
    };

    // Initial check on mount
    updateMatch();

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateMatch);
    } else {
      // Compatibility for older Safari / WebViews
      // @ts-ignore
      mediaQueryList.addListener(updateMatch);
    }

    window.addEventListener('resize', updateMatch);
    window.addEventListener('orientationchange', updateMatch);

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', updateMatch);
      } else {
        // @ts-ignore
        mediaQueryList.removeListener(updateMatch);
      }
      window.removeEventListener('resize', updateMatch);
      window.removeEventListener('orientationchange', updateMatch);
    };
  }, []);

  return isMobilePortrait;
}
