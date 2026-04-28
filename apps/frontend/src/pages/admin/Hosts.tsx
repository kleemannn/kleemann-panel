import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/format';
import { tgHapticError, tgHapticSuccess } from '@/lib/telegram';

interface HostSummary {
  uuid: string;
  remark?: string | null;
  address: string;
  port: number;
  tag: string | null;
  isDisabled: boolean;
}

interface HostGroup {
  tag: string | null;
  hosts: HostSummary[];
}

interface HostsResponse {
  groups: HostGroup[];
  total: number;
}

interface BulkReplaceResult {
  affected: number;
  failed: number;
  hostsAffected: { uuid: string; remark?: string | null }[];
  hostsFailed: { uuid: string; remark?: string | null; error: string }[];
  changeId: string;
}

interface HostIpChange {
  id: string;
  tag: string | null;
  hostUuid: string | null;
  previousAddress: string | null;
  newAddress: string;
  previousPort: number | null;
  newPort: number | null;
  hostsAffected: number;
  hostsFailed: number;
  performedBy: string;
  note: string | null;
  createdAt: string;
}

interface HistoryResponse {
  items: HostIpChange[];
  total: number;
}

interface PoolView {
  id: string;
  tag: string;
  addresses: string[];
  currentIdx: number;
  port: number | null;
  note: string | null;
  updatedAt: string;
  createdAt: string;
}

const UNTAGGED_KEY = '__UNTAGGED__';

type Target =
  | { kind: 'tag'; tag: string; hostsCount: number; sample: HostSummary }
  | { kind: 'host'; host: HostSummary };

export function Hosts() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);

  const hostsQuery = useQuery({
    queryKey: ['admin', 'hosts'],
    queryFn: async () => (await api.get<HostsResponse>('/admin/hosts')).data,
  });

  const historyQuery = useQuery({
    queryKey: ['admin', 'hosts', 'history'],
    queryFn: async () =>
      (await api.get<HistoryResponse>('/admin/hosts/history', { params: { take: 30 } })).data,
  });

  const poolsQuery = useQuery({
    queryKey: ['admin', 'hosts', 'pools'],
    queryFn: async () => (await api.get<PoolView[]>('/admin/hosts/pools')).data,
  });

  const [editingPoolTag, setEditingPoolTag] = useState<string | null>(null);
  const poolsByTag = useMemo(() => {
    const m = new Map<string, PoolView>();
    for (const p of poolsQuery.data ?? []) m.set(p.tag, p);
    return m;
  }, [poolsQuery.data]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'hosts'] });
    qc.invalidateQueries({ queryKey: ['admin', 'hosts', 'history'] });
    qc.invalidateQueries({ queryKey: ['admin', 'hosts', 'pools'] });
  };

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Хосты"
        subtitle={hostsQuery.data ? `${hostsQuery.data.total} в Remnawave` : undefined}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['admin', 'hosts'] });
              qc.invalidateQueries({ queryKey: ['admin', 'hosts', 'history'] });
            }}
          >
            <Icon name="refresh" size={16} /> Обновить
          </Button>
        }
        back
      />

      {hostsQuery.isLoading && (
        <Card>
          <p className="text-sm text-tg-hint">Загрузка…</p>
        </Card>
      )}

      {hostsQuery.error && (
        <Card>
          <p className="text-sm text-red-500">
            Не удалось загрузить хосты. Проверь токен Remnawave в логах backend.
          </p>
        </Card>
      )}

      {hostsQuery.data &&
        hostsQuery.data.groups.map((g) => (
          <HostGroupCard
            key={g.tag ?? UNTAGGED_KEY}
            group={g}
            pool={g.tag ? poolsByTag.get(g.tag) : undefined}
            onBulk={() =>
              setTarget({
                kind: 'tag',
                tag: g.tag ?? UNTAGGED_KEY,
                hostsCount: g.hosts.length,
                sample: g.hosts[0],
              })
            }
            onSingle={(h) => setTarget({ kind: 'host', host: h })}
            onEditPool={(tag) => setEditingPoolTag(tag)}
            onRotated={invalidateAll}
          />
        ))}

      <ChangeHistory data={historyQuery.data} />

      {target && (
        <ReplaceModal
          target={target}
          onClose={() => setTarget(null)}
          onSuccess={() => {
            invalidateAll();
            setTarget(null);
          }}
        />
      )}

      {editingPoolTag && (
        <PoolEditorModal
          tag={editingPoolTag}
          existing={poolsByTag.get(editingPoolTag)}
          onClose={() => setEditingPoolTag(null)}
          onSaved={() => {
            invalidateAll();
            setEditingPoolTag(null);
          }}
        />
      )}
    </div>
  );
}

function HostGroupCard({
  group,
  pool,
  onBulk,
  onSingle,
  onEditPool,
  onRotated,
}: {
  group: HostGroup;
  pool?: PoolView;
  onBulk: () => void;
  onSingle: (h: HostSummary) => void;
  onEditPool: (tag: string) => void;
  onRotated: () => void;
}) {
  const tagLabel = group.tag ?? '— без тега —';
  const sharedAddress = useMemo(() => {
    const set = new Set(group.hosts.map((h) => h.address));
    return set.size === 1 ? [...set][0] : null;
  }, [group.hosts]);

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-tg-button">
          <Icon name="shield" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wide text-tg-button">
              {tagLabel}
            </span>
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] text-tg-hint">
              {group.hosts.length} {pluralize(group.hosts.length, 'хост', 'хоста', 'хостов')}
            </span>
          </div>
          {sharedAddress && (
            <div className="mt-1 truncate font-mono text-xs text-tg-hint">{sharedAddress}</div>
          )}
        </div>
        {group.tag && (
          <Button size="sm" onClick={onBulk}>
            Заменить IP
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {group.hosts.map((h) => (
          <div
            key={h.uuid}
            className="flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{h.remark ?? '—'}</span>
                {h.isDisabled && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">
                    выкл
                  </span>
                )}
              </div>
              <div className="truncate font-mono text-xs text-tg-hint">
                {h.address}:{h.port}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSingle(h)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-tg-hint hover:bg-black/[0.05]"
              aria-label="Заменить IP"
            >
              <Icon name="edit" size={16} />
            </button>
          </div>
        ))}
      </div>

      {group.tag && (
        <PoolBlock tag={group.tag} pool={pool} onEdit={onEditPool} onRotated={onRotated} />
      )}
    </Card>
  );
}

function PoolBlock({
  tag,
  pool,
  onEdit,
  onRotated,
}: {
  tag: string;
  pool?: PoolView;
  onEdit: (tag: string) => void;
  onRotated: () => void;
}) {
  const qc = useQueryClient();
  const rotateMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/admin/hosts/pools/${encodeURIComponent(tag)}/rotate`, {});
      return data;
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'hosts', 'pools'] });
      onRotated();
    },
    onError: () => tgHapticError(),
  });

  if (!pool || pool.addresses.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onEdit(tag)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-tg-hint/40 px-3 py-2 text-xs text-tg-hint hover:border-tg-button hover:text-tg-button"
      >
        <Icon name="plus" size={14} /> Настроить пул IP
      </button>
    );
  }

  const err = rotateMut.error as
    | { response?: { data?: { message?: string | string[] } }; message?: string }
    | null;
  const errMsg =
    (Array.isArray(err?.response?.data?.message)
      ? err?.response?.data?.message.join(', ')
      : err?.response?.data?.message) ?? err?.message;

  return (
    <div className="rounded-xl bg-tg-button/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon name="refresh" size={14} className="text-tg-button" />
        <span className="text-xs font-semibold uppercase tracking-wide text-tg-button">
          Пул IP ({pool.addresses.length})
        </span>
        <button
          type="button"
          onClick={() => onEdit(tag)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-tg-hint hover:bg-black/[0.05]"
          aria-label="Редактировать пул"
        >
          <Icon name="edit" size={14} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {pool.addresses.map((addr, i) => (
          <span
            key={`${addr}-${i}`}
            className={clsx(
              'rounded-full px-2 py-0.5 font-mono text-[11px]',
              i === pool.currentIdx
                ? 'bg-tg-button text-tg-buttonText'
                : 'bg-black/[0.06] text-tg-text',
            )}
          >
            {addr}
          </span>
        ))}
      </div>

      {pool.addresses.length >= 2 ? (
        <Button
          full
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => rotateMut.mutate()}
          disabled={rotateMut.isPending}
        >
          {rotateMut.isPending ? 'Ротирую…' : 'Ротировать на следующий IP'}
        </Button>
      ) : (
        <div className="mt-2 text-[11px] text-tg-hint">
          Добавь хотя бы 2 адреса, чтобы ротировать.
        </div>
      )}
      {errMsg && (
        <div className="mt-2 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-600">
          {errMsg}
        </div>
      )}
    </div>
  );
}

function ReplaceModal({
  target,
  onClose,
  onSuccess,
}: {
  target: Target;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newAddress, setNewAddress] = useState('');
  const [newPort, setNewPort] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<BulkReplaceResult | null>(null);

  const titleLabel =
    target.kind === 'tag'
      ? `Замена IP по тегу ${target.tag === UNTAGGED_KEY ? '— без тега —' : target.tag}`
      : `Замена IP: ${target.host.remark ?? target.host.uuid}`;

  const previousAddress =
    target.kind === 'tag'
      ? `${target.sample.address}:${target.sample.port}`
      : `${target.host.address}:${target.host.port}`;

  const hostsCount = target.kind === 'tag' ? target.hostsCount : 1;

  const mut = useMutation({
    mutationFn: async () => {
      const portNum = newPort.trim() ? Number(newPort) : undefined;
      const body = {
        newAddress: newAddress.trim(),
        ...(portNum !== undefined && !Number.isNaN(portNum) ? { newPort: portNum } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      if (target.kind === 'tag') {
        const { data } = await api.post<BulkReplaceResult>('/admin/hosts/bulk-replace-address', {
          tag: target.tag,
          ...body,
        });
        return data;
      }
      const { data } = await api.post<BulkReplaceResult>(
        `/admin/hosts/${target.host.uuid}/replace-address`,
        body,
      );
      return data;
    },
    onSuccess: (r) => {
      tgHapticSuccess();
      setResult(r);
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

  const valid = newAddress.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-3xl bg-tg-bg p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{titleLabel}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-tg-hint hover:bg-black/5"
            aria-label="Закрыть"
          >
            <Icon name="x" />
          </button>
        </div>

        {!result ? (
          <div className="mt-3 space-y-3">
            <Card className="space-y-1 bg-black/[0.03] p-3 ring-0">
              <div className="text-xs text-tg-hint">Сейчас:</div>
              <div className="font-mono text-sm">{previousAddress}</div>
              <div className="text-xs text-tg-hint">
                Будет обновлено: <b>{hostsCount}</b>{' '}
                {pluralize(hostsCount, 'хост', 'хоста', 'хостов')}
              </div>
            </Card>

            <Input
              label="Новый IP / домен"
              placeholder="185.xx.xx.xx или sub.example.com"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              autoFocus
            />
            <Input
              label="Новый порт (необязательно)"
              placeholder="оставь пустым чтобы не менять"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
            />
            <Input
              label="Заметка"
              placeholder="напр. ROSKOMNADZOR_BLOCK_2026-04-28"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {errMsg && (
              <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {errMsg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={onClose} full>
                Отмена
              </Button>
              <Button
                onClick={() => mut.mutate()}
                disabled={!valid || mut.isPending}
                full
              >
                {mut.isPending ? 'Применяю…' : 'Заменить'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <Card
              className={clsx(
                'p-3 ring-0',
                result.failed === 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
              )}
            >
              <div className="text-sm font-semibold">
                Обновлено: {result.affected}
                {result.failed > 0 && ` · Ошибки: ${result.failed}`}
              </div>
            </Card>

            {result.hostsFailed.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-tg-hint">
                  Не удалось:
                </div>
                {result.hostsFailed.map((h) => (
                  <div
                    key={h.uuid}
                    className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600"
                  >
                    <div className="font-medium">{h.remark ?? h.uuid}</div>
                    <div className="opacity-80">{h.error}</div>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={onSuccess} full>
              Готово
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeHistory({ data }: { data?: HistoryResponse }) {
  if (!data || data.items.length === 0) return null;
  return (
    <Card className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
        История замен
      </h3>
      <div className="space-y-2">
        {data.items.map((it) => (
          <div key={it.id} className="rounded-xl bg-black/[0.03] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono uppercase text-tg-button">
                {it.tag ?? (it.hostUuid ? '— один хост —' : '— без тега —')}
              </span>
              <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] text-tg-hint">
                {it.hostsAffected} ok
                {it.hostsFailed > 0 && ` · ${it.hostsFailed} fail`}
              </span>
              <span className="ml-auto text-tg-hint">{formatDateTime(it.createdAt)}</span>
            </div>
            <div className="mt-1 truncate font-mono text-xs">
              <span className="text-tg-hint">{it.previousAddress ?? '—'}</span>
              {it.previousPort !== null && (
                <span className="text-tg-hint">:{it.previousPort}</span>
              )}
              <span className="mx-1.5 text-tg-hint">→</span>
              <span>{it.newAddress}</span>
              {it.newPort !== null && <span>:{it.newPort}</span>}
            </div>
            {it.note && (
              <div className="mt-1 truncate text-[11px] text-tg-hint">{it.note}</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function PoolEditorModal({
  tag,
  existing,
  onClose,
  onSaved,
}: {
  tag: string;
  existing?: PoolView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [addresses, setAddresses] = useState<string[]>(existing?.addresses ?? []);
  const [currentIdx, setCurrentIdx] = useState<number>(existing?.currentIdx ?? 0);
  const [port, setPort] = useState<string>(existing?.port?.toString() ?? '');
  const [note, setNote] = useState<string>(existing?.note ?? '');
  const [draft, setDraft] = useState('');

  const saveMut = useMutation({
    mutationFn: async () => {
      const portNum = port.trim() ? Number(port) : undefined;
      const body = {
        tag,
        addresses: addresses.map((a) => a.trim()).filter(Boolean),
        currentIdx: Math.min(addresses.length - 1, Math.max(0, currentIdx)),
        ...(portNum !== undefined && !Number.isNaN(portNum) ? { port: portNum } : { port: null }),
        ...(note.trim() ? { note: note.trim() } : { note: null }),
      };
      const { data } = await api.put<PoolView>('/admin/hosts/pools', body);
      return data;
    },
    onSuccess: () => {
      tgHapticSuccess();
      onSaved();
    },
    onError: () => tgHapticError(),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/hosts/pools/${encodeURIComponent(tag)}`);
    },
    onSuccess: () => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['admin', 'hosts', 'pools'] });
      onSaved();
    },
    onError: () => tgHapticError(),
  });

  const addDraft = () => {
    const v = draft.trim();
    if (!v) return;
    setAddresses((a) => [...a, v]);
    setDraft('');
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= addresses.length) return;
    const next = [...addresses];
    [next[i], next[j]] = [next[j], next[i]];
    setAddresses(next);
    if (currentIdx === i) setCurrentIdx(j);
    else if (currentIdx === j) setCurrentIdx(i);
  };

  const removeAt = (i: number) => {
    setAddresses((a) => a.filter((_, idx) => idx !== i));
    if (currentIdx >= addresses.length - 1) setCurrentIdx(Math.max(0, addresses.length - 2));
  };

  const err = saveMut.error as
    | { response?: { data?: { message?: string | string[] } }; message?: string }
    | null;
  const errMsg =
    (Array.isArray(err?.response?.data?.message)
      ? err?.response?.data?.message.join(', ')
      : err?.response?.data?.message) ?? err?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-3xl bg-tg-bg p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Пул IP — <span className="font-mono">{tag}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-tg-hint hover:bg-black/5"
            aria-label="Закрыть"
          >
            <Icon name="x" />
          </button>
        </div>

        <p className="mt-2 text-xs text-tg-hint">
          Кандидаты на замену IP при блокировке. «Активный» (выделен) применяется ко всем
          хостам с этим тегом, при ротации он сдвигается на следующий по списку.
        </p>

        <div className="mt-3 space-y-1.5">
          {addresses.map((a, i) => (
            <div
              key={`${a}-${i}`}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2',
                i === currentIdx ? 'bg-tg-button/10 ring-1 ring-tg-button/30' : 'bg-black/[0.03]',
              )}
            >
              <button
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={clsx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  i === currentIdx
                    ? 'bg-tg-button text-tg-buttonText'
                    : 'bg-black/[0.05] text-tg-hint',
                )}
                aria-label="Сделать активным"
              >
                {i + 1}
              </button>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{a}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="flex h-7 w-7 items-center justify-center rounded-full text-tg-hint disabled:opacity-30"
                aria-label="Вверх"
              >
                <Icon name="chevronRight" size={14} className="-rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === addresses.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-full text-tg-hint disabled:opacity-30"
                aria-label="Вниз"
              >
                <Icon name="chevronRight" size={14} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10"
                aria-label="Удалить"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          {addresses.length === 0 && (
            <div className="rounded-xl border border-dashed border-tg-hint/30 px-3 py-4 text-center text-xs text-tg-hint">
              Пул пустой — добавь IP/домены ниже.
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            placeholder="185.xx.xx.xx или sub.example.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDraft();
              }
            }}
            wrapperClassName="flex-1"
          />
          <Button onClick={addDraft} disabled={!draft.trim()}>
            <Icon name="plus" size={16} />
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input
            label="Порт (для всех)"
            placeholder="оставь пустым"
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
          />
          <Input
            label="Заметка"
            placeholder="напр. germany routing"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {errMsg && (
          <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {errMsg}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {existing && (
            <Button
              variant="danger"
              onClick={() => {
                const ok = window.Telegram?.WebApp?.showConfirm?.(
                  `Удалить пул "${tag}"?`,
                  (accepted) => accepted && deleteMut.mutate(),
                );
                if (ok === undefined && window.confirm(`Удалить пул "${tag}"?`)) {
                  deleteMut.mutate();
                }
              }}
              disabled={deleteMut.isPending}
            >
              <Icon name="trash" size={16} />
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} full>
            Отмена
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} full>
            {saveMut.isPending ? 'Сохраняю…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
