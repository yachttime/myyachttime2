import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface BobVideoAction {
  title: string;
  video_url: string;
}

export interface BobAppAction {
  type: 'open_video' | 'open_page' | 'open_form';
  key?: string;
  video_url?: string;
  title?: string;
  record_id?: string;
  prefill?: Record<string, string>;
}

interface BobContextValue {
  // Navigation — Dashboard registers its handler via registerNavigate
  currentRoute: string;
  setCurrentRoute: (route: string) => void;
  registerNavigate: (fn: (route: string, prefill?: Record<string, string>) => void) => void;
  navigate: (route: string, prefill?: Record<string, string>) => void;

  // Prefill data for forms
  prefillData: Record<string, string> | null;
  clearPrefill: () => void;

  // Video modal
  videoAction: BobVideoAction | null;
  openVideo: (action: BobVideoAction) => void;
  closeVideo: () => void;

  // Slide-over panel
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;

  // Hands-free pause for video
  handsFreePaused: boolean;
  setHandsFreePaused: (paused: boolean) => void;
}

const BobContext = createContext<BobContextValue | null>(null);

export function useBob() {
  const ctx = useContext(BobContext);
  if (!ctx) throw new Error('useBob must be used within BobProvider');
  return ctx;
}

export function BobProvider({ children }: { children: ReactNode }) {
  const [currentRoute, setCurrentRoute] = useState('/');
  const [videoAction, setVideoAction] = useState<BobVideoAction | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [handsFreePaused, setHandsFreePaused] = useState(false);
  const [prefillData, setPrefillData] = useState<Record<string, string> | null>(null);

  const navigateFnRef = useCallback((fn: (route: string, prefill?: Record<string, string>) => void) => {
    (window as any).__bobNavigateFn = fn;
  }, []);

  const navigate = useCallback((route: string, prefill?: Record<string, string>) => {
    if (prefill) setPrefillData(prefill);
    const fn = (window as any).__bobNavigateFn as ((route: string, prefill?: Record<string, string>) => void) | undefined;
    if (fn) {
      fn(route, prefill);
    }
    setCurrentRoute(route);
  }, []);

  const openVideo = useCallback((action: BobVideoAction) => {
    setVideoAction(action);
    setHandsFreePaused(true);
  }, []);

  const closeVideo = useCallback(() => {
    setVideoAction(null);
    setHandsFreePaused(false);
  }, []);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const clearPrefill = useCallback(() => setPrefillData(null), []);

  return (
    <BobContext.Provider value={{
      currentRoute,
      setCurrentRoute,
      registerNavigate: navigateFnRef,
      navigate,
      prefillData,
      clearPrefill,
      videoAction,
      openVideo,
      closeVideo,
      panelOpen,
      openPanel,
      closePanel,
      handsFreePaused,
      setHandsFreePaused,
    }}>
      {children}
    </BobContext.Provider>
  );
}
