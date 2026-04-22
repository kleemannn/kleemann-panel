import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/Button';

interface AdminSummary {
  resellers: number;
  activeResellers: number;
  clients: number;
  activeClients: number;
}

export function AdminDashboard() {
  const q = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: async () => (await api.get<AdminSummary>('/stats/admin/summary')).data,
  });
  const s = q.data;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Админ</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Реселлеров" value={s?.resellers ?? '—'} hint={`активных ${s?.activeResellers ?? '—'}`} />
        <StatCard label="Клиентов" value={s?.clients ?? '—'} hint={`активных ${s?.activeClients ?? '—'}`} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/admin/resellers">
          <Button full variant="secondary">🛒 Реселлеры</Button>
        </Link>
        <Link to="/admin/resellers/new">
          <Button full>➕ Новый реселлер</Button>
        </Link>
        <Link to="/admin/squads">
          <Button full variant="secondary">🧩 Squads</Button>
        </Link>
        <Link to="/admin/audit">
          <Button full variant="secondary">📋 Audit</Button>
        </Link>
      </div>
    </div>
  );
}
