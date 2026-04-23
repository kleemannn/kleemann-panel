import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface ImportReport {
  resellers: {
    created: number;
    updated: number;
    errors: { telegramId: string; error: string }[];
  };
  clients: {
    created: number;
    skippedExisting: number;
    skippedUnknownReseller: number;
    errors: { username: string; error: string }[];
  };
  squadMappings: { applied: number };
}

export function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const exportMut = useMutation({
    mutationFn: async () => {
      const res = await api.get('/admin/backup/export', { responseType: 'blob' });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `kleemann-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => tgHapticSuccess(),
    onError: () => tgHapticError(),
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error('Файл не является валидным JSON');
      }
      const { data } = await api.post<ImportReport>('/admin/backup/import', body);
      return data;
    },
    onSuccess: (r) => {
      tgHapticSuccess();
      setReport(r);
    },
    onError: () => tgHapticError(),
  });

  const startImport = (file: File) => {
    const ok =
      window.Telegram?.WebApp?.showConfirm?.(
        `Восстановить из "${file.name}"? Клиенты будут пересозданы в Remnawave с НОВЫМИ subscription-ссылками.`,
        (accepted) => accepted && importMut.mutate(file),
      );
    if (ok === undefined) {
      if (
        window.confirm(
          `Восстановить из "${file.name}"? Клиенты будут пересозданы в Remnawave с НОВЫМИ subscription-ссылками.`,
        )
      ) {
        importMut.mutate(file);
      }
    }
  };

  const importErr = importMut.error as
    | { response?: { data?: { message?: string | string[] } }; message?: string }
    | null;
  const importErrMsg =
    (Array.isArray(importErr?.response?.data?.message)
      ? importErr?.response?.data?.message.join(', ')
      : importErr?.response?.data?.message) ?? importErr?.message;

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Backup" subtitle="Экспорт и восстановление" back />

      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-tg-button">
            <Icon name="download" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Скачать backup</div>
            <div className="text-xs text-tg-hint">
              Все реселлеры, клиенты и squad-маппинг в одном JSON-файле.
            </div>
          </div>
        </div>
        <Button full size="md" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
          <Icon name="download" />
          {exportMut.isPending ? 'Готовим…' : 'Скачать backup.json'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <Icon name="refresh" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Восстановить из backup</div>
            <div className="text-xs text-tg-hint">
              Реселлеры: upsert по Telegram ID. Клиенты создаются заново в Remnawave — у них
              появятся <b>новые subscription-ссылки</b>. Уже существующие клиенты (по username)
              пропускаются.
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) startImport(f);
          }}
        />
        <Button
          full
          size="md"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={importMut.isPending}
        >
          <Icon name="clipboard" />
          {importMut.isPending ? 'Восстанавливаем…' : 'Выбрать backup.json'}
        </Button>

        {importErrMsg && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {String(importErrMsg)}
          </p>
        )}
      </Card>

      {report && (
        <Card className="space-y-3">
          <div className="text-sm font-semibold">Результат восстановления</div>

          <Row label="Реселлеры создано" value={report.resellers.created} tone="success" />
          <Row label="Реселлеры обновлено" value={report.resellers.updated} tone="accent" />
          {report.resellers.errors.length > 0 && (
            <div className="rounded-xl bg-red-500/10 p-3">
              <div className="text-xs font-semibold text-red-600">
                Реселлеры — ошибки ({report.resellers.errors.length})
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-red-600/90">
                {report.resellers.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    tg:{e.telegramId} — {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Row label="Клиенты создано" value={report.clients.created} tone="success" />
          <Row
            label="Клиенты уже были"
            value={report.clients.skippedExisting}
            tone="neutral"
          />
          <Row
            label="Без реселлера"
            value={report.clients.skippedUnknownReseller}
            tone="warn"
          />
          {report.clients.errors.length > 0 && (
            <div className="rounded-xl bg-red-500/10 p-3">
              <div className="text-xs font-semibold text-red-600">
                Клиенты — ошибки ({report.clients.errors.length})
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-red-600/90">
                {report.clients.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    {e.username} — {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Row
            label="Squad mapping применено"
            value={report.squadMappings.applied}
            tone="accent"
          />
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warn' | 'accent' | 'neutral';
}) {
  const toneCls = {
    success: 'bg-emerald-500/10 text-emerald-600',
    warn: 'bg-amber-500/10 text-amber-600',
    accent: 'bg-tg-button/10 text-tg-button',
    neutral: 'bg-tg-hint/10 text-tg-hint',
  }[tone];
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${toneCls}`}
      >
        {value}
      </span>
    </div>
  );
}
