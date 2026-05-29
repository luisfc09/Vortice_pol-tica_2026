import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  url?: string | null;
  name?: string;
  /** Diâmetro em px. */
  size?: number;
  className?: string;
}

// Avatar circular do agente, com fallback para ícone quando não há foto
// (ou a URL quebra). Reutilizado na config e nos chats.
export function AgentAvatar({ url, name, size = 80, className }: Props) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  const showImg = !!url && !broken;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-vortex-border bg-vortex-surface text-muted-foreground',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={url as string}
          alt={name ?? 'Agente'}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Bot style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }} />
      )}
    </div>
  );
}
