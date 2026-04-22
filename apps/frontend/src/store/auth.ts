import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'ADMIN' | 'RESELLER';
export type ResellerType = 'STANDARD' | 'PREMIUM';

export interface Me {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: Role;
  type: ResellerType;
  maxClients: number;
  clientsCount?: number;
  expiresAt?: string | null;
  isActive: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  me: Me | null;
  setAuth: (v: { accessToken: string; refreshToken: string; me: Me }) => void;
  setMe: (me: Me) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      me: null,
      setAuth: ({ accessToken, refreshToken, me }) => set({ accessToken, refreshToken, me }),
      setMe: (me) => set({ me }),
      clear: () => set({ accessToken: null, refreshToken: null, me: null }),
    }),
    { name: 'kleemann-auth' },
  ),
);
