import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  module: string;
  description: string;
}

export function PlaceholderPage({ title, module, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Construction className="h-7 w-7 text-primary" />
        </div>
        <p className="text-xs uppercase tracking-widest text-primary">{module}</p>
        <h2 className="mt-2 font-display text-3xl tracking-wide text-foreground">{title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
