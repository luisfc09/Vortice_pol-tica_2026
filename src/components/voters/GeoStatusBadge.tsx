import { Satellite, Home, Building2, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeoAccuracy } from '@/lib/geocode';

interface Props {
  accuracy: GeoAccuracy | null;
  className?: string;
}

const META: Record<GeoAccuracy, { label: string; cls: string; Icon: typeof Satellite }> = {
  gps: {
    label: 'Localização precisa (GPS)',
    cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    Icon: Satellite,
  },
  address: {
    label: 'Localização via endereço',
    cls: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    Icon: Home,
  },
  cep: {
    label: 'Localização via endereço',
    cls: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    Icon: Home,
  },
  city: {
    label: 'Localização aproximada (cidade)',
    cls: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    Icon: Building2,
  },
};

// Selo visual do nível de precisão das coordenadas de um eleitor.
export function GeoStatusBadge({ accuracy, className }: Props) {
  if (!accuracy) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs text-red-300',
          className,
        )}
      >
        <MapPinOff className="h-3.5 w-3.5" /> Sem localização
      </span>
    );
  }
  const m = META[accuracy];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
        m.cls,
        className,
      )}
    >
      <m.Icon className="h-3.5 w-3.5" /> {m.label}
    </span>
  );
}
