import {
  Sparkles,
  Bot,
  BrainCircuit,
  Zap,
  Wind,
  Atom,
  Star,
  Twitter,
  Newspaper,
  Megaphone,
  Search,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { IntegrationSafe, IntegrationType } from '@/types';
import type { IntegrationSpec } from '@/data/integration-catalog';

const ICONS: Record<IntegrationType, LucideIcon> = {
  anthropic: Sparkles,
  openai: Bot,
  gemini: BrainCircuit,
  mistral: Wind,
  groq: Zap,
  xai: Star,
  deepseek: Atom,
  twitter: Twitter,
  google_news: Newspaper,
  meta_ads: Megaphone,
  google_ads: Search,
  whatsapp: MessageCircle,
};

interface Props {
  spec: IntegrationSpec;
  integration: IntegrationSafe | null;
  onConfigure: () => void;
}

export function IntegrationCard({ spec, integration, onConfigure }: Props) {
  const Icon = ICONS[spec.type];
  const isSoon = spec.status === 'soon';
  const connected = integration?.is_enabled && integration.has_secret;

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border bg-vortex-surface/60 p-5 backdrop-blur transition-colors ${
        connected ? 'border-primary/30' : 'border-vortex-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${spec.brand}22`, color: spec.brand }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{spec.name}</p>
            <p className="text-xs text-muted-foreground">{spec.category}</p>
          </div>
        </div>
        {isSoon ? (
          <Badge variant="outline" className="shrink-0">
            <Clock className="mr-1 h-3 w-3" /> Em breve
          </Badge>
        ) : connected ? (
          <Badge variant="success" className="shrink-0">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Conectada
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            <Plug className="mr-1 h-3 w-3" /> Desconectada
          </Badge>
        )}
      </div>

      <p className="text-sm text-foreground/80">{spec.description}</p>

      {integration?.last_test_at ? (
        <div className="flex items-start gap-2 rounded-lg border border-vortex-border bg-vortex-bg/40 p-2 text-xs">
          {integration.last_test_ok ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
          )}
          <div className="min-w-0">
            <p className={integration.last_test_ok ? 'text-emerald-300' : 'text-red-300'}>
              {integration.last_test_message ??
                (integration.last_test_ok ? 'Conexão OK' : 'Falha na conexão')}
            </p>
            <p className="text-muted-foreground">
              Testada{' '}
              {formatDistanceToNow(new Date(integration.last_test_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex gap-2 pt-2">
        <Button
          variant={connected ? 'outline' : 'default'}
          size="sm"
          className="flex-1"
          onClick={onConfigure}
          disabled={isSoon}
        >
          {isSoon ? 'Em breve' : connected ? 'Reconfigurar' : 'Configurar'}
        </Button>
        {spec.docsUrl ? (
          <Button asChild variant="ghost" size="sm">
            <a href={spec.docsUrl} target="_blank" rel="noreferrer">
              Docs
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
