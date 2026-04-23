import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  DurationPicker,
  DurationState,
  resolveDuration,
} from '@/components/DurationPicker';
import { formatDate } from '@/lib/format';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 864e5);
}

export function Extend() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const client = useQuery({
    queryKey: ['client', id],
    queryFn: async () =>
      (await api.get<{ username: string; expiresAt?: string | null }>(`/clients/${id}`)).data,
  });

  const [duration, setDuration] = useState<DurationState>({
    mode: 'preset',
    preset: 30,
    custom: '',
    date: '',
  });

  const preview = useMemo(() => {
    const current = client.data?.expiresAt ? new Date(client.data.expiresAt) : null;
    const base = current && current > new Date() ? current : new Date();
    const { durationDays, expiresAt } = resolveDuration(duration);
    if (expiresAt) {
      const newExpireAt = new Date(expiresAt);
      const addedDays = Math.max(
        0,
        Math.round((newExpireAt.getTime() - base.getTime()) / 864e5),
      );
      return { newExpireAt, addedDays };
    }
    if (durationDays) return { newExpireAt: addDays(base, durationDays), addedDays: durationDays };
    return { newExpireAt: null, addedDays: null };
  }, [duration, client.data?.expiresAt]);

  const mut = useMutation({
    mutationFn: async () => {
      const { durationDays, expiresAt } = resolveDuration(duration);
      const body: Record<string, unknown> = {};
      if (expiresAt) body.expiresAt = expiresAt;
      else if (durationDays) body.durationDays = durationDays;
      else throw new Error('Укажи срок');
      await api.post(`/clients/${id}/extend`, body);
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['client', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      navigate(`/clients/${id}`);
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

  const disabled = mut.isPending || preview.newExpireAt === null;

  return (
    <div className="space-y-5 p-4">
      <PageHeader
        title="Продление"
        subtitle={client.data?.username ? `Клиент ${client.data.username}` : undefined}
        back
      />

      <Card className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-tg-hint">Сейчас до</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {formatDate(client.data?.expiresAt ?? null)}
          </div>
        </div>
        <div>
          <div className="text-xs text-tg-hint">Станет до</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {preview.newExpireAt ? formatDate(preview.newExpireAt) : '—'}
            {preview.addedDays !== null && preview.addedDays > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                +{preview.addedDays}д
              </span>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
          Добавить
        </h2>
        <DurationPicker state={duration} onChange={setDuration} presetPrefix="+" />
      </section>

      {errMsg && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {String(errMsg)}
        </p>
      )}

      <Button full size="lg" onClick={() => mut.mutate()} disabled={disabled}>
        <Icon name="check" />
        {mut.isPending
          ? 'Продлеваем…'
          : preview.addedDays !== null && preview.addedDays > 0
            ? `Продлить на +${preview.addedDays} дн.`
            : 'Продлить'}
      </Button>
    </div>
  );
}
