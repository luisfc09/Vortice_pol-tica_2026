interface MapLegendProps {
  scale: { color: string; label: string }[];
}

export function MapLegend({ scale }: MapLegendProps) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/80 p-3 text-xs backdrop-blur">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">
        Força política
      </p>
      <div className="space-y-1.5">
        {scale.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border border-white/10"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-foreground/90">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
