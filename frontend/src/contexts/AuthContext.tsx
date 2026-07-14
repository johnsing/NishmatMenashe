import React, { createContext, useContext, useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    checkExistingSession();
    
    // Web: Check for session_id in URL on mount
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      const search = window.location.search;
      
      let sessionId = null;
      if (hash.includes('session_id=')) {
        sessionId = hash.split('session_id=')[1]?.split('&')[0];
      } else if (search.includes('session_id=')) {
        sessionId = new URLSearchParams(search).get('session_id');
      }
      
      if (sessionId) {
        processSessionId(sessionId);
        // Clean URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    
    // Mobile: Handle deep links
    if (Platform.OS !== 'web') {
      // Check initial URL (cold start)
      Linking.getInitialURL().then((url) => {
        if (url) handleDeepLink(url);
      });
      
      // Listen for hot links
      const subscription = Linking.addEventListener('url', (event) => {
        handleDeepLink(event.url);
      });
      
      return () => subscription.remove();
    }
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await storage.secureGet('session_token', null);
      
      if (token) {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Invalid token, clear it
          await storage.secureRemove('session_token');
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeepLink = (url: string) => {
    const parsed = Linking.parse(url);
    const sessionId = parsed.queryParams?.session_id as string;
    
    if (sessionId) {
      processSessionId(sessionId);
    }
  };

  const processSessionId = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_token: sessionId })
      });
      
      if (response.ok) {
        const data = await response.json();
        await storage.secureSet('session_token', data.session_token);
        setUser({
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          picture: data.picture
        });
      }
    } catch (error) {
      console.error('Error processing session:', error);
    }
  };

  const login = async () => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? window.location.origin + '/'
        : Linking.createURL('');
      
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);
          const sessionId = parsed.queryParams?.session_id as string;
          
          if (sessionId) {
            await processSessionId(sessionId);
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      const token = await storage.secureGet('session_token', null);
      
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      await storage.secureRemove('session_token');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
