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

interface ProviderIdEntry {
  id: string;
  providerId: string;
  label?: string | null;
  clientsCount: number;
}

export function ResellerEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['admin', 'reseller', id],
    queryFn: async () => (await api.get<Reseller>(`/admin/resellers/${id}`)).data,
  });

  const poolQ = useQuery({
    queryKey: ['admin', 'reseller', id, 'provider-ids'],
    queryFn: async () =>
      (await api.get<ProviderIdEntry[]>(`/admin/resellers/${id}/provider-ids`)).data,
  });

  const [type, setType] = useState<'STANDARD' | 'PREMIUM'>('STANDARD');
  const [maxClients, setMaxClients] = useState('50');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [tag, setTag] = useState('');
  const [newProviderId, setNewProviderId] = useState('');

  useEffect(() => {
    if (q.data) {
      setType(q.data.type);
      setMaxClients(String(q.data.maxClients));
      setExpiresAt(q.data.expiresAt ? q.data.expiresAt.slice(0, 10) : '');
      setIsActive(q.data.isActive);
      setTag(q.data.tag ?? '');
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
      });
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'reseller', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'resellers'] });
    },
    onError: () => tgHapticError(),
  });

  const addPidMut = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/resellers/${id}/provider-ids`, {
        providerId: newProviderId.trim(),
      });
    },
    onSuccess: () => {
      tgHapticSuccess();
      setNewProviderId('');
      qc.invalidateQueries({ queryKey: ['admin', 'reseller', id, 'provider-ids'] });
    },
    onError: () => tgHapticError(),
  });

  const removePidMut = useMutation({
    mutationFn: async (entryId: string) => {
      await api.delete(`/admin/resellers/${id}/provider-ids/${entryId}`);
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'reseller', id, 'provider-ids'] });
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

  const pool = poolQ.data ?? [];
  const totalCapacity = pool.length * 20;
  const totalUsed = pool.reduce((s, e) => s + e.clientsCount, 0);

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

      {/* Provider ID Pool */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
            Provider ID&apos;ы
          </h2>
          {pool.length > 0 && (
            <span className="text-xs font-medium tabular-nums text-tg-hint">
              {totalUsed} / {totalCapacity} клиентов
            </span>
          )}
        </div>

        {pool.length === 0 && (
          <p className="text-xs text-tg-hint">
            Нет Provider ID. Добавьте — клиенты будут распределяться автоматически (до 20 на каждый).
          </p>
        )}

        {pool.map((entry) => {
          const full = entry.clientsCount >= 20;
          return (
            <Card key={entry.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium font-mono">{entry.providerId}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-tg-hint">
                  <span
                    className={`font-medium tabular-nums ${full ? 'text-red-500' : 'text-tg-text'}`}
                  >
                    {entry.clientsCount}/20
                  </span>
                  {full && <span className="text-red-500">заполнен</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const webApp = window.Telegram?.WebApp;
                  if (webApp?.showConfirm) {
                    webApp.showConfirm(
                      `Удалить Provider ID ${entry.providerId}?`,
                      (ok) => ok && removePidMut.mutate(entry.id),
                    );
                  } else if (window.confirm(`Удалить Provider ID ${entry.providerId}?`)) {
                    removePidMut.mutate(entry.id);
                  }
                }}
                className="shrink-0 rounded-full p-2 text-red-500 hover:bg-red-500/10"
              >
                <Icon name="trash" size={16} />
              </button>
            </Card>
          );
        })}

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Новый Provider ID"
              value={newProviderId}
              onChange={(e) => setNewProviderId(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            onClick={() => addPidMut.mutate()}
            disabled={addPidMut.isPending || !newProviderId.trim()}
            className="mt-1 shrink-0"
          >
            <Icon name="plus" size={16} />
          </Button>
        </div>
      </section>

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
