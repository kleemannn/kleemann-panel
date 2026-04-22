import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore, Me } from '@/store/auth';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  me: Me;
}

export function useTelegramLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async () => {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) throw new Error('Telegram WebApp не инициализирован. Откройте Mini App из Telegram.');
      const { data } = await api.post<LoginResponse>('/auth/telegram', { initData });
      setAuth(data);
      return data;
    },
  });
}
