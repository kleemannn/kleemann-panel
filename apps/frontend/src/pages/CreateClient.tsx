import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { DurationPicker, DurationState, resolveDuration } from '@/components/DurationPicker';
import { useAuthStore } from '@/store/auth';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

export function CreateClient() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.me?.role) === 'ADMIN';
  const [username, setUsername] = useState('');
  const [duration, setDuration] = useState<DurationState>({
    mode: 'preset',
    preset: 30,
    custom: '',
    date: '',
  });
  const [unlimited, setUnlimited] = useState(true);
  const [trafficGb, setTrafficGb] = useState<string>('100');
  const [note, setNote] = useState('');
  const [deviceLimit, setDeviceLimit] = useState<string>('1');

  const mut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { username };
      const { durationDays, expiresAt } = resolveDuration(duration);
      if (expiresAt) body.expiresAt = expiresAt;
      else if (durationDays) body.durationDays = durationDays;
      else throw new Error('Укажи срок подписки');

      if (!unlimited) body.trafficLimitGb = Number(trafficGb);
      if (note) body.note = note;
      if (isAdmin) {
        const parsedLimit = Number(deviceLimit);
        if (deviceLimit.trim() !== '' && Number.isFinite(parsedLimit) && parsedLimit >= 0) {
          body.hwidDeviceLimit = parsedLimit;
        }
      }
      const { data } = await api.post('/clients', body);
      return data;
    },
    onSuccess: (data: { id: string }) => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      navigate(`/clients/${data.id}`);
    },
    onError: () => tgHapticError(),
  });

  const err = mut.error as
    | { response?: { data?: { message?: string | string[] } }; message?: string }
    | null;
  const errMsg =
    (Array.isArray(err?.response?.data?.message)
      ? err?.response?.data?.message.join(', ')
      : err?.response?.data?.message) ?? err?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username) return;
    mut.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 p-4">
      <PageHeader title="Новый клиент" subtitle="Создание подписки" back />

      <Input
        label="Username"
        placeholder="client_name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        required
      />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
          Срок подписки
        </h2>
        <DurationPicker state={duration} onChange={setDuration} />
      </section>

      <Card className="space-y-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tg-button/10 text-tg-button">
              <Icon name="spark" size={16} />
            </span>
            <div>
              <div className="text-sm font-medium">Безлимитный трафик</div>
              <div className="text-xs text-tg-hint">Без ограничения по ГБ</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
            className="h-5 w-5 accent-tg-button"
          />
        </label>
        {!unlimited && (
          <Input
            label="Трафик, ГБ"
            type="number"
            min={1}
            value={trafficGb}
            onChange={(e) => setTrafficGb(e.target.value)}
          />
        )}
      </Card>

      {isAdmin && (
        <Input
          label="Лимит устройств (HWID)"
          type="number"
          min={0}
          max={100}
          value={deviceLimit}
          onChange={(e) => setDeviceLimit(e.target.value)}
          hint="1 = одно устройство, 0 = безлимит"
        />
      )}

      <Input
        label="Заметка"
        placeholder="Например, контакт клиента"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {errMsg && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {String(errMsg)}
        </p>
      )}

      <Button type="submit" full size="lg" disabled={mut.isPending || !username}>
        <Icon name="plus" /> {mut.isPending ? 'Создаём…' : 'Создать клиента'}
      </Button>
    </form>
  );
}
