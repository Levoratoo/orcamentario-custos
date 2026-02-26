'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiAuth } from '@/lib/api/auth';
import { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  setAccessToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refresh = async () => {
    try {
      const refreshed = await apiAuth.refresh();
      setAccessToken(refreshed.accessToken);
      setUser(refreshed.user);
      return refreshed.accessToken;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  };

  const login = async (identifier: string, password: string) => {
    const result = await apiAuth.login(identifier, password);
    setAccessToken(result.accessToken);
    setUser(result.user);
    if (result.user?.role === 'COORDINATOR') {
      router.push('/planejamento');
      return;
    }
    router.push('/dashboard');
  };

  const logout = async () => {
    await apiAuth.logout();
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  };

  useEffect(() => {
    const init = async () => {
      await refresh();
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!isLoading && !user && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  const value = useMemo(
    () => ({ user, accessToken, isLoading, login, logout, refresh, setAccessToken }),
    [user, accessToken, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
