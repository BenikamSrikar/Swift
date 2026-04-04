import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  providerToken: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  providerToken: null,
  signOut: async () => {},
});

const PROVIDER_TOKEN_KEY = 'swift_google_provider_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerToken, setProviderToken] = useState<string | null>(
    () => localStorage.getItem(PROVIDER_TOKEN_KEY)
  );

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .single();
    setProfile(data as Profile | null);
  };

  const updateProviderToken = (token: string | null | undefined) => {
    if (token) {
      localStorage.setItem(PROVIDER_TOKEN_KEY, token);
      setProviderToken(token);
    } else {
      // Keep existing token from localStorage if no new one provided
      const existing = localStorage.getItem(PROVIDER_TOKEN_KEY);
      if (!existing) setProviderToken(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      updateProviderToken(session?.provider_token);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      updateProviderToken(session?.provider_token);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(PROVIDER_TOKEN_KEY);
    setUser(null);
    setProfile(null);
    setProviderToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, providerToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
