import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
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
    <div className="space-y-4 p-4">
      <PageHeader
        title="Squad mapping"
        subtitle="Squad'ы Remnawave, которые получают новые клиенты"
        back
      />

      {remna.isError && (
        <Card className="flex items-start gap-3 bg-amber-500/10 ring-amber-500/20 text-amber-700">
          <Icon name="shield" className="mt-0.5 shrink-0" />
          <div className="text-sm">
            Не удалось получить список squad'ов из Remnawave. Впишите UUID вручную.
          </div>
        </Card>
      )}

      {(['STANDARD', 'PREMIUM'] as const).map((t) => {
        const val = t === 'STANDARD' ? std : prm;
        const setter = t === 'STANDARD' ? setStd : setPrm;
        return (
          <Card key={t} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t}</h2>
              <span className="rounded-full bg-tg-button/10 px-2.5 py-0.5 text-[10px] font-medium text-tg-button">
                Тип реселлера
              </span>
            </div>
            {remna.data ? (
              <Select value={val} onChange={(e) => setter(e.target.value)}>
                <option value="">— выбрать —</option>
                {remna.data.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.name} ({s.uuid.slice(0, 8)}…)
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={val}
                onChange={(e) => setter(e.target.value)}
                placeholder="UUID squad'а"
              />
            )}
            <Button
              full
              onClick={() => save.mutate({ type: t, uuid: val })}
              disabled={!val || save.isPending}
            >
              <Icon name="check" /> Сохранить {t}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
