import { useState, useEffect } from 'react';
import { X, Headphones } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBob } from '../../contexts/BobContext';
import { isMasterRole } from '../../lib/supabase';
import JarvisChat from './JarvisChat';
import { BobAvatar } from './BobAvatar';

export function BobFloatingButton() {
  const { userProfile } = useAuth();
  const { panelOpen, openPanel, closePanel, avatarState } = useBob();

  if (!userProfile || !isMasterRole(userProfile.role)) return null;

  return (
    <>
      {!panelOpen && (
        <button
          onClick={openPanel}
          title="Ask Bob"
          className="fixed bottom-6 right-6 z-[150] w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all hover:scale-110 group"
        >
          <BobAvatar size={48} state={avatarState} borderClass="border-2 border-amber-500" />
          <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Ask Bob
          </span>
        </button>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-[180] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <BobAvatar size={40} state={avatarState} />
                <div>
                  <h2 className="text-lg font-bold text-white">Bob AI Assistant</h2>
                  <p className="text-xs text-slate-400">Tap outside to close</p>
                </div>
              </div>
              <button
                onClick={closePanel}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <JarvisChat
                userId={userProfile.user_id}
                supabaseUrl={import.meta.env.VITE_SUPABASE_URL}
                supabaseAnonKey={import.meta.env.VITE_SUPABASE_ANON_KEY}
                inPanel
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
