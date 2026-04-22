import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ClientRow, ClientRowModel } from '@/components/ClientRow';

type Status = '' | 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'LIMITED';

export function Clients() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('');

  const q = useQuery({
    queryKey: ['clients', { search, status }],
    queryFn: async () => (await api.get<{ items: ClientRowModel[]; total: number }>('/clients', {
      params: { search: search || undefined, status: status || undefined, take: 100 },
    })).data,
  });

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Клиенты</h1>
        <Link to="/clients/new">
          <Button variant="secondary">➕ Новый</Button>
        </Link>
      </div>

      <Input
        placeholder="Поиск по username / заметке"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['', 'ACTIVE', 'EXPIRED', 'DISABLED'] as Status[]).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
              status === s ? 'bg-tg-button text-tg-buttonText' : 'bg-tg-secondary text-tg-hint'
            }`}
          >
            {s || 'Все'}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-tg-hint text-sm">Загрузка…</p>
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-2">
          {q.data.items.map((c) => <ClientRow key={c.id} c={c} />)}
        </div>
      ) : (
        <p className="text-tg-hint text-sm">Ничего не найдено.</p>
      )}
    </div>
  );
}
