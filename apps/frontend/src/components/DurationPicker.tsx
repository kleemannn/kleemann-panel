import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';

export type DurationMode = 'preset' | 'custom' | 'date';

export interface DurationState {
  mode: DurationMode;
  preset: number;
  custom: string;
  date: string;
}

const PRESETS = [7, 30];

export function DurationPicker({
  state,
  onChange,
  presetPrefix = '',
  baseDate,
}: {
  state: DurationState;
  onChange: (next: DurationState) => void;
  presetPrefix?: string;
  /** Date from which "+N days" is computed for the calendar mode. Defaults to "now". */
  baseDate?: Date;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const setPreset = (d: number) =>
    onChange({ mode: 'preset', preset: d, custom: '', date: '' });

  const setCustom = (v: string) =>
    onChange({
      mode: v ? 'custom' : 'preset',
      preset: state.preset,
      custom: v,
      date: '',
    });

  const setDate = (v: string) =>
    onChange({
      mode: v ? 'date' : 'preset',
      preset: state.preset,
      custom: '',
      date: v,
    });

  const addedFromDate = (() => {
    if (state.mode !== 'date' || !state.date) return null;
    const picked = new Date(`${state.date}T23:59:59`);
    const base = baseDate ?? new Date();
    const days = Math.max(0, Math.round((picked.getTime() - base.getTime()) / 864e5));
    return days;
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((d) => {
          const active = state.mode === 'preset' && state.preset === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setPreset(d)}
              className={clsx(
                'rounded-full px-4 py-2 text-sm font-medium transition ring-1',
                active
                  ? 'bg-tg-button text-tg-buttonText ring-tg-button'
                  : 'bg-tg-secondary text-tg-text ring-black/5 hover:bg-black/[0.03]',
              )}
            >
              {presetPrefix}
              {d} дн.
            </button>
          );
        })}
        <div className="relative flex-1 min-w-[110px]">
          <input
            type="number"
            min={1}
            placeholder="другое"
            value={state.custom}
            onChange={(e) => setCustom(e.target.value)}
            className={clsx(
              'h-10 w-full rounded-full bg-tg-secondary px-4 text-sm outline-none transition ring-1',
              state.mode === 'custom'
                ? 'ring-tg-button'
                : 'ring-black/5 focus:ring-tg-button/60',
            )}
          />
        </div>
      </div>

      <div
        className={clsx(
          'rounded-2xl bg-tg-secondary p-3 ring-1 transition',
          state.mode === 'date' ? 'ring-tg-button' : 'ring-black/5',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={clsx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
                state.mode === 'date'
                  ? 'bg-tg-button/15 text-tg-button'
                  : 'bg-black/[0.04] text-tg-hint',
              )}
            >
              <Icon name="calendar" size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-tg-hint">или до даты</div>
              <input
                type="date"
                min={today}
                value={state.date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-0.5 block w-full bg-transparent text-base font-medium tabular-nums outline-none"
              />
            </div>
          </label>
          {addedFromDate !== null && addedFromDate > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              +{addedFromDate} дн.
            </span>
          )}
          {state.mode === 'date' && state.date && (
            <button
              type="button"
              onClick={() => setDate('')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-tg-hint hover:bg-black/5"
              aria-label="Очистить"
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function resolveDuration(state: DurationState): {
  durationDays: number | null;
  expiresAt: string | null;
} {
  if (state.mode === 'date') {
    if (!state.date) return { durationDays: null, expiresAt: null };
    return { durationDays: null, expiresAt: new Date(`${state.date}T23:59:59`).toISOString() };
  }
  const d = state.mode === 'custom' ? Number(state.custom) : state.preset;
  if (!Number.isFinite(d) || d <= 0) return { durationDays: null, expiresAt: null };
  return { durationDays: d, expiresAt: null };
}
