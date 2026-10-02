import React, { createContext, useContext, useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/src/lib/supabase';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSessionUser(sessionUser: any, role?: string): User {
  return {
    user_id: sessionUser.id,
    email: sessionUser.email ?? '',
    name: sessionUser.user_metadata?.full_name ?? sessionUser.email ?? '',
    picture: sessionUser.user_metadata?.avatar_url ?? undefined,
    role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the user's role from the profiles table (RLS allows own row)
  const fetchRole = async (userId: string): Promise<string | undefined> => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    return data?.role;
  };

  useEffect(() => {
    // Initial session restore
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        setUser(mapSessionUser(session.user, role));
      }
      setLoading(false);
    });

    // React to sign-in / sign-out / token refresh
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const role = await fetchRole(session.user.id);
          setUser(mapSessionUser(session.user, role));
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // Mobile deep link (cold start): parse access tokens from the OAuth redirect
    if (Platform.OS !== 'web') {
      Linking.getInitialURL().then((url) => {
        if (url) handleAuthUrl(url);
      });
      const subscription = Linking.addEventListener('url', (event) => {
        handleAuthUrl(event.url);
      });
      return () => {
        subscription.remove();
        authListener.subscription.unsubscribe();
      };
    }

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleAuthUrl = async (url: string) => {
    // Tokens arrive in the URL fragment: ...#access_token=...&refresh_token=...
    const fragment = url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) setError('Sign-in failed. Please try again.');
    }
  };

  const login = async () => {
    setError(null);
    try {
      const redirectTo = Platform.OS === 'web'
        ? window.location.origin
        : Linking.createURL('auth-callback');

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (oauthError || !data?.url) {
        setError('Could not start sign-in. Please try again.');
        return;
      }

      if (Platform.OS === 'web') {
        window.location.href = data.url;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          await handleAuthUrl(result.url);
        }
        // 'cancel' = user closed the sheet — stay on the login screen, no error
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Could not start sign-in. Please try again.');
    }
  };

  const logout = async () => {
    setError(null);
    await supabase.auth.signOut();
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
