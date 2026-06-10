import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface LifecycleConfig {
  retentionDays: number;
}

const DEFAULT_RETENTION_DAYS = 7;

/**
 * Auto-deletion retention from `CLIENT_AUTO_DELETE_DAYS`. Endpoint is
 * admin-only, so for resellers we just fall back to the default of 7 days
 * — the value drives a cosmetic countdown ("удалится через N дн") on
 * expired clients, not enforcement.
 */
export function useRetentionDays(): number {
  const isAdmin = useAuthStore((s) => s.me?.role) === 'ADMIN';
  const q = useQuery({
    queryKey: ['admin', 'lifecycle', 'config'],
    queryFn: async () => (await api.get<LifecycleConfig>('/admin/lifecycle/config')).data,
    enabled: isAdmin,
    staleTime: 60_000,
  });
  return q.data?.retentionDays ?? DEFAULT_RETENTION_DAYS;
}
