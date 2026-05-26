import { cn } from '@/lib/utils';

interface FilterPillProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

export function FilterPill({ label, count, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
      {typeof count === 'number' ? ` · ${count}` : ''}
    </button>
  );
}
