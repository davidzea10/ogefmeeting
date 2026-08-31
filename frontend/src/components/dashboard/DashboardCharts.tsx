import { Card, CardContent } from '@/components/ui/Card';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export function StatCard({
  icon: Icon,
  title,
  value,
  meta,
  loading,
  href,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  value: number | undefined;
  meta: string;
  loading?: boolean;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link to={href} className="block">
      <Card className={accent ? 'border-ogefrem-blue/40 ring-1 ring-ogefrem-blue/20' : ''}>
        <CardContent className="flex items-start gap-3 pt-5">
          <div className="rounded-lg bg-ogefrem-blue/10 p-2.5 text-ogefrem-blue">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-muted">{title}</p>
            <p className="text-2xl font-bold text-text">
              {loading ? '…' : (value ?? '—')}
            </p>
            <p className="truncate text-xs text-text-muted">{meta}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function BarRow({
  label,
  value,
  max,
  color,
  href,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  href?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const inner = (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span className="font-semibold text-text">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
          role="img"
          aria-label={`${label} : ${value}`}
        />
      </div>
    </div>
  );
  if (href) {
    return (
      <Link to={href} className="block rounded-lg transition-colors hover:bg-surface-muted/60">
        {inner}
      </Link>
    );
  }
  return inner;
}
