import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/Button';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface AdminSummary {
  resellers: number;
  activeResellers: number;
  clients: number;
  activeClients: number;
}

interface ImportResult {
  imported: number;
  skippedNoTag: number;
  skippedExisting: number;
  skippedUnknownTag: number;
}

export function AdminDashboard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: async () => (await api.get<AdminSummary>('/stats/admin/summary')).data,
  });
  const s = q.data;

  const importMut = useMutation({
    mutationFn: async () => (await api.post<ImportResult>('/admin/resellers/import-clients')).data,
    onSuccess: (r) => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['admin', 'summary'] });
      const msg =
        `Импортировано: ${r.imported}\n` +
        `Уже было: ${r.skippedExisting}\n` +
        `Без тега: ${r.skippedNoTag}\n` +
        `Неизвестный тег: ${r.skippedUnknownTag}`;
      window.Telegram?.WebApp?.showAlert?.(msg) ?? alert(msg);
    },
    onError: () => tgHapticError(),
  });

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
        <Link to="/clients">
          <Button full variant="secondary">👥 Клиенты</Button>
        </Link>
        <Link to="/clients/new">
          <Button full>➕ Новый клиент</Button>
        </Link>
        <Link to="/admin/squads">
          <Button full variant="secondary">🧩 Squads</Button>
        </Link>
        <Link to="/admin/audit">
          <Button full variant="secondary">📋 Audit</Button>
        </Link>
        <Button
          full
          variant="secondary"
          onClick={() => importMut.mutate()}
          disabled={importMut.isPending}
        >
          {importMut.isPending ? '⏳ Импортируем…' : '⬇ Импорт из Remnawave'}
        </Button>
      </div>
    </div>
  );
}
