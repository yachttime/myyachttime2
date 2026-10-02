import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface BobVideoAction {
  title: string;
  video_url: string;
}

export interface BobFormField {
  name: string;
  label: string;
  type: 'buttons' | 'number' | 'text' | 'textarea' | 'checkbox' | 'select';
  section: string;
  options?: string[];
  notes_field?: string;
  value: string;
}

export interface BobActiveForm {
  key: string;
  label: string;
  fields: BobFormField[];
}

export interface BobAppAction {
  type: 'open_video' | 'open_page' | 'open_form' | 'set_form_fields';
  key?: string;
  video_url?: string;
  title?: string;
  record_id?: string;
  prefill?: Record<string, string>;
  values?: Record<string, string>;
  next_field?: string;
  done?: boolean;
}

export type BobAvatarState = 'idle' | 'talking' | 'thinking';

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

  // Active form registration
  activeForm: BobActiveForm | null;
  registerForm: (form: BobActiveForm | null) => void;

  // Form field updates from Bob
  formFieldUpdate: { values: Record<string, string>; nextField?: string; done?: boolean; timestamp: number } | null;
  setFormFields: (values: Record<string, string>, nextField?: string, done?: boolean) => void;
  clearFormUpdate: () => void;

  // Trigger guided fill
  guidedFillTrigger: { key: string; timestamp: number } | null;
  triggerGuidedFill: (key: string) => void;
  clearGuidedFillTrigger: () => void;

  // Avatar state
  avatarState: BobAvatarState;
  setAvatarState: (state: BobAvatarState) => void;
  avatarPaused: boolean;
  setAvatarPaused: (paused: boolean) => void;
}

const BobContext = createContext<BobContextValue | null>(null);

// Re-export for convenience
export type { BobAvatarState };

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
  const [activeForm, setActiveForm] = useState<BobActiveForm | null>(null);
  const [formFieldUpdate, setFormFieldUpdate] = useState<{ values: Record<string, string>; nextField?: string; done?: boolean; timestamp: number } | null>(null);
  const [guidedFillTrigger, setGuidedFillTrigger] = useState<{ key: string; timestamp: number } | null>(null);
  const [avatarState, setAvatarState] = useState<BobAvatarState>('idle');
  const [avatarPaused, setAvatarPaused] = useState(false);

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
  const registerForm = useCallback((form: BobActiveForm | null) => setActiveForm(form), []);
  const setFormFields = useCallback((values: Record<string, string>, nextField?: string, done?: boolean) => {
    setFormFieldUpdate({ values, nextField, done, timestamp: Date.now() });
  }, []);
  const clearFormUpdate = useCallback(() => setFormFieldUpdate(null), []);
  const triggerGuidedFill = useCallback((key: string) => {
    setGuidedFillTrigger({ key, timestamp: Date.now() });
  }, []);
  const clearGuidedFillTrigger = useCallback(() => setGuidedFillTrigger(null), []);
  const setAvatarStateCb = useCallback((s: BobAvatarState) => setAvatarState(s), []);
  const setAvatarPausedCb = useCallback((paused: boolean) => setAvatarPaused(paused), []);

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
      activeForm,
      registerForm,
      formFieldUpdate,
      setFormFields,
      clearFormUpdate,
      guidedFillTrigger,
      triggerGuidedFill,
      clearGuidedFillTrigger,
      avatarState,
      setAvatarState: setAvatarStateCb,
      avatarPaused,
      setAvatarPaused: setAvatarPausedCb,
    }}>
      {children}
    </BobContext.Provider>
  );
}
