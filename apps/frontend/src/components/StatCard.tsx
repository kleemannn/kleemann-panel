import { ReactNode } from 'react';
import { Card } from './ui/Card';

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-tg-hint">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {hint && <span className="text-xs text-tg-hint">{hint}</span>}
    </Card>
  );
}
