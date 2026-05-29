interface Props {
  items: string[];
  onPick: (s: string) => void;
  disabled?: boolean;
}

// Chips clicáveis de sugestões rápidas.
export function QuickSuggestions({ items, onPick, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-full border border-vortex-border bg-vortex-bg/60 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
