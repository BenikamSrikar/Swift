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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, userMeta?: { email?: string; full_name?: string; avatar_url?: string }) => {
    // Try to fetch existing profile first
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .single();

    if (existing) {
      setProfile(existing as Profile);
      return;
    }

    // Profile row doesn't exist yet (new user or data was wiped) — create it
    if (userMeta) {
      const { data: upserted } = await supabase
        .from('profiles')
        .upsert({
          auth_user_id: userId,
          email: userMeta.email ?? '',
          name: userMeta.full_name ?? userMeta.email ?? 'User',
          avatar_url: userMeta.avatar_url ?? null,
        }, { onConflict: 'auth_user_id' })
        .select()
        .single();
      setProfile(upserted as Profile | null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const meta = session.user.user_metadata as { email?: string; full_name?: string; avatar_url?: string };
        setTimeout(() => fetchProfile(session.user.id, meta), 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const meta = session.user.user_metadata as { email?: string; full_name?: string; avatar_url?: string };
        fetchProfile(session.user.id, meta);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
