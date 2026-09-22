import { createContext, ReactNode, useContext, useState } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('erp_token'));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('erp_user');
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const login = async (email: string, password: string) => {
    const { token: t, user: u } = await authApi.login(email, password);
    localStorage.setItem('erp_token', t);
    localStorage.setItem('erp_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    authApi.logout().catch(() => undefined);
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
