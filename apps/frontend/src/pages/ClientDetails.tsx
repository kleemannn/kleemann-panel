import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, ClientStatus } from '@/components/ui/StatusBadge';
import { formatDate, formatDateTime, formatGb, daysUntil } from '@/lib/format';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface Client {
  id: string;
  username: string;
  status: ClientStatus;
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
      (
        await api.get<{
          subscriptionUrl: string | null;
          happCryptoLink: string | null;
          happError: 'no-subscription-url' | 'encrypt-failed' | null;
          onlineAt: string | null;
          firstConnectedAt: string | null;
          lastTrafficResetAt: string | null;
        }>(`/clients/${id}/subscription`)
      ).data,
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

  const runAction = (path: string) =>
    useMutation({
      mutationFn: async () => {
        await api.post(`/clients/${id}/${path}`);
      },
      onSuccess: () => {
        tgHapticSuccess();
        qc.invalidateQueries({ queryKey: ['client', id] });
        qc.invalidateQueries({ queryKey: ['clients'] });
      },
      onError: () => tgHapticError(),
    });

  const disable = runAction('disable');
  const enable = runAction('enable');
  const reset = runAction('reset-traffic');
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
  if (q.isLoading || !c) {
    return <div className="p-4 text-sm text-tg-hint">Загрузка…</div>;
  }

  const d = daysUntil(c.expiresAt ?? null);
  const deadlineText =
    d === null
      ? null
      : d < 0
        ? `${-d} дн. назад`
        : d === 0
          ? 'сегодня'
          : `через ${d} дн.`;
  const deadlineTone =
    d === null
      ? 'text-tg-hint'
      : d < 0
        ? 'text-red-500'
        : d <= 7
          ? 'text-amber-600'
          : 'text-tg-hint';

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      tgHapticSuccess();
      window.Telegram?.WebApp?.showAlert?.('Скопировано');
    } catch {
      window.Telegram?.WebApp?.openLink?.(text);
    }
  };

  const confirm_ = (msg: string, cb: () => void) => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.showConfirm) {
      webApp.showConfirm(msg, (ok) => ok && cb());
    } else if (window.confirm(msg)) {
      cb();
    }
  };

  return (
    <div className="space-y-5 p-4">
      <PageHeader title={c.username} back />

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={c.status} />
          {deadlineText && (
            <span className={`text-xs font-medium tabular-nums ${deadlineTone}`}>
              {deadlineText}
            </span>
          )}
        </div>
        <div>
          <div className="text-xs text-tg-hint">Действует до</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatDate(c.expiresAt ?? null)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-black/5 pt-3 text-sm">
          <Field label="Трафик" value={formatGb(c.trafficLimitGb ?? null)} />
          <Field
            label="Последний онлайн"
            value={sub.data?.onlineAt ? formatDateTime(sub.data.onlineAt) : '—'}
          />
          <Field label="Заметка" value={c.note || '—'} wide />
        </div>
      </Card>

      <CopyCard
        label="Happ Crypto Link"
        value={sub.data?.happCryptoLink ?? null}
        emptyText={
          sub.data?.happError === 'encrypt-failed'
            ? 'Панель Remnawave не вернула зашифрованную ссылку (обновите панель).'
            : sub.data?.happError === 'no-subscription-url'
              ? 'В Remnawave у этого клиента нет subscription-URL.'
              : undefined
        }
        onCopy={copyText}
        loading={sub.isLoading}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
            Устройства{devices.data ? ` (${devices.data.total})` : ''}
          </h2>
        </div>
        {devices.isLoading ? (
          <Card>
            <p className="text-sm text-tg-hint">Загрузка…</p>
          </Card>
        ) : !devices.data || devices.data.devices.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
              <Icon name="device" />
            </span>
            <p className="text-sm text-tg-hint">Нет подключённых устройств</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {devices.data.devices.map((dev) => (
              <li key={dev.hwid}>
                <Card className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-tg-button">
                    <Icon name="device" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {dev.deviceModel || dev.platform || 'Устройство'}
                    </p>
                    <p className="truncate text-xs text-tg-hint">
                      {[dev.platform, dev.osVersion].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p className="truncate font-mono text-[11px] text-tg-hint/80">{dev.hwid}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!h-9 !w-9 !p-0 text-red-500"
                    onClick={() => confirm_('Отвязать устройство?', () => deleteDevice.mutate(dev.hwid))}
                    disabled={deleteDevice.isPending}
                    aria-label="Отвязать"
                  >
                    <Icon name="trash" size={18} />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
          Действия
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Link to={`/clients/${c.id}/extend`} className="col-span-2">
            <Button full size="lg">
              <Icon name="calendar" /> Продлить подписку
            </Button>
          </Link>
          {c.status === 'DISABLED' ? (
            <Button variant="secondary" onClick={() => enable.mutate()} disabled={enable.isPending}>
              <Icon name="play" size={16} /> Включить
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => disable.mutate()}
              disabled={disable.isPending}
            >
              <Icon name="pause" size={16} /> Отключить
            </Button>
          )}
          <Button variant="secondary" onClick={() => reset.mutate()} disabled={reset.isPending}>
            <Icon name="refresh" size={16} /> Сбросить трафик
          </Button>
          <Button
            full
            variant="danger"
            className="col-span-2"
            onClick={() => confirm_('Удалить клиента?', () => del.mutate())}
            disabled={del.isPending}
          >
            <Icon name="trash" size={16} /> Удалить клиента
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-xs text-tg-hint">{label}</div>
      <div className="mt-0.5 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function CopyCard({
  label,
  value,
  onCopy,
  loading,
  emptyText,
}: {
  label: string;
  value: string | null;
  onCopy: (v: string) => void;
  loading?: boolean;
  emptyText?: string;
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
          {label}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onCopy(value)}
            className="inline-flex items-center gap-1.5 rounded-full bg-tg-button/10 px-3 py-1 text-xs font-medium text-tg-button hover:bg-tg-button/15"
          >
            <Icon name="copy" size={14} /> Копировать
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-tg-hint">Загрузка…</p>
      ) : value ? (
        <button
          type="button"
          onClick={() => onCopy(value)}
          title="Нажмите, чтобы скопировать"
          className="block w-full truncate rounded-xl bg-black/[0.03] px-3 py-2 text-left font-mono text-xs text-tg-link ring-1 ring-black/5"
        >
          {value}
        </button>
      ) : (
        <p className="text-sm text-tg-hint">{emptyText ?? 'Ссылка недоступна'}</p>
      )}
    </Card>
  );
}
