"use client";

import type { AuthUser } from "@tuma/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY, USER_KEY } from "./api";

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: { phone: string; name: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore corrupt storage
    } finally {
      setReady(true);
    }
  }, []);

  const persist = useCallback((token: string, nextUser: AuthUser) => {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      const res = await api.login({ phone, password });
      persist(res.token, res.user);
    },
    [persist],
  );

  const register = useCallback(
    async (input: { phone: string; name: string; password: string }) => {
      const res = await api.register({ ...input, role: "rider" });
      persist(res.token, res.user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
