import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

const PRESETS = [30, 90, 180, 365];

export function Extend() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState('');

  const client = useQuery({
    queryKey: ['client', id],
    queryFn: async () =>
      (await api.get<{ username: string; expiresAt?: string | null }>(`/clients/${id}`)).data,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const durationDays = custom ? Number(custom) : days;
      await api.post(`/clients/${id}/extend`, { durationDays });
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['client', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      navigate(`/clients/${id}`);
    },
    onError: () => tgHapticError(),
  });

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
            onClick={() => {
              setDays(d);
              setCustom('');
            }}
            className={`shrink-0 rounded-full px-3 py-2 text-sm ${
              !custom && days === d ? 'bg-tg-button text-tg-buttonText' : 'bg-tg-secondary'
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
          onChange={(e) => setCustom(e.target.value)}
        />
      </div>

      <Button full disabled={mut.isPending} onClick={() => mut.mutate()}>
        {mut.isPending ? 'Продлеваем…' : `Продлить на ${custom || days} дн.`}
      </Button>
    </div>
  );
}
