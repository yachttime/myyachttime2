import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, Check, X, Clock, ListTodo, BookOpen, Loader2, AlertCircle, Volume2, VolumeX, Mic, Square, Play, Headphones } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase, isMasterRole } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BOB_SCREENS, BOB_SCREEN_MAP } from '../../lib/bobScreens';
import type { BobAppAction } from '../../contexts/BobContext';
import { useBob } from '../../contexts/BobContext';
import { BobAvatar } from './BobAvatar';

interface JarvisChatProps {
  userId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  inPanel?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposedActions?: PendingAction[];
  tasks?: JarvisTask[];
}

interface PendingAction {
  id: string;
  summary: string;
  reason: string;
  table_name: string;
  record_id: string;
  changes: Record<string, any>;
  before: Record<string, any> | null;
  status: string;
  created_at: string;
}

interface JarvisTask {
  id: string;
  title: string;
  details: string | null;
  priority: string;
  status: string;
  created_at: string;
}

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  active: boolean;
}

type Tab = 'chat' | 'pending' | 'tasks' | 'knowledge';

// ---- Speech Recognition types (not in standard TS lib) ----
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const STOP_PHRASES = ['stop', "that's all", 'goodbye', 'never mind', 'thanks bob'];
function isStopPhrase(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STOP_PHRASES.some(p => lower.includes(p));
}

async function callJarvis(supabaseUrl: string, payload: Record<string, any>): Promise<any> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function callApprove(supabaseUrl: string, actionId: string, decision: 'approve' | 'reject'): Promise<any> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ actionId, decision }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const SILENCE_MP3 = 'data:audio/mp3;base64,/+NIxJgAAAEWACQQANIAAAAAEluZF//w==';

function pickRecordingMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
}

export default function JarvisChat({ userId, supabaseUrl, inPanel }: JarvisChatProps) {
  const { userProfile } = useAuth();
  const canEditKnowledge = isMasterRole(userProfile?.role);
  const bob = useBob();
  const handsFreePausedRef = useRef(false);
  handsFreePausedRef.current = bob.handsFreePaused;
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [tasks, setTasks] = useState<JarvisTask[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice state
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('jarvis-voice') !== 'off'; } catch { return true; }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [needTapToHear, setNeedTapToHear] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const currentPlayerRef = useRef<HTMLAudioElement | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const isListeningRef = useRef(false);
  isListeningRef.current = isListening;
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current = isSpeaking;
  const handsFreeRef = useRef(false);
  handsFreeRef.current = handsFreeMode;
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyNetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reListenRef = useRef<(() => void) | null>(null);
  const sendWithTextRef = useRef<((text: string) => Promise<void>) | null>(null);
  const intentionalStopRef = useRef(true);
  const unintendedAbortCountRef = useRef(0);
  const restartDelayRef = useRef(300);
  const startWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningSessionRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speechSupported = typeof window !== 'undefined' && (
    !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
  );
  const mediaInputSupported = typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  const voiceInputSupported = speechSupported || mediaInputSupported;
  const iosDevice = isIOSDevice();
  const useRecording = iosDevice || !speechSupported;

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.addEventListener('pause', () => console.trace('[BobVoice] shared audio paused'));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      currentPlayerRef.current?.pause();
      currentPlayerRef.current = null;
      if (pendingUrlRef.current) {
        URL.revokeObjectURL(pendingUrlRef.current);
        pendingUrlRef.current = null;
      }
      audioRef.current = null;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const clearRecognitionWatchdogs = useCallback(() => {
    if (startWatchdogRef.current) clearTimeout(startWatchdogRef.current);
    if (listeningWatchdogRef.current) clearTimeout(listeningWatchdogRef.current);
    startWatchdogRef.current = null;
    listeningWatchdogRef.current = null;
  }, []);

  const resetListening = useCallback((message?: string) => {
    clearRecognitionWatchdogs();
    if (recognitionRef.current) {
      recognitionRef.current.onstart = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    bob.setAvatarPaused(false);
    if (message) setError(message);
  }, [bob, clearRecognitionWatchdogs]);

  const cleanupRecognizer = useCallback((reason: string) => {
    const old = recognitionRef.current;
    clearRecognitionWatchdogs();
    if (old) {
      console.trace('[HandsFree] abort/stop called from: ' + reason);
      old.onstart = null;
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
      intentionalStopRef.current = true;
      try { old.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    bob.setAvatarPaused(false);
  }, [bob, clearRecognitionWatchdogs]);

  const cleanupRecognizerRef = useRef(cleanupRecognizer);
  cleanupRecognizerRef.current = cleanupRecognizer;

  // Stop audio when component unmounts — empty deps so it only runs on real unmount
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      cleanupRecognizerRef.current('unmount');
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ''; }
      currentPlayerRef.current?.pause();
      currentPlayerRef.current = null;
      if (pendingUrlRef.current) { URL.revokeObjectURL(pendingUrlRef.current); pendingUrlRef.current = null; }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (safetyNetTimerRef.current) clearTimeout(safetyNetTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a || audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    if (pendingUrlRef.current || !a.paused) return;
    a.muted = true;
    a.src = SILENCE_MP3;
    a.play()
      .then(() => { if (a.src.startsWith('data:')) a.pause(); })
      .catch(() => {})
      .finally(() => { if (a.src.startsWith('data:')) a.muted = false; });
  }, []);

  const stopSharedAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    currentPlayerRef.current?.pause();
    currentPlayerRef.current = null;
  }, []);

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try { localStorage.setItem('jarvis-voice', next ? 'on' : 'off'); } catch { /* noop */ }
    if (!next) {
      stopSharedAudio();
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    }
  };

  const stopAllAudio = () => {
    stopSharedAudio();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  };

  // ---- Speaking (ElevenLabs only) ----
  const isIOSUA = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const speakReply = useCallback(async (text: string, hasActions: boolean) => {
    if (!voiceOnRef.current) return;
    intentionalStopRef.current = true;
    cleanupRecognizer('speakReply — stop mic before speaking');

    const audio = audioRef.current;
    if (!audio) return;

    let spokenText = text;
    if (hasActions) {
      spokenText += ' I need your approval on screen before I make that change.';
    }

    console.log('[BobVoice] requesting voice, text length:', spokenText.length);
    setVoiceLoading(true);
    setNeedTapToHear(false);

    const oldUrl = pendingUrlRef.current;
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      pendingUrlRef.current = null;
    }
    currentPlayerRef.current?.pause();
    currentPlayerRef.current = null;

    try {
      const { data, error } = await supabase.functions.invoke('jarvis-voice', {
        body: { text: spokenText },
      });
      if (error) throw error;

      const blob = data instanceof Blob ? new Blob([data], { type: 'audio/mpeg' }) : new Blob([data], { type: 'audio/mpeg' });
      console.log('[BobVoice] blob arrived, size:', blob.size, 'type:', blob.type);

      const url = URL.createObjectURL(blob);
      pendingUrlRef.current = url;
      if (safetyNetTimerRef.current) {
        clearTimeout(safetyNetTimerRef.current);
        safetyNetTimerRef.current = null;
      }

      const onEnded = () => {
        URL.revokeObjectURL(url);
        if (pendingUrlRef.current === url) pendingUrlRef.current = null;
        if (currentPlayerRef.current === player) currentPlayerRef.current = null;
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        bob.setAvatarState('idle');
        if (!iosDevice && handsFreeRef.current && reListenRef.current) {
          setTimeout(() => {
            if (handsFreeRef.current && !isSpeakingRef.current && !loadingRef.current && reListenRef.current) {
              reListenRef.current();
            }
          }, 400);
        }
      };
      const onErr = () => {
        if (pendingUrlRef.current === url) {
          URL.revokeObjectURL(url);
          pendingUrlRef.current = null;
        }
        if (currentPlayerRef.current === player) currentPlayerRef.current = null;
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        bob.setAvatarState('idle');
      };

      let player: HTMLAudioElement;
      if (isIOSUA()) {
        player = audio;
        audio.muted = false;
        audio.volume = 1;
        audio.src = url;
      } else {
        player = new Audio(url);
        player.preload = 'auto';
        player.setAttribute('playsinline', '');
        currentPlayerRef.current = player;
      }

      player.onended = onEnded;
      player.onerror = onErr;
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      bob.setAvatarState('talking');
      console.log('[BobVoice] play() starting', isIOSUA() ? '(shared)' : '(dedicated)');
      player.play().catch((playErr: any) => {
        console.log('[BobVoice] play() rejected:', playErr?.name || playErr);
        setNeedTapToHear(true);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        bob.setAvatarState('idle');
      });
    } catch (err: any) {
      console.error('[BobVoice] jarvis-voice error:', err);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      bob.setAvatarState('idle');
    } finally {
      setVoiceLoading(false);
    }
  }, [cleanupRecognizer, bob, iosDevice]);

  const replayMessage = (content: string, hasActions: boolean) => {
    stopSharedAudio();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    speakReply(content, hasActions);
  };

  // ---- Listening ----
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!mediaInputSupported || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, ext } = pickRecordingMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        if (recordingWatchdogRef.current) clearTimeout(recordingWatchdogRef.current);
        recordingWatchdogRef.current = null;
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setIsListening(false);
        isListeningRef.current = false;
        bob.setAvatarPaused(false);
        const audioBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' });
        if (!audioBlob.size) return;
        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append('audio', audioBlob, `bob-question.${ext}`);
          const { data, error } = await supabase.functions.invoke('jarvis-transcribe', { body: form });
          if (error) throw error;
          const text = typeof data?.text === 'string' ? data.text.trim() : '';
          if (!text) throw new Error('I did not hear a question. Please try again.');
          setInput(text);
          sendWithTextRef.current?.(text);
        } catch (err: any) {
          setError(err?.message || 'Voice transcription failed. Please try again.');
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      setIsRecording(true);
      setIsListening(true);
      isListeningRef.current = true;
      bob.setAvatarPaused(true);
      recordingWatchdogRef.current = setTimeout(() => stopRecording(), 30000);
      setError('');
    } catch (error: any) {
      setIsRecording(false);
      setIsListening(false);
      isListeningRef.current = false;
      bob.setAvatarPaused(false);
      const msg = error?.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Microphone unavailable.';
      setError(msg);
      console.error('[Voice] microphone permission failed:', error);
    }
  }, [bob, isRecording, mediaInputSupported, stopRecording]);

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    if (mediaRecorderRef.current) {
      stopRecording();
      return;
    }
    const active = recognitionRef.current;
    clearRecognitionWatchdogs();
    if (active) {
      console.trace('[HandsFree] abort/stop called from: stopListening');
      active.onstart = null;
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      try { active.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    bob.setAvatarPaused(false);
  }, [bob, clearRecognitionWatchdogs, stopRecording]);

  const stopHandsFree = useCallback((reason?: string) => {
    console.log('[HandsFree] pause —', reason || 'manual stop');
    intentionalStopRef.current = true;
    setHandsFreeMode(false);
    handsFreeRef.current = false;
    unintendedAbortCountRef.current = 0;
    restartDelayRef.current = 300;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (safetyNetTimerRef.current) {
      clearTimeout(safetyNetTimerRef.current);
      safetyNetTimerRef.current = null;
    }
    stopListening();
  }, [stopListening]);

  const startListening = useCallback(() => {
    if (!speechSupported || isListeningRef.current) return;

    clearRecognitionWatchdogs();
    intentionalStopRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    const Ctor = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as SpeechRecognitionCtor;
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    finalTranscriptRef.current = '';
    const session = ++listeningSessionRef.current;

    recognition.onstart = () => {
      if (session !== listeningSessionRef.current) return;
      if (startWatchdogRef.current) clearTimeout(startWatchdogRef.current);
      startWatchdogRef.current = null;
      setIsListening(true);
      isListeningRef.current = true;
      bob.setAvatarPaused(true);
      listeningWatchdogRef.current = setTimeout(() => resetListening(), 15000);
    };

    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else if (!iosDevice) interim += result[0].transcript;
      }
      if (final) finalTranscriptRef.current += final;
      const combined = (finalTranscriptRef.current + interim).trim();
      if (combined) setInput(combined);
    };

    recognition.onerror = (e: any) => {
      console.log('[Voice] recognizer error:', e.error);
      const unavailable = e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture';
      resetListening(unavailable ? 'Microphone unavailable — check Settings › General › Keyboard › Enable Dictation' : undefined);
    };

    recognition.onend = () => {
      if (session !== listeningSessionRef.current) return;
      const finalText = finalTranscriptRef.current.trim();
      clearRecognitionWatchdogs();
      recognitionRef.current = null;
      setIsListening(false);
      isListeningRef.current = false;
      bob.setAvatarPaused(false);
      if (finalText) {
        setInput(finalText);
        setTimeout(() => {
          if (finalText && sendWithTextRef.current) sendWithTextRef.current(finalText);
        }, 100);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error: any) {
      if (error?.name !== 'InvalidStateError') console.error('[Voice] recognizer start failed:', error);
      resetListening();
      return;
    }

    startWatchdogRef.current = setTimeout(() => resetListening(), 3000);
    setInput('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechSupported, iosDevice, bob, clearRecognitionWatchdogs, resetListening]);

  const startHandsFreeListening = useCallback(() => {
    if (iosDevice) return;
    if (!speechSupported) {
      console.log('[HandsFree] speech not supported, abort');
      return;
    }
    if (!handsFreeRef.current) {
      console.log('[HandsFree] not in hands-free mode, abort');
      return;
    }
    if (isSpeakingRef.current) {
      console.log('[HandsFree] Bob is speaking, skip restart');
      return;
    }
    if (loadingRef.current) {
      console.log('[HandsFree] loading/busy, skip restart');
      return;
    }
    if (handsFreePausedRef.current) {
      console.log('[HandsFree] paused for video, skip restart');
      return;
    }

    cleanupRecognizer('startHandsFreeListening — replace old recognizer');

    const Ctor = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as SpeechRecognitionCtor;
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    finalTranscriptRef.current = '';
    const session = ++listeningSessionRef.current;

    recognition.onstart = () => {
      if (session !== listeningSessionRef.current) return;
      if (startWatchdogRef.current) clearTimeout(startWatchdogRef.current);
      startWatchdogRef.current = null;
      setIsListening(true);
      isListeningRef.current = true;
      bob.setAvatarPaused(true);
      listeningWatchdogRef.current = setTimeout(() => resetListening(), 15000);
    };

    startWatchdogRef.current = setTimeout(() => resetListening(), 3000);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      stopHandsFree('30s silence');
    }, 30000);

    console.log('[HandsFree] start listening');

    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) {
        finalTranscriptRef.current += final;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
      const combined = (finalTranscriptRef.current + interim).trim();
      setInput(combined);
    };

    recognition.onerror = (e: any) => {
      console.log('[Voice] recognizer error:', e.error);
      setIsListening(false);
      isListeningRef.current = false;
      console.log('[HandsFree] recognizer error:', e?.error, 'intentionalStop:', intentionalStopRef.current);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture') {
        resetListening('Microphone unavailable — check Settings › General › Keyboard › Enable Dictation');
        stopHandsFree('mic unavailable');
      } else if (e?.error === 'aborted') {
        if (!intentionalStopRef.current) {
          unintendedAbortCountRef.current += 1;
          console.log('[HandsFree] unintended abort count:', unintendedAbortCountRef.current);
          if (unintendedAbortCountRef.current >= 3) {
            stopHandsFree('3 unintended aborts — mic unavailable');
            setError('Microphone unavailable — tap headphones to retry.');
            return;
          }
        }
      } else if (e?.error && e.error !== 'no-speech') {
        console.error('Speech recognition error:', e?.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      clearRecognitionWatchdogs();
      bob.setAvatarPaused(false);
      recognitionRef.current = null;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        console.log('[HandsFree] heard text:', finalText);
        if (isStopPhrase(finalText)) {
          stopHandsFree('stop phrase: ' + finalText);
          setInput('');
          return;
        }
        setInput(finalText);
        console.log('[HandsFree] sending');
        setTimeout(() => {
          if (finalText && sendWithTextRef.current) {
            sendWithTextRef.current(finalText);
          }
        }, 100);
      } else {
        if (intentionalStopRef.current) {
          console.log('[HandsFree] nothing heard, but stop was intentional — not restarting');
          return;
        }
        const delay = restartDelayRef.current;
        console.log('[HandsFree] nothing heard, restarting listener in', delay, 'ms');
        unintendedAbortCountRef.current += 1;
        if (unintendedAbortCountRef.current >= 3) {
          stopHandsFree('3 unintended aborts — mic unavailable');
          setError('Microphone unavailable — tap headphones to retry.');
          return;
        }
        restartDelayRef.current = Math.min(restartDelayRef.current * 2, 4000);
        if (handsFreeRef.current && !isSpeakingRef.current && !loadingRef.current) {
          setTimeout(() => {
            if (handsFreeRef.current && !intentionalStopRef.current && reListenRef.current) {
              reListenRef.current();
            }
          }, delay);
        }
      }
    };

    intentionalStopRef.current = false;
    recognitionRef.current = recognition;
    setInput('');
    setError('');
    setIsListening(true);
    isListeningRef.current = true;
    try {
      recognition.start();
    } catch {
      resetListening();
      console.log('[HandsFree] recognizer.start() threw, retry in 500ms');
      setTimeout(() => {
        if (!iosDevice && handsFreeRef.current && reListenRef.current) {
          reListenRef.current();
        }
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechSupported, iosDevice, stopHandsFree, cleanupRecognizer]);

  reListenRef.current = startHandsFreeListening;

  const toggleListening = () => {
    unlockAudio();
    if (handsFreeRef.current) {
      stopHandsFree();
      return;
    }
    if (isListeningRef.current) {
      stopListening();
      return;
    }
    if (isSpeakingRef.current) {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; }
      currentPlayerRef.current?.pause();
      currentPlayerRef.current = null;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      bob.setAvatarState('idle');
    }
    if (speechSupported && !useRecording) {
      startListening();
    } else {
      startRecording();
    }
  };

  const toggleHandsFree = () => {
    unlockAudio();
    if (handsFreeRef.current) {
      stopHandsFree();
      return;
    }

    if (iosDevice) {
      if (speechSupported) startListening();
      else startRecording();
      setHandsFreeMode(true);
      handsFreeRef.current = true;
      intentionalStopRef.current = false;
      if (!voiceOnRef.current) {
        setVoiceOn(true);
        voiceOnRef.current = true;
        try { localStorage.setItem('jarvis-voice', 'on'); } catch { /* noop */ }
      }
      return;
    }

    if (!voiceOnRef.current) {
      setVoiceOn(true);
      voiceOnRef.current = true;
      try { localStorage.setItem('jarvis-voice', 'on'); } catch { /* noop */ }
    }
    stopSharedAudio();
    setIsSpeaking(false);
    setHandsFreeMode(true);
    handsFreeRef.current = true;
    intentionalStopRef.current = false;
    unintendedAbortCountRef.current = 0;
    restartDelayRef.current = 300;
    console.log('[HandsFree] mode activated');
    speakReply("I'm listening.", false);
  };

  const handleIosTalk = () => {
    if (!iosDevice || !handsFreeRef.current || isListeningRef.current || loadingRef.current) return;
    if (isSpeakingRef.current) {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; }
      currentPlayerRef.current?.pause();
      currentPlayerRef.current = null;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      bob.setAvatarState('idle');
    }
    if (speechSupported) startListening();
    else startRecording();
  };

  const handleTapToHear = () => {
    console.log('[BobVoice] tap to hear pressed');
    if (!pendingUrlRef.current) {
      console.warn('[BobVoice] nothing to replay');
      return;
    }
    if (isIOSUA()) {
      const a = audioRef.current;
      if (!a) return;
      if (a.src !== pendingUrlRef.current) a.src = pendingUrlRef.current;
      a.muted = false;
      a.volume = 1;
      a.currentTime = 0;
      a.play().then(() => setNeedTapToHear(false)).catch((err: any) => {
        console.error('[BobVoice] tap play failed', err);
      });
    } else {
      const p = new Audio(pendingUrlRef.current);
      p.setAttribute('playsinline', '');
      currentPlayerRef.current = p;
      p.play().then(() => setNeedTapToHear(false)).catch((err: any) => {
        console.error('[BobVoice] tap play failed', err);
      });
    }
  };

  // ---- Sending ----
  const sendWithText = useCallback(async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || loading) return;
    setInput('');
    setError('');
    setLoading(true);
    bob.setAvatarState('thinking');

    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);

    try {
      const data = await callJarvis(supabaseUrl, {
        message: userMsg,
        conversationHistory: newMessages.slice(-11, -1).map(m => ({ role: m.role, content: m.content })),
        availableScreens: BOB_SCREENS.map(({ key, label, kind, description, fields }) => ({ key, label, kind, description, fields })),
        currentScreen: bob.currentRoute,
        activeForm: bob.activeForm,
      });

      const hasActions = (data.proposedActions?.length ?? 0) > 0;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        proposedActions: data.proposedActions || [],
        tasks: data.tasks || [],
      };
      setMessages([...newMessages, assistantMsg]);

      if (hasActions) loadPendingActions();
      if (data.tasks?.length > 0) loadTasks();

      console.log('[HandsFree] reply received, hasActions:', hasActions);

      if (hasActions && handsFreeRef.current) {
        stopHandsFree('pending action created');
      }

      const appActions: BobAppAction[] = data.appActions || [];
      if (appActions.length > 0) {
        console.log('[HandsFree] appActions received:', appActions.length);
        for (const action of appActions) {
          handleAppAction(action);
        }
      }

      speakReply(data.reply, hasActions);
      bob.setAvatarState('idle');

      if (handsFreeRef.current && !hasActions) {
        if (safetyNetTimerRef.current) clearTimeout(safetyNetTimerRef.current);
        safetyNetTimerRef.current = setTimeout(() => {
          if (!iosDevice && handsFreeRef.current && !isSpeakingRef.current && !loadingRef.current && reListenRef.current) {
            console.log('[HandsFree] safety net: no restart within 5s, forcing restart');
            reListenRef.current();
          }
        }, 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      bob.setAvatarState('idle');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, supabaseUrl, speakReply]);

  sendWithTextRef.current = sendWithText;

  const handleSend = () => {
    unlockAudio();
    const text = input.trim();
    if (!text || loading) return;
    sendWithText(text);
  };

  const handleNewChat = () => {
    intentionalStopRef.current = true;
    stopSharedAudio();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    stopListening();
    stopHandsFree();
    setMessages([]);
    setInput('');
    setError('');
  };

  const handleAppAction = (action: BobAppAction) => {
    if (action.type === 'open_video') {
      if (action.video_url && action.title) {
        console.log('[HandsFree] open_video:', action.title);
        bob.openVideo({ title: action.title, video_url: action.video_url });
      }
      return;
    }

    if (action.type === 'open_page') {
      const screen = action.key ? BOB_SCREEN_MAP[action.key] : null;
      if (screen) {
        let route = screen.route;
        if (action.record_id && route.includes(':id')) {
          route = route.replace(':id', action.record_id);
        }
        console.log('[HandsFree] open_page:', route);
        bob.navigate(route);
      }
      return;
    }

    if (action.type === 'open_form') {
      const screen = action.key ? BOB_SCREEN_MAP[action.key] : null;
      if (screen) {
        let route = screen.route;
        if (action.record_id && route.includes(':id')) {
          route = route.replace(':id', action.record_id);
        }
        console.log('[HandsFree] open_form:', route, 'prefill:', action.prefill);
        bob.navigate(route, action.prefill);
        if (action.key === 'inspection') {
          setTimeout(() => bob.triggerGuidedFill('trip-inspection'), 1500);
        }
      }
      return;
    }

    if (action.type === 'set_form_fields') {
      console.log('[HandsFree] set_form_fields:', action.values, 'next:', action.next_field, 'done:', action.done);
      if (action.values) {
        bob.setFormFields(action.values, action.next_field, action.done);
      }
      return;
    }
  };

  const loadPendingActions = useCallback(async () => {
    try {
      const data = await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'loadPending' });
      setPendingActions((data.data as PendingAction[]) || []);
    } catch (e: any) {
      console.error('Failed to load pending actions:', e);
    }
  }, [supabaseUrl]);

  const loadTasks = useCallback(async () => {
    try {
      const data = await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'loadTasks' });
      setTasks((data.data as JarvisTask[]) || []);
    } catch (e: any) {
      console.error('Failed to load tasks:', e);
    }
  }, [supabaseUrl]);

  const loadKnowledge = useCallback(async () => {
    try {
      const data = await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'loadKnowledge' });
      setKnowledge((data.data as KnowledgeEntry[]) || []);
    } catch (e: any) {
      console.error('Failed to load knowledge:', e);
    }
  }, [supabaseUrl]);

  useEffect(() => {
    loadPendingActions();
    loadTasks();
    loadKnowledge();
  }, [loadPendingActions, loadTasks, loadKnowledge]);

  // Handle guided fill trigger — auto-send a message to start the walk-through
  useEffect(() => {
    if (!bob.guidedFillTrigger) return;
    if (bob.guidedFillTrigger.key === 'trip-inspection') {
      console.log('[GuidedFill] trip-inspection triggered, starting hands-free');
      if (!handsFreeRef.current) {
        toggleHandsFree();
      }
      setTimeout(() => {
        if (sendWithTextRef.current) {
          sendWithTextRef.current('Help me fill out this trip inspection from the top.');
        }
      }, 800);
    }
    bob.clearGuidedFillTrigger();
  }, [bob.guidedFillTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (actionId: string) => {
    setActionLoading(prev => ({ ...prev, [actionId]: true }));
    try {
      await callApprove(supabaseUrl, actionId, 'approve');
      setPendingActions(prev => prev.filter(p => p.id !== actionId));
      setMessages(prev => prev.map(m => {
        if (m.proposedActions) {
          return { ...m, proposedActions: m.proposedActions.map(pa => pa.id === actionId ? { ...pa, status: 'approved' } : pa) };
        }
        return m;
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionId]: false }));
    }
  };

  const handleReject = async (actionId: string) => {
    setActionLoading(prev => ({ ...prev, [actionId]: true }));
    try {
      await callApprove(supabaseUrl, actionId, 'reject');
      setPendingActions(prev => prev.filter(p => p.id !== actionId));
      setMessages(prev => prev.map(m => {
        if (m.proposedActions) {
          return { ...m, proposedActions: m.proposedActions.map(pa => pa.id === actionId ? { ...pa, status: 'rejected' } : pa) };
        }
        return m;
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionId]: false }));
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'updateTask', taskId, taskStatus: status });
      loadTasks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'deleteKnowledge', knowledgeId: id });
      loadKnowledge();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleKnowledge = async (id: string, currentActive: boolean) => {
    try {
      await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'toggleKnowledge', knowledgeId: id, knowledgeActive: !currentActive });
      loadKnowledge();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const pendingBadge = pendingActions.length > 0 ? pendingActions.length : null;

  const avatarState = bob.avatarState;

  const subtitle = handsFreeMode
    ? isTranscribing ? 'Transcribing…' : isListening ? 'Hands-free listening…' : isSpeaking ? 'Bob is speaking…' : voiceLoading ? 'Generating voice…' : 'Hands-free conversation — tap headphones to stop'
    : isTranscribing ? 'Transcribing…' : isListening ? 'Listening…' : isSpeaking ? 'Speaking…' : voiceLoading ? 'Generating voice…' : 'Ask about your fleet, repairs, bookings, and operations';

  const tabButton = (tab: Tab, label: string, icon: React.ReactNode, badge?: number | null) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tab ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
      {badge ? <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{badge}</span> : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <BobAvatar size={72} state={avatarState} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Bob AI Assistant</h2>
            <button
              onClick={toggleVoice}
              title={voiceOn ? 'Voice on — click to mute' : 'Voice off — click to enable'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {isSpeaking ? (
                <Square className="w-4 h-4 text-red-400" />
              ) : voiceOn ? (
                <Volume2 className="w-4 h-4 text-amber-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {messages.length > 0 && activeTab === 'chat' && (
              <button
                onClick={handleNewChat}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                New chat
              </button>
            )}
          </div>
          <p className="text-slate-400 text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabButton('chat', 'Chat', <BobAvatar size={16} state={avatarState} borderClass="border border-amber-500/40" />)}
        {tabButton('pending', 'Pending Actions', <Clock className="w-4 h-4" />, pendingBadge)}
        {tabButton('tasks', 'Tasks', <ListTodo className="w-4 h-4" />)}
        {tabButton('knowledge', 'Knowledge Base', <BookOpen className="w-4 h-4" />)}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 py-12">
                <BobAvatar size={160} state={avatarState} className="mx-auto mb-4" />
                <p className="text-sm">Ask Bob anything about your fleet, repairs, bookings, or operations.</p>
                <p className="text-xs text-slate-600 mt-2">Try: "What repairs are pending?" or "Which yachts have upcoming trips?"</p>
                {voiceInputSupported && voiceOn && (
                  <p className="text-xs text-amber-500/60 mt-2">Tap the microphone to speak, the headphones for a hands-free conversation, or type your question.</p>
                )}
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-100'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="flex items-start gap-2">
                      {voiceOn && (
                        <button
                          onClick={() => replayMessage(msg.content, (msg.proposedActions?.length ?? 0) > 0)}
                          title="Replay"
                          className="flex-shrink-0 mt-0.5 text-slate-400 hover:text-amber-400 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="jarvis-markdown text-sm flex-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.proposedActions && msg.proposedActions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.proposedActions.map((pa, paIdx) => (
                        <div key={paIdx} className="bg-slate-900/50 border border-slate-600 rounded-xl p-3">
                          <p className="text-xs text-amber-400 font-semibold mb-1">PROPOSED ACTION</p>
                          <p className="text-sm text-white font-medium mb-1">{pa.summary}</p>
                          <p className="text-xs text-slate-400 mb-2">{pa.reason}</p>
                          <p className="text-xs text-slate-500 mb-2">Table: {pa.table_name} | Record: {pa.record_id?.substring(0, 8)}...</p>
                          <div className="text-xs text-slate-500 bg-slate-800/50 rounded p-2 mb-2">
                            <span className="text-slate-400">Changes:</span>
                            <pre className="mt-1 overflow-x-auto">{JSON.stringify(pa.changes, null, 2)}</pre>
                          </div>
                          {pa.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                                {actionLoading[pa.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Approve
                              </button>
                              <button onClick={() => handleReject(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                                {actionLoading[pa.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${pa.status === 'approved' ? 'bg-green-500/20 text-green-400' : pa.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600 text-slate-300'}`}>
                              {pa.status.charAt(0).toUpperCase() + pa.status.slice(1)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.tasks && msg.tasks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.tasks.map((task, tIdx) => (
                        <div key={tIdx} className="bg-slate-900/50 border border-slate-600 rounded-xl p-3">
                          <p className="text-xs text-blue-400 font-semibold mb-1">NEW TASK</p>
                          <p className="text-sm text-white font-medium">{task.title}</p>
                          {task.details && <p className="text-xs text-slate-400 mt-1">{task.details}</p>}
                          <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 capitalize">{task.priority} priority</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 rounded-2xl p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span className="text-sm text-slate-400">Bob is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {needTapToHear && (
            <button
              type="button"
              onClick={handleTapToHear}
              className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 text-sm transition-colors"
            >
              Tap to hear Bob
            </button>
          )}
          {iosDevice && handsFreeMode && !isListening && !loading && !isSpeaking && (
            <button
              type="button"
              onClick={handleIosTalk}
              className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 text-base animate-pulse shadow-lg shadow-amber-500/25 transition-colors"
            >
              Tap to talk
            </button>
          )}
          <div className="border-t border-slate-700 p-3 flex gap-2 items-center">
            {voiceInputSupported && (
              <button
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Start speaking'}
                className={`flex-shrink-0 p-2.5 rounded-xl transition-all ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            {voiceInputSupported && (
              <button
                onClick={toggleHandsFree}
                title={handsFreeMode ? 'Stop hands-free conversation' : 'Start hands-free conversation'}
                className={`flex-shrink-0 p-2.5 rounded-xl transition-all ${
                  handsFreeMode
                    ? `bg-amber-500 text-slate-900${isListening ? ' animate-pulse' : ''}`
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Headphones className="w-4 h-4" />
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isTranscribing ? 'Transcribing…' : isListening ? 'Listening…' : 'Ask Bob...'}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-medium rounded-xl transition-colors flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
          {pendingActions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No pending actions. Bob will propose changes here for your approval.</p>
          ) : (
            <div className="space-y-3">
              {pendingActions.map(pa => (
                <div key={pa.id} className="bg-slate-900/50 border border-slate-600 rounded-xl p-4">
                  <p className="text-sm text-white font-medium mb-1">{pa.summary}</p>
                  <p className="text-xs text-slate-400 mb-2">{pa.reason}</p>
                  <p className="text-xs text-slate-500 mb-2">Table: {pa.table_name} | Record: {pa.record_id?.substring(0, 8)}... | Created: {new Date(pa.created_at).toLocaleString()}</p>
                  <div className="text-xs text-slate-500 bg-slate-800/50 rounded p-2 mb-3">
                    <span className="text-slate-400">Changes:</span>
                    <pre className="mt-1 overflow-x-auto">{JSON.stringify(pa.changes, null, 2)}</pre>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                      {actionLoading[pa.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                    <button onClick={() => handleReject(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                      {actionLoading[pa.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
          {tasks.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No tasks yet. Bob can create tasks during conversations.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="bg-slate-900/50 border border-slate-600 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</p>
                    {task.details && <p className="text-xs text-slate-400 mt-1">{task.details}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : task.priority === 'normal' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>{task.priority}</span>
                      <span className="text-xs text-slate-500">{new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <select value={task.status} onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)} className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white focus:outline-none focus:border-amber-500">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'knowledge' && (
        <KnowledgeManager knowledge={knowledge} onLoad={loadKnowledge} onDelete={handleDeleteKnowledge} onToggle={handleToggleKnowledge} supabaseUrl={supabaseUrl} canEdit={canEditKnowledge} />
      )}
    </div>
  );
}

interface KnowledgeManagerProps {
  knowledge: KnowledgeEntry[];
  onLoad: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, currentActive: boolean) => void;
  supabaseUrl: string;
  canEdit: boolean;
}

function KnowledgeManager({ knowledge, onLoad, onDelete, onToggle, supabaseUrl, canEdit }: KnowledgeManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState({ category: 'general', title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditing(entry);
    setForm({ category: entry.category, title: entry.title, content: entry.content });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await callJarvis(supabaseUrl, {
        mode: 'data',
        dataAction: 'saveKnowledge',
        knowledgeData: { id: editing?.id, category: form.category, title: form.title, content: form.content },
      });
      setShowForm(false);
      setEditing(null);
      setForm({ category: 'general', title: '', content: '' });
      onLoad();
    } catch (e: any) {
      console.error('Failed to save knowledge:', e);
    } finally {
      setSaving(false);
    }
  };

  const categories = ['general', 'houseboats', 'service', 'billing', 'rescue'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">Manage what Bob knows about your business</p>
        {canEdit && (
          <button onClick={() => { setEditing(null); setForm({ category: 'general', title: '', content: '' }); setShowForm(true); }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium rounded-lg transition-colors">
            + Add Entry
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
              {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Content</label>
            <textarea value={form.content} onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))} rows={4} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 resize-y" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-sm font-medium rounded-lg transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {knowledge.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No knowledge entries yet. Add one to teach Bob about your business.</p>
        ) : (
          knowledge.map(entry => (
            <div key={entry.id} className={`bg-slate-800/50 border rounded-xl p-3 ${entry.active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300 capitalize">{entry.category}</span>
                    {!entry.active && <span className="text-xs text-slate-500">Inactive</span>}
                  </div>
                  <p className="text-sm text-white font-medium">{entry.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{entry.content.substring(0, 120)}{entry.content.length > 120 ? '...' : ''}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => handleEdit(entry)} className="text-slate-400 hover:text-amber-500 text-xs px-2 py-1">Edit</button>
                    <button onClick={() => onToggle(entry.id, entry.active)} className="text-slate-400 hover:text-blue-400 text-xs px-2 py-1">{entry.active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => onDelete(entry.id)} className="text-slate-400 hover:text-red-400 text-xs px-2 py-1">Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
