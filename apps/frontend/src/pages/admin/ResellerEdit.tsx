import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface Reseller {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  type: 'STANDARD' | 'PREMIUM';
  maxClients: number;
  clientsCount: number;
  expiresAt?: string | null;
  isActive: boolean;
}

export function ResellerEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['admin', 'reseller', id],
    queryFn: async () => (await api.get<Reseller>(`/admin/resellers/${id}`)).data,
  });

  const [type, setType] = useState<'STANDARD' | 'PREMIUM'>('STANDARD');
  const [maxClients, setMaxClients] = useState('50');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (q.data) {
      setType(q.data.type);
      setMaxClients(String(q.data.maxClients));
      setExpiresAt(q.data.expiresAt ? q.data.expiresAt.slice(0, 10) : '');
      setIsActive(q.data.isActive);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/resellers/${id}`, {
        type,
        maxClients: Number(maxClients),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isActive,
      });
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'reseller', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'resellers'] });
    },
    onError: () => tgHapticError(),
  });

  const delMut = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/resellers/${id}`);
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'resellers'] });
      navigate('/admin/resellers');
    },
    onError: () => tgHapticError(),
  });

  if (q.isLoading || !q.data) return <div className="p-4 text-tg-hint text-sm">Загрузка…</div>;

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">
        {q.data.username ? `@${q.data.username}` : `tg:${q.data.telegramId}`}
      </h1>
      <Card className="text-sm text-tg-hint">
        Клиентов: {q.data.clientsCount} / {q.data.maxClients}
      </Card>

      <Select label="Тип" value={type} onChange={(e) => setType(e.target.value as any)}>
        <option value="STANDARD">STANDARD</option>
        <option value="PREMIUM">PREMIUM</option>
      </Select>
      <Input
        label="Макс. клиентов"
        type="number"
        min={0}
        value={maxClients}
        onChange={(e) => setMaxClients(e.target.value)}
      />
      <Input
        label="Дата окончания (пусто = бессрочно)"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span className="text-sm">Активен</span>
      </label>

      <Button full onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
        {saveMut.isPending ? 'Сохраняем…' : 'Сохранить'}
      </Button>

      <Button
        full
        variant="danger"
        onClick={() =>
          window.Telegram?.WebApp?.showConfirm?.('Удалить реселлера?', (ok) => ok && delMut.mutate()) ??
          (confirm('Удалить реселлера?') && delMut.mutate())
        }
      >
        Удалить реселлера
      </Button>
    </div>
  );
}
