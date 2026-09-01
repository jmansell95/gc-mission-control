import React, { createContext, useContext, useState, useEffect } from 'react';

const MobileAppContext = createContext({ isMobileApp: false, isStandalone: false });

/**
 * Detects whether the app is running as an installed PWA or native APK
 * (Trusted Web Activity / Bubblewrap), and exposes a global `isMobileApp`
 * flag so the shell, pages, and modals can adapt to a native-app layout.
 *
 * Detection signals:
 *  - display-mode: standalone  (PWA installed / TWA APK)
 *  - display-mode: fullscreen  (some APK wrappers)
 *  - navigator.standalone      (legacy iOS PWA)
 *  - Android UA without browser chrome
 *
 * The mobile app shell activates only when the app is installed (standalone)
 * AND on a phone/tablet viewport (<1024px). Desktop browsers and desktop
 * PWAs keep the existing responsive layout.
 */
export function MobileAppProvider({ children }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const detect = () => {
      const mqlStandalone = window.matchMedia?.('(display-mode: standalone)');
      const mqlFullscreen = window.matchMedia?.('(display-mode: fullscreen)');
      const navStandalone = window.navigator?.standalone === true;
      const isAndroid = /android/i.test(window.navigator?.userAgent || '');
      // Android browser has chrome.webstore; a TWA/Cordova APK does not
      const noBrowserChrome = isAndroid && !window.chrome?.webstore;

      const standalone =
        mqlStandalone?.matches || mqlFullscreen?.matches || navStandalone || noBrowserChrome;

      setIsStandalone(standalone);
      setIsNarrow(window.innerWidth < 1024);
    };

    detect();

    // Re-evaluate on resize, but only if not already confirmed standalone
    // (standalone state never changes at runtime — only viewport does).
    const mql = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => detect();
    mql?.addEventListener?.('change', onDisplayChange);

    const onResize = () => setIsNarrow(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);

    return () => {
      mql?.removeEventListener?.('change', onDisplayChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const isMobileApp = isStandalone && isNarrow;

  // Tag <body> so global CSS can adapt modal/sheet rendering for the app shell.
  useEffect(() => {
    if (isMobileApp) {
      document.body.classList.add('mobile-app');
    } else {
      document.body.classList.remove('mobile-app');
    }
  }, [isMobileApp]);

  return (
    <MobileAppContext.Provider value={{ isMobileApp, isStandalone }}>
      {children}
    </MobileAppContext.Provider>
  );
}

export function useMobileApp() {
  return useContext(MobileAppContext);
}