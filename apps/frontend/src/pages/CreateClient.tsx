import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

const PRESETS = [30, 90, 180, 365];

export function CreateClient() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [unlimited, setUnlimited] = useState(true);
  const [trafficGb, setTrafficGb] = useState<string>('100');
  const [note, setNote] = useState('');

  const mut = useMutation({
    mutationFn: async () => {
      const durationDays = customDuration ? Number(customDuration) : duration;
      const body: Record<string, unknown> = { username, durationDays };
      if (!unlimited) body.trafficLimitGb = Number(trafficGb);
      if (note) body.note = note;
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

  const err = mut.error as any;
  const errMsg =
    err?.response?.data?.message ??
    (Array.isArray(err?.response?.data?.message) ? err.response.data.message.join(', ') : null) ??
    err?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username) return;
    mut.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Новый клиент</h1>

      <Input
        label="Username"
        placeholder="client_name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        required
      />

      <div>
        <span className="block text-sm font-medium mb-2">Срок подписки</span>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDuration(d);
                setCustomDuration('');
              }}
              className={`shrink-0 rounded-full px-3 py-2 text-sm ${
                !customDuration && duration === d
                  ? 'bg-tg-button text-tg-buttonText'
                  : 'bg-tg-secondary'
              }`}
            >
              {d} дн.
            </button>
          ))}
          <Input
            className="!h-10 w-24 shrink-0"
            placeholder="другое"
            type="number"
            min={1}
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
          />
        </div>
      </div>

      <Card className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
          />
          <span className="text-sm">Безлимитный трафик</span>
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

      <Input
        label="Заметка"
        placeholder="Например, контакт клиента"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {errMsg && <p className="text-sm text-red-500">{String(errMsg)}</p>}

      <Button type="submit" full disabled={mut.isPending || !username}>
        {mut.isPending ? 'Создаём…' : 'Создать'}
      </Button>
    </form>
  );
}
