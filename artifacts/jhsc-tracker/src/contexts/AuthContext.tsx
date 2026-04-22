import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "co-chair" | "member" | "worker-rep" | "management";
  permissions: string[];
  consentAcceptedAt: string | null;
  consentVersion: string | null;
  currentPolicyVersion: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      const data = r.ok ? await r.json() : null;
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const resp = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "Login failed");
    }
    const data = await resp.json();
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === "admin" || user.role === "co-chair") return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
