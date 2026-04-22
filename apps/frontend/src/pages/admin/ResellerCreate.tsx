import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

export function ResellerCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [type, setType] = useState<'STANDARD' | 'PREMIUM'>('STANDARD');
  const [maxClients, setMaxClients] = useState('50');
  const [expiresAt, setExpiresAt] = useState<string>('');

  const mut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        telegramId,
        type,
        maxClients: Number(maxClients),
      };
      if (username) body.username = username;
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const { data } = await api.post('/admin/resellers', body);
      return data;
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'resellers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'summary'] });
      navigate('/admin/resellers');
    },
    onError: () => tgHapticError(),
  });

  const err = mut.error as any;
  const errMsg = err?.response?.data?.message ?? err?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!telegramId) return;
    mut.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Новый реселлер</h1>
      <Input
        label="Telegram ID"
        placeholder="123456789"
        value={telegramId}
        onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ''))}
        required
      />
      <Input
        label="Username (необязательно)"
        placeholder="@ignore, только для отображения"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Select label="Тип" value={type} onChange={(e) => setType(e.target.value as 'STANDARD' | 'PREMIUM')}>
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
        label="Дата окончания аккаунта (необязательно)"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />
      {errMsg && <p className="text-sm text-red-500">{String(errMsg)}</p>}
      <Button type="submit" full disabled={mut.isPending || !telegramId}>
        {mut.isPending ? 'Создаём…' : 'Создать'}
      </Button>
    </form>
  );
}
