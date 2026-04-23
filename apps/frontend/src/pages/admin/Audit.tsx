import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
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
    queryFn: async () =>
      (await api.get<{ items: Entry[] }>('/admin/audit', { params: { take: 200 } })).data,
  });

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Audit log" subtitle="Действия всех пользователей" back />
      {q.isLoading ? (
        <Card>
          <p className="text-sm text-tg-hint">Загрузка…</p>
        </Card>
      ) : q.data && q.data.items.length > 0 ? (
        <ul className="space-y-2">
          {q.data.items.map((e) => (
            <li key={e.id}>
              <Card className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
                  <Icon name="clipboard" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{e.action}</span>
                    <span className="shrink-0 text-xs text-tg-hint">
                      {formatDateTime(e.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-tg-hint">by {e.actor}</div>
                  {e.payload && (
                    <div className="mt-1 break-all text-xs text-tg-hint/80">
                      {JSON.stringify(e.payload)}
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
            <Icon name="clipboard" />
          </span>
          <p className="text-sm text-tg-hint">Пока пусто</p>
        </Card>
      )}
    </div>
  );
}
