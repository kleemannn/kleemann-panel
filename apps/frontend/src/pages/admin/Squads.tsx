import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface Mapping {
  id: string;
  type: 'STANDARD' | 'PREMIUM';
  squadUuid: string;
  label?: string | null;
}

interface RemnaSquad {
  uuid: string;
  name: string;
}

export function Squads() {
  const qc = useQueryClient();
  const mappings = useQuery({
    queryKey: ['admin', 'squads'],
    queryFn: async () => (await api.get<Mapping[]>('/admin/squads')).data,
  });
  const remna = useQuery({
    queryKey: ['admin', 'squads', 'remnawave'],
    queryFn: async () => (await api.get<RemnaSquad[]>('/admin/squads/remnawave')).data,
    retry: 0,
  });

  const [std, setStd] = useState('');
  const [prm, setPrm] = useState('');

  useEffect(() => {
    if (mappings.data) {
      setStd(mappings.data.find((m) => m.type === 'STANDARD')?.squadUuid ?? '');
      setPrm(mappings.data.find((m) => m.type === 'PREMIUM')?.squadUuid ?? '');
    }
  }, [mappings.data]);

  const save = useMutation({
    mutationFn: async ({ type, uuid }: { type: 'STANDARD' | 'PREMIUM'; uuid: string }) => {
      await api.put('/admin/squads', { type, squadUuid: uuid });
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'squads'] });
    },
    onError: () => tgHapticError(),
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Squad mapping</h1>
      <p className="text-sm text-tg-hint">
        UUID internal squad'ов из Remnawave, которые будут назначаться новым клиентам
        в зависимости от типа реселлера.
      </p>

      {remna.isError && (
        <Card className="text-sm text-yellow-700 bg-yellow-500/10">
          Не удалось получить список squad'ов из Remnawave. Впишите UUID вручную.
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-medium">STANDARD</h2>
        {remna.data ? (
          <Select value={std} onChange={(e) => setStd(e.target.value)}>
            <option value="">— выбрать —</option>
            {remna.data.map((s) => (
              <option key={s.uuid} value={s.uuid}>
                {s.name} ({s.uuid.slice(0, 8)}…)
              </option>
            ))}
          </Select>
        ) : (
          <Input value={std} onChange={(e) => setStd(e.target.value)} placeholder="UUID" />
        )}
        <Button
          full
          onClick={() => save.mutate({ type: 'STANDARD', uuid: std })}
          disabled={!std || save.isPending}
        >
          Сохранить STANDARD
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">PREMIUM</h2>
        {remna.data ? (
          <Select value={prm} onChange={(e) => setPrm(e.target.value)}>
            <option value="">— выбрать —</option>
            {remna.data.map((s) => (
              <option key={s.uuid} value={s.uuid}>
                {s.name} ({s.uuid.slice(0, 8)}…)
              </option>
            ))}
          </Select>
        ) : (
          <Input value={prm} onChange={(e) => setPrm(e.target.value)} placeholder="UUID" />
        )}
        <Button
          full
          onClick={() => save.mutate({ type: 'PREMIUM', uuid: prm })}
          disabled={!prm || save.isPending}
        >
          Сохранить PREMIUM
        </Button>
      </Card>
    </div>
  );
}
