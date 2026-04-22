import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';

interface Reseller {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  tag?: string | null;
  type: 'STANDARD' | 'PREMIUM';
  maxClients: number;
  clientsCount: number;
  expiresAt?: string | null;
  isActive: boolean;
}

export function Resellers() {
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'resellers', search],
    queryFn: async () =>
      (await api.get<{ items: Reseller[] }>('/admin/resellers', {
        params: { search: search || undefined, take: 200 },
      })).data,
  });

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Реселлеры</h1>
        <Link to="/admin/resellers/new">
          <Button variant="secondary">➕ Новый</Button>
        </Link>
      </div>

      <Input placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />

      {q.isLoading ? (
        <p className="text-tg-hint text-sm">Загрузка…</p>
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-2">
          {q.data.items.map((r) => (
            <Link key={r.id} to={`/admin/resellers/${r.id}`}>
              <Card className="text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>
                        {r.username ? `@${r.username}` : r.firstName ?? `tg:${r.telegramId}`}
                      </span>
                      {r.tag && (
                        <span className="text-[10px] font-mono rounded px-1.5 py-0.5 bg-tg-hint/15 text-tg-hint">
                          {r.tag}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-tg-hint">
                      {r.type} · {r.clientsCount}/{r.maxClients} клиентов · до{' '}
                      {formatDate(r.expiresAt ?? null)}
                    </div>
                  </div>
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${
                      r.isActive ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
                    }`}
                  >
                    {r.isActive ? 'active' : 'disabled'}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-tg-hint text-sm">Нет реселлеров.</p>
      )}
    </div>
  );
}
