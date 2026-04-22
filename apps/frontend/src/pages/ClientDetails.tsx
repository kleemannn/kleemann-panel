import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDate, formatGb, daysUntil } from '@/lib/format';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface Client {
  id: string;
  username: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'LIMITED';
  expiresAt?: string | null;
  trafficLimitGb?: number | null;
  note?: string | null;
  subscriptionUrl?: string | null;
}

interface HwidDevice {
  hwid: string;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ClientDetails() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ['client', id],
    queryFn: async () => (await api.get<Client>(`/clients/${id}`)).data,
  });

  const sub = useQuery({
    queryKey: ['client', id, 'subscription'],
    queryFn: async () =>
      (await api.get<{ subscriptionUrl: string | null }>(`/clients/${id}/subscription`)).data,
    enabled: !!q.data,
  });

  const devices = useQuery({
    queryKey: ['client', id, 'devices'],
    queryFn: async () =>
      (await api.get<{ total: number; devices: HwidDevice[] }>(`/clients/${id}/devices`)).data,
    enabled: !!q.data,
  });

  const deleteDevice = useMutation({
    mutationFn: async (hwid: string) => {
      await api.delete(`/clients/${id}/devices/${encodeURIComponent(hwid)}`);
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['client', id, 'devices'] });
    },
    onError: () => tgHapticError(),
  });

  const act = (path: string, method: 'post' | 'delete' = 'post') =>
    useMutation({
      mutationFn: async () => {
        if (method === 'post') await api.post(`/clients/${id}/${path}`);
        else await api.delete(`/clients/${id}`);
      },
      onSuccess: () => {
        tgHapticSuccess();
        qc.invalidateQueries({ queryKey: ['client', id] });
        qc.invalidateQueries({ queryKey: ['clients'] });
      },
      onError: () => tgHapticError(),
    });

  const disable = act('disable');
  const enable = act('enable');
  const reset = act('reset-traffic');
  const del = useMutation({
    mutationFn: async () => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['clients'] });
      navigate('/clients');
    },
    onError: () => tgHapticError(),
  });

  const c = q.data;
  if (q.isLoading || !c) return <div className="p-4 text-tg-hint text-sm">Загрузка…</div>;

  const d = daysUntil(c.expiresAt ?? null);

  const copy = async () => {
    if (!sub.data?.subscriptionUrl) return;
    try {
      await navigator.clipboard.writeText(sub.data.subscriptionUrl);
      tgHapticSuccess();
      window.Telegram?.WebApp?.showAlert?.('Ссылка скопирована');
    } catch {
      window.Telegram?.WebApp?.openLink?.(sub.data.subscriptionUrl);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-xl font-semibold">{c.username}</h1>
        <p className="text-sm text-tg-hint">
          {c.status} · до {formatDate(c.expiresAt)}
          {d !== null ? (d < 0 ? ` (${-d}д назад)` : ` (через ${d}д)`) : ''}
        </p>
      </header>

      <Card className="space-y-1 text-sm">
        <Row k="Трафик" v={formatGb(c.trafficLimitGb ?? null)} />
        <Row k="Заметка" v={c.note || '—'} />
        <Row k="Subscription" v={
          sub.data?.subscriptionUrl ? (
            <button className="text-tg-link break-all text-left" onClick={copy}>
              {sub.data.subscriptionUrl}
            </button>
          ) : '—'
        } />
      </Card>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Устройства {devices.data ? `(${devices.data.total})` : ''}
          </h2>
        </div>
        {devices.isLoading ? (
          <p className="text-tg-hint text-sm">Загрузка…</p>
        ) : !devices.data || devices.data.devices.length === 0 ? (
          <p className="text-tg-hint text-sm">Нет подключённых устройств</p>
        ) : (
          <ul className="space-y-2">
            {devices.data.devices.map((dev) => (
              <li key={dev.hwid}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {dev.deviceModel || dev.platform || 'Устройство'}
                    </p>
                    <p className="text-xs text-tg-hint truncate">
                      {[dev.platform, dev.osVersion].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p className="text-xs text-tg-hint font-mono truncate">{dev.hwid}</p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() =>
                      window.Telegram?.WebApp?.showConfirm?.(
                        'Отвязать устройство?',
                        (ok) => ok && deleteDevice.mutate(dev.hwid),
                      ) ?? (confirm('Отвязать устройство?') && deleteDevice.mutate(dev.hwid))
                    }
                    disabled={deleteDevice.isPending}
                  >
                    🗑
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/clients/${c.id}/extend`}>
          <Button full>⏭ Продлить</Button>
        </Link>
        {c.status === 'DISABLED' ? (
          <Button full variant="secondary" onClick={() => enable.mutate()}>
            ▶ Включить
          </Button>
        ) : (
          <Button full variant="secondary" onClick={() => disable.mutate()}>
            ⏸ Отключить
          </Button>
        )}
        <Button full variant="secondary" onClick={() => reset.mutate()}>
          ♻ Сбросить трафик
        </Button>
        <Button
          full
          variant="danger"
          onClick={() =>
            window.Telegram?.WebApp?.showConfirm?.('Удалить клиента?', (ok) => ok && del.mutate()) ??
            (confirm('Удалить клиента?') && del.mutate())
          }
        >
          🗑 Удалить
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-tg-hint">{k}</span>
      <span className="text-right break-all">{v}</span>
    </div>
  );
}
