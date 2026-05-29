import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { cn } from '@/lib/utils';
import type { AgentMessage } from '@/lib/agents/agentChat';

interface Props {
  message: AgentMessage;
  agentName: string;
  agentAvatar?: string | null;
}

// Bolha de mensagem do chat (usuário à direita, agente à esquerda com avatar).
export function ChatMessage({ message, agentName, agentAvatar }: Props) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex items-start gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser ? <AgentAvatar url={agentAvatar} name={agentName} size={32} /> : null}
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
          isUser
            ? 'bg-primary/15 text-foreground'
            : 'border border-vortex-border bg-vortex-surface/60 text-foreground/90',
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
