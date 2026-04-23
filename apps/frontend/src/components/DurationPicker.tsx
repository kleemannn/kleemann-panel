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
}: {
  state: DurationState;
  onChange: (next: DurationState) => void;
  presetPrefix?: string;
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

      <div className="relative">
        <Icon
          name="calendar"
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tg-hint"
        />
        <input
          type="date"
          min={today}
          value={state.date}
          onChange={(e) => setDate(e.target.value)}
          className={clsx(
            'h-11 w-full rounded-xl bg-tg-secondary pl-10 pr-3.5 text-sm outline-none transition ring-1',
            state.mode === 'date' ? 'ring-tg-button' : 'ring-black/5 focus:ring-tg-button/60',
          )}
        />
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
