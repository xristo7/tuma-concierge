"use client";

import type { AuthUser } from "@tuma/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY, USER_KEY } from "./api";

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: { phone?: string; email?: string; name: string; password: string }) => Promise<void>;
  logout: () => void;
  /** Patches the persisted user in place (e.g. after OTP verification succeeds) without a new token. */
  updateUser: (user: AuthUser) => void;
  /** Signs the browser in directly with an already-issued token (e.g. after a password reset). */
  setSession: (token: string, user: AuthUser) => void;
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
    async (identifier: string, password: string) => {
      const res = await api.login({ identifier, password });
      persist(res.token, res.user);
    },
    [persist],
  );

  const register = useCallback(
    async (input: { phone?: string; email?: string; name: string; password: string }) => {
      const res = await api.register({ ...input, role: "customer" });
      persist(res.token, res.user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => {
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateUser, setSession: persist }),
    [user, ready, login, register, logout, updateUser, persist],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
