import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { activityPing, clearTokens, me, setTokens } from './api';

export type AuthUser = {
  id: number;
  email: string;
  role: string;
  email_verified: boolean;
  onboarding_completed: boolean;
  is_admin: boolean;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  setAuthFromTokens: (tokens: { access: string; refresh?: string }) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function bootstrap() {
    try {
      const u = await me();
      try {
        await activityPing();
      } catch {
        // сеть / 401 — не блокируем сессию
      }
      setUser({
        id: u.id,
        email: u.email,
        role: u.role,
        email_verified: u.email_verified,
        onboarding_completed: Boolean(u.onboarding_completed),
        is_admin: Boolean(u.is_admin),
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!user) return;
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      void activityPing().catch(() => {});
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user?.id]);

  async function setAuthFromTokens(tokens: { access: string; refresh?: string }) {
    setTokens(tokens);
    const u = await me();
    try {
      await activityPing();
    } catch {
      // ignore
    }
    setUser({
      id: u.id,
      email: u.email,
      role: u.role,
      email_verified: u.email_verified,
      onboarding_completed: Boolean(u.onboarding_completed),
      is_admin: Boolean(u.is_admin),
    });
  }

  async function refresh() {
    const u = await me();
    setUser({
      id: u.id,
      email: u.email,
      role: u.role,
      email_verified: u.email_verified,
      onboarding_completed: Boolean(u.onboarding_completed),
      is_admin: Boolean(u.is_admin),
    });
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, setAuthFromTokens, refresh, logout }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

