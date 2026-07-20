import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, Yacht } from '../lib/supabase';
import { withRetry, isRetryableError } from '../utils/retry';

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
          try { localStorage.removeItem('impersonatedRole'); } catch {}
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

  const loadUserProfile = async (userId: string) => {
    try {
      await withRetry(async () => {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile?.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          setUserProfile(null);
          setYacht(null);
          setLoading(false);
          throw new Error('Your account has been deactivated. Please contact the marina for assistance.');
        }

        setUserProfile(profile);

        if (profile?.yacht_id) {
          const { data: yachtData, error: yachtError } = await supabase
            .from('yachts')
            .select('*')
            .eq('id', profile.yacht_id)
            .maybeSingle();

          if (yachtError) throw yachtError;

          if (yachtData && yachtData.is_active === false && (profile.role === 'owner' || profile.role === 'manager')) {
            await supabase.auth.signOut();
            setUser(null);
            setUserProfile(null);
            setYacht(null);
            setLoading(false);
            throw new Error('Your vessel account is currently inactive. Please contact the marina for assistance.');
          }

          setYacht(yachtData);
        } else {
          setYacht(null);
        }

        setLoading(false);
      }, {
        maxAttempts: 5,
        baseDelayMs: 1000,
        capMs: 12000,
        jitterMs: 500,
        onRetry: (attempt, delay, error) => console.warn(`Profile load attempt ${attempt} failed, retrying in ${delay}ms...`, error?.message),
      });
    } catch (error: any) {
      if (!isRetryableError(error)) console.error('Error loading user profile:', error);
      setUserProfile(null);
      setYacht(null);
      setLoading(false);
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
      localStorage.removeItem('impersonatedRole');
    } catch {}

    const MAX_ATTEMPTS = 4;
    const BASE_TIMEOUT_MS = 20000;

    try {
      await withRetry(async (attempt) => {
        const timeoutMs = BASE_TIMEOUT_MS + (attempt - 1) * 5000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('upstream request timeout')), timeoutMs)
        );

        const { data, error } = await Promise.race([
          supabase.auth.signInWithPassword({ email, password }),
          timeoutPromise,
        ]);

        if (error) throw error;

        if (data.user) {
          supabase
            .from('user_profiles')
            .update({ last_sign_in_at: new Date().toISOString() })
            .eq('user_id', data.user.id)
            .then(({ error }) => {
              if (error && !error.message?.includes('upstream') && error.code !== '57014') console.error('Error updating sign in time:', error);
            });
        }
      }, {
        maxAttempts: MAX_ATTEMPTS,
        baseDelayMs: 1500,
        capMs: 15000,
        jitterMs: 600,
        onRetry: (attempt, delay, err) => console.warn(`Sign in attempt ${attempt} failed, retrying in ${delay}ms...`, err?.message),
      });
    } catch (error: any) {
      throw error;
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
      localStorage.removeItem('impersonatedRole');
    } catch {}

    // Fire-and-forget: record sign-out time without blocking
    if (user) {
      supabase
        .from('user_profiles')
        .update({ last_sign_out_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error && !error.message?.includes('upstream') && error.code !== '57014') console.error('Error updating sign out time:', error);
        });
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!' && !error.message.includes('session_id claim') && !error.message.includes('upstream') && !error.message.includes('fetch')) {
        console.error('Sign out error:', error);
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg !== 'Auth session missing!' && !msg.includes('session_id claim') && !msg.includes('upstream') && !msg.includes('fetch') && !msg.includes('504') && !msg.includes('{}')) {
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

    if (user) {
      await supabase
        .from('user_profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);
    }

    isPasswordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    await supabase.auth.signOut();
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
