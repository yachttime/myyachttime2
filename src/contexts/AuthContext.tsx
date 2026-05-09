import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, Yacht } from '../lib/supabase';

interface SignUpProfile {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  yacht_id: string | null;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  yacht: Yacht | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: 'owner' | 'manager' | 'staff', profile: SignUpProfile) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isTokenExpired: () => boolean;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const detectRecoveryFromUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return hash.includes('type=recovery') || search.includes('type=recovery');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [yacht, setYacht] = useState<Yacht | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(detectRecoveryFromUrl);
  const isPasswordRecoveryRef = useRef(detectRecoveryFromUrl());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserProfile(null);
          setYacht(null);
          isPasswordRecoveryRef.current = false;
          setIsPasswordRecovery(false);
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
          return;
        }

        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          isPasswordRecoveryRef.current = true;
          setIsPasswordRecovery(true);
          await supabase
            .from('user_profiles')
            .update({ must_change_password: true })
            .eq('user_id', session.user.id);
          setUser(session.user);
          await loadUserProfile(session.user.id);
          return;
        }

        if (event === 'SIGNED_IN') {
          if (isPasswordRecoveryRef.current) {
            setUser(session?.user ?? null);
            if (session?.user) {
              await loadUserProfile(session.user.id);
            } else {
              setLoading(false);
            }
            return;
          }
          setUser(session?.user ?? null);
          if (session?.user) {
            await loadUserProfile(session.user.id);
          } else {
            setUserProfile(null);
            setYacht(null);
            setLoading(false);
          }
          return;
        }

        if (event === 'USER_UPDATED') {
          setUser(session?.user ?? null);
          if (session?.user) {
            await loadUserProfile(session.user.id);
          } else {
            setUserProfile(null);
            setYacht(null);
            setLoading(false);
          }
        }

        if (event === 'INITIAL_SESSION') {
          if (isPasswordRecoveryRef.current) return;
          setUser(session?.user ?? null);
          if (session?.user) {
            await loadUserProfile(session.user.id);
          } else {
            setLoading(false);
          }
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string, attempt = 1) => {
    const MAX_ATTEMPTS = 4;
    const RETRY_DELAY_MS = 2000;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Profile load error:', profileError);
        throw profileError;
      }

      setUserProfile(profile);

      if (profile?.yacht_id) {
        const { data: yachtData, error: yachtError } = await supabase
          .from('yachts')
          .select('*')
          .eq('id', profile.yacht_id)
          .maybeSingle();

        if (yachtError) throw yachtError;
        setYacht(yachtData);
      } else {
        setYacht(null);
      }

      setLoading(false);
    } catch (error: any) {
      const isTimeout = error?.message?.includes('timeout') ||
        error?.message?.includes('upstream') ||
        error?.code === '57014';

      if (isTimeout && attempt < MAX_ATTEMPTS) {
        console.warn(`Profile load timed out, retrying (${attempt}/${MAX_ATTEMPTS - 1})...`);
        setTimeout(() => loadUserProfile(userId, attempt + 1), RETRY_DELAY_MS);
        // Keep loading=true so the app stays on the loading screen during retry
      } else {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
        setYacht(null);
        setLoading(false);
      }
    }
  };

  const signUp = async (email: string, password: string, role: 'owner' | 'manager' | 'staff', profile: SignUpProfile) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      await supabase.from('user_profiles').insert({
        user_id: data.user.id,
        role: role,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        email: profile.email,
        street: profile.street,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
        yacht_id: profile.yacht_id,
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      localStorage.removeItem('activeTab');
      localStorage.removeItem('adminView');
    } catch {}

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      supabase
        .from('user_profiles')
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq('user_id', data.user.id)
        .then(({ error }) => {
          if (error) console.error('Error updating sign in time:', error);
        });
    }
  };

  const signOut = async () => {
    // Always clear local state and auth session first — DB update must never block logout
    setUser(null);
    setUserProfile(null);
    setYacht(null);

    try {
      localStorage.removeItem('activeTab');
      localStorage.removeItem('adminView');
    } catch {}

    // Fire-and-forget: record sign-out time without blocking
    if (user) {
      supabase
        .from('user_profiles')
        .update({ last_sign_out_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('Error updating sign out time:', error);
        });
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!' && !error.message.includes('session_id claim')) {
        console.error('Sign out error:', error);
      }
    } catch (error: any) {
      if (error?.message !== 'Auth session missing!' && !error?.message?.includes('session_id claim')) {
        console.error('Sign out error:', error);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  const isTokenExpired = () => {
    if (!user) return true;

    const expiresAt = user.exp;
    if (!expiresAt) return false;

    const now = Math.floor(Date.now() / 1000);
    return now >= expiresAt;
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    isPasswordRecoveryRef.current = false;
    setIsPasswordRecovery(false);

    if (user) {
      await supabase
        .from('user_profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);

      await refreshProfile();
    }
  };

  const value = {
    user,
    userProfile,
    yacht,
    loading,
    isPasswordRecovery,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    isTokenExpired,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
