'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Auth Context Provider
// Manages global user authentication state, token storage, and session checks.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@landed/shared-types';
import { getMe, login as apiLogin, register as apiRegister, clearToken, getToken } from './api-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: typeof apiLogin;
  register: typeof apiRegister;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await getMe();
      setUser(res.user);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogin: typeof apiLogin = async (email, password) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
    return res;
  };

  const handleRegister: typeof apiRegister = async (name, email, password) => {
    const res = await apiRegister(name, email, password);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login: handleLogin,
        register: handleRegister,
        logout,
        refetchUser: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
