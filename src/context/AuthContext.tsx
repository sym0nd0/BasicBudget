import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../api/client';
import type { User, Household, HouseholdRole, AuthStatusResponse } from '../types';

interface AuthContextValue {
  user: User | null;
  household: Household | null;
  householdRole: HouseholdRole | undefined;
  loading: boolean;
  totpPending: boolean;
  login: (email: string, password: string) => Promise<{ totp_required?: boolean }>;
  logout: () => Promise<void>;
  register: (email: string, password: string, display_name?: string, invite_token?: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdRole, setHouseholdRole] = useState<HouseholdRole | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [totpPending, setTotpPending] = useState(false);

  const applyStatus = useCallback((status: AuthStatusResponse) => {
    setUser(status.user ?? null);
    setHousehold(status.household ?? null);
    setHouseholdRole(status.householdRole);
    setTotpPending(status.totpPending);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      applyStatus(status);
    } catch {
      setUser(null);
      setHousehold(null);
      setHouseholdRole(undefined);
      setTotpPending(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    setLoading(true);
    refreshAuth().finally(() => setLoading(false));
  }, [refreshAuth]);

  // Apply colour blindness palette class to <html>
  useEffect(() => {
    const root = document.documentElement;
    const palettes = ['palette-deuteranopia', 'palette-protanopia', 'palette-tritanopia'];
    palettes.forEach(p => root.classList.remove(p));
    const palette = user?.colour_palette;
    if (palette && palette !== 'default') {
      root.classList.add(`palette-${palette}`);
    }
  }, [user?.colour_palette]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    if (!result.totp_required) {
      await refreshAuth();
    } else {
      setTotpPending(true);
    }
    return result;
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setHousehold(null);
    setHouseholdRole(undefined);
    setTotpPending(false);
    const palettes = ['palette-deuteranopia', 'palette-protanopia', 'palette-tritanopia'];
    palettes.forEach(p => document.documentElement.classList.remove(p));
  }, []);

  const register = useCallback(async (email: string, password: string, display_name?: string, invite_token?: string) => {
    await api.register(email, password, display_name, invite_token);
  }, []);

  return (
    <AuthContext.Provider value={{ user, household, householdRole, loading, totpPending, login, logout, register, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
