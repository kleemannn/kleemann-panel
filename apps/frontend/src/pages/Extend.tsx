import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

const PRESETS = [7, 30];

type Mode = 'preset' | 'custom' | 'date';

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

  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<Mode>('preset');

  const preview = useMemo(() => {
    const current = client.data?.expiresAt ? new Date(client.data.expiresAt) : null;
    const base = current && current > new Date() ? current : new Date();
    if (mode === 'date') {
      if (!date) return { newExpireAt: null, addedDays: null };
      const newExpireAt = new Date(`${date}T23:59:59`);
      const addedDays = Math.max(0, Math.round((newExpireAt.getTime() - base.getTime()) / 864e5));
      return { newExpireAt, addedDays };
    }
    const delta = mode === 'custom' ? Number(custom) : days;
    if (!Number.isFinite(delta) || delta <= 0) return { newExpireAt: null, addedDays: null };
    return { newExpireAt: addDays(base, delta), addedDays: delta };
  }, [mode, days, custom, date, client.data?.expiresAt]);

  const mut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (mode === 'date') {
        if (!date) throw new Error('Выбери дату');
        body.expiresAt = new Date(`${date}T23:59:59`).toISOString();
      } else {
        const delta = mode === 'custom' ? Number(custom) : days;
        if (!Number.isFinite(delta) || delta <= 0) throw new Error('Введи корректное число дней');
        body.durationDays = delta;
      }
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

  const err = mut.error as { response?: { data?: { message?: string | string[] } }; message?: string } | null;
  const errMsg =
    (Array.isArray(err?.response?.data?.message)
      ? err?.response?.data?.message.join(', ')
      : err?.response?.data?.message) ?? err?.message;

  const today = new Date().toISOString().slice(0, 10);
  const disabled = mut.isPending || preview.newExpireAt === null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Продление</h1>
      <p className="text-sm text-tg-hint">
        {client.data?.username ? `Клиент ${client.data.username}. ` : ''}
        Текущий срок: {formatDate(client.data?.expiresAt ?? null)}
      </p>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setMode('preset');
              setDays(d);
              setCustom('');
              setDate('');
            }}
            className={`shrink-0 rounded-full px-3 py-2 text-sm ${
              mode === 'preset' && days === d ? 'bg-tg-button text-tg-buttonText' : 'bg-tg-secondary'
            }`}
          >
            +{d} дн.
          </button>
        ))}
        <Input
          className="!h-10 w-24 shrink-0"
          placeholder="другое"
          type="number"
          min={1}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setMode(e.target.value ? 'custom' : 'preset');
            if (e.target.value) setDate('');
          }}
        />
      </div>

      <div>
        <span className="block text-sm font-medium mb-2">или до конкретной даты</span>
        <Input
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setMode(e.target.value ? 'date' : 'preset');
            if (e.target.value) setCustom('');
          }}
        />
      </div>

      {preview.newExpireAt && (
        <p className="text-sm text-tg-hint">
          Новый срок: <span className="text-tg-text">{formatDate(preview.newExpireAt)}</span>
          {preview.addedDays !== null && (
            <span className="text-tg-text"> (+{preview.addedDays} дн.)</span>
          )}
        </p>
      )}

      {errMsg && <p className="text-sm text-red-500">{String(errMsg)}</p>}

      <Button full disabled={disabled} onClick={() => mut.mutate()}>
        {mut.isPending
          ? 'Продлеваем…'
          : mode === 'date'
            ? `Продлить до ${date || '…'}${preview.addedDays !== null ? ` (+${preview.addedDays} дн.)` : ''}`
            : `Продлить на ${mode === 'custom' ? custom || '…' : days} дн.`}
      </Button>
    </div>
  );
}
