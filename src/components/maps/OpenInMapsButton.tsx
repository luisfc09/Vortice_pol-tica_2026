import { Navigation } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { isMappable, mapsUrl, type MapsTarget } from '@/lib/maps';

interface Props extends Omit<ButtonProps, 'asChild' | 'onClick'> {
  target: MapsTarget;
  mode?: 'search' | 'directions';
  label?: string;
}

/**
 * Botão que abre o Google Maps em nova aba. Em mobile com o app instalado,
 * o link `https://www.google.com/maps/dir/...` abre direto no app.
 *
 * Fica `disabled` quando não há coordenadas nem endereço utilizável.
 */
export function OpenInMapsButton({
  target,
  mode = 'directions',
  label,
  variant = 'ghost',
  size = 'sm',
  className,
  ...rest
}: Props) {
  const url = mapsUrl(target, mode);
  const text = label ?? (mode === 'directions' ? 'Como chegar' : 'Ver no Maps');

  if (!isMappable(target) || !url) {
    return (
      <Button variant={variant} size={size} className={className} disabled {...rest}>
        <Navigation className="h-3.5 w-3.5" />
        {text}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} asChild {...rest}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Navigation className="h-3.5 w-3.5" />
        {text}
      </a>
    </Button>
  );
}
