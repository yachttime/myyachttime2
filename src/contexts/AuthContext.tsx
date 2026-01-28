import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [yacht, setYacht] = useState<Yacht | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPasswordRecovery = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (accessToken && type === 'recovery') {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          await supabase
            .from('user_profiles')
            .update({ must_change_password: true })
            .eq('user_id', session.user.id);

          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    checkPasswordRecovery().then(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          setUserProfile(null);
          setYacht(null);
        }

        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          await supabase
            .from('user_profiles')
            .update({ must_change_password: true })
            .eq('user_id', session.user.id);
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setUserProfile(null);
          setYacht(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
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
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
      setYacht(null);
    } finally {
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      await supabase
        .from('user_profiles')
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq('user_id', data.user.id);
    }
  };

  const signOut = async () => {
    if (user) {
      try {
        await supabase
          .from('user_profiles')
          .update({ last_sign_out_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error updating sign out time:', error);
      }
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!' && !error.message.includes('session_id claim')) {
        throw error;
      }
    } catch (error: any) {
      if (error?.message !== 'Auth session missing!' && !error?.message?.includes('session_id claim')) {
        throw error;
      }
    }

    setUser(null);
    setUserProfile(null);
    setYacht(null);
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

      await refreshProfile();
    }
  };

  const value = {
    user,
    userProfile,
    yacht,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    isTokenExpired,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
