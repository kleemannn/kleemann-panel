import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Icon, IconName } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/format';

interface Entry {
  id: string;
  action: string;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

type Tone = 'accent' | 'success' | 'warn' | 'danger' | 'neutral';

const META: Record<string, { label: string; icon: IconName; tone: Tone }> = {
  'client.create': { label: 'Создан клиент', icon: 'plus', tone: 'accent' },
  'client.extend': { label: 'Продление', icon: 'calendar', tone: 'success' },
  'client.disable': { label: 'Отключение', icon: 'pause', tone: 'warn' },
  'client.enable': { label: 'Включение', icon: 'play', tone: 'success' },
  'client.reset-traffic': { label: 'Сброс трафика', icon: 'refresh', tone: 'neutral' },
  'client.delete': { label: 'Удаление', icon: 'trash', tone: 'danger' },
  'client.update': { label: 'Изменение', icon: 'edit', tone: 'neutral' },
};

const TONE_CLS: Record<Tone, string> = {
  accent: 'bg-tg-button/10 text-tg-button',
  success: 'bg-emerald-500/10 text-emerald-600',
  warn: 'bg-amber-500/10 text-amber-600',
  danger: 'bg-red-500/10 text-red-600',
  neutral: 'bg-tg-hint/10 text-tg-hint',
};

export function History() {
  const q = useQuery({
    queryKey: ['history'],
    queryFn: async () =>
      (await api.get<{ items: Entry[] }>('/history', { params: { take: 100 } })).data,
  });

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="История" subtitle="Журнал ваших действий" back={false} />
      {q.isLoading ? (
        <Card>
          <p className="text-sm text-tg-hint">Загрузка…</p>
        </Card>
      ) : q.data && q.data.items.length > 0 ? (
        <ul className="space-y-2">
          {q.data.items.map((e) => {
            const meta = META[e.action] ?? {
              label: e.action,
              icon: 'clipboard' as IconName,
              tone: 'neutral' as Tone,
            };
            return (
              <li key={e.id}>
                <Card className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONE_CLS[meta.tone]}`}
                  >
                    <Icon name={meta.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="shrink-0 text-xs text-tg-hint">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </div>
                    {e.payload && (
                      <div className="mt-1 break-all text-xs text-tg-hint">
                        {JSON.stringify(e.payload)}
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
            <Icon name="clock" />
          </span>
          <p className="text-sm text-tg-hint">Действий пока нет</p>
        </Card>
      )}
    </div>
  );
}
