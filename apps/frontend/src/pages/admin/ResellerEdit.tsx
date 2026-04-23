import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface Reseller {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  tag?: string | null;
  providerId?: string | null;
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
  const [tag, setTag] = useState('');
  const [providerId, setProviderId] = useState('');

  useEffect(() => {
    if (q.data) {
      setType(q.data.type);
      setMaxClients(String(q.data.maxClients));
      setExpiresAt(q.data.expiresAt ? q.data.expiresAt.slice(0, 10) : '');
      setIsActive(q.data.isActive);
      setTag(q.data.tag ?? '');
      setProviderId(q.data.providerId ?? '');
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/resellers/${id}`, {
        type,
        maxClients: Number(maxClients),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isActive,
        tag: tag || '',
        providerId: providerId.trim() || '',
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

  if (q.isLoading || !q.data) {
    return <div className="p-4 text-sm text-tg-hint">Загрузка…</div>;
  }

  const name = q.data.username ? `@${q.data.username}` : `tg:${q.data.telegramId}`;
  const pct =
    q.data.maxClients > 0
      ? Math.min(100, Math.round((q.data.clientsCount / q.data.maxClients) * 100))
      : 0;

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={name} subtitle={q.data.firstName ?? undefined} back />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
            Клиенты
          </span>
          <span className="text-xs font-medium tabular-nums">
            {q.data.clientsCount} / {q.data.maxClients}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-tg-button'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      <Select
        label="Тип"
        value={type}
        onChange={(e) => setType(e.target.value as 'STANDARD' | 'PREMIUM')}
      >
        <option value="STANDARD">STANDARD</option>
        <option value="PREMIUM">PREMIUM</option>
      </Select>
      <Input
        label="Максимум клиентов"
        type="number"
        min={0}
        value={maxClients}
        onChange={(e) => setMaxClients(e.target.value)}
      />
      <Input
        label="Tag"
        placeholder="KLEEMANN"
        hint="A-Z, 0-9, _ — до 16 символов, пусто = убрать"
        value={tag}
        onChange={(e) =>
          setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16))
        }
      />
      <Input
        label="Provider ID"
        placeholder="необязательно"
        hint="Идентификатор провайдера, задаёт админ. Пусто = убрать."
        value={providerId}
        onChange={(e) => setProviderId(e.target.value)}
      />
      <Input
        label="Действует до"
        hint="Пусто = бессрочно"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />

      <Card className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Активен</div>
          <div className="text-xs text-tg-hint">
            При выключении новые клиенты создаваться не будут
          </div>
        </div>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-5 w-5 accent-tg-button"
        />
      </Card>

      <Button full size="lg" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
        <Icon name="check" /> {saveMut.isPending ? 'Сохраняем…' : 'Сохранить'}
      </Button>

      <Button
        full
        variant="danger"
        size="lg"
        onClick={() => {
          const webApp = window.Telegram?.WebApp;
          if (webApp?.showConfirm) {
            webApp.showConfirm('Удалить реселлера?', (ok) => ok && delMut.mutate());
          } else if (window.confirm('Удалить реселлера?')) {
            delMut.mutate();
          }
        }}
      >
        <Icon name="trash" /> Удалить реселлера
      </Button>
    </div>
  );
}
