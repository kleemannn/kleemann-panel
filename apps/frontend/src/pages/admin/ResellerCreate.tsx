import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

export function ResellerCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [tag, setTag] = useState('');
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
      if (tag) body.tag = tag;
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

  const err = mut.error as
    | { response?: { data?: { message?: string | string[] } }; message?: string }
    | null;
  const errMsg =
    (Array.isArray(err?.response?.data?.message)
      ? err?.response?.data?.message.join(', ')
      : err?.response?.data?.message) ?? err?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!telegramId) return;
    mut.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4">
      <PageHeader title="Новый реселлер" back />

      <Input
        label="Telegram ID"
        placeholder="123456789"
        value={telegramId}
        onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ''))}
        required
      />
      <Input
        label="Username"
        placeholder="необязательно, для отображения"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Input
        label="Tag"
        placeholder="KLEEMANN"
        hint="A-Z, 0-9, _ — до 16 символов"
        value={tag}
        onChange={(e) =>
          setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16))
        }
      />
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
        label="Действует до"
        hint="Пусто = бессрочно"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />
      {errMsg && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {String(errMsg)}
        </p>
      )}
      <Button type="submit" full size="lg" disabled={mut.isPending || !telegramId}>
        <Icon name="plus" /> {mut.isPending ? 'Создаём…' : 'Создать реселлера'}
      </Button>
    </form>
  );
}
