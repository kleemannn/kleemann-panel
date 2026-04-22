import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';

interface Entry {
  id: string;
  actor: string;
  resellerId?: string | null;
  action: string;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export function Audit() {
  const q = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () => (await api.get<{ items: Entry[] }>('/admin/audit', { params: { take: 200 } })).data,
  });

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Audit log</h1>
      {q.isLoading ? (
        <p className="text-tg-hint text-sm">Загрузка…</p>
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-2">
          {q.data.items.map((e) => (
            <Card key={e.id} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{e.action}</div>
                  <div className="text-xs text-tg-hint">by {e.actor}</div>
                  {e.payload && (
                    <div className="mt-1 text-xs text-tg-hint break-all">
                      {JSON.stringify(e.payload)}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-xs text-tg-hint">{formatDateTime(e.createdAt)}</div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-tg-hint text-sm">Пока пусто.</p>
      )}
    </div>
  );
}
