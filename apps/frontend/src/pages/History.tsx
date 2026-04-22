import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';

interface Entry {
  id: string;
  action: string;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

const pretty: Record<string, string> = {
  'client.create': '➕ Создан клиент',
  'client.extend': '⏭ Продление',
  'client.disable': '⏸ Отключение',
  'client.enable': '▶ Включение',
  'client.reset-traffic': '♻ Сброс трафика',
  'client.delete': '🗑 Удаление',
  'client.update': '✏ Изменение',
};

export function History() {
  const q = useQuery({
    queryKey: ['history'],
    queryFn: async () => (await api.get<{ items: Entry[] }>('/history', { params: { take: 100 } })).data,
  });

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">История</h1>
      {q.isLoading ? (
        <p className="text-tg-hint text-sm">Загрузка…</p>
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-2">
          {q.data.items.map((e) => (
            <Card key={e.id} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{pretty[e.action] ?? e.action}</div>
                  {e.payload && (
                    <div className="text-xs text-tg-hint break-all">
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
        <p className="text-tg-hint text-sm">Действий пока нет.</p>
      )}
    </div>
  );
}
