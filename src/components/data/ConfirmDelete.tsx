import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConfirmDeleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  /** Texto do botão de confirmação. Default: "Excluir". */
  confirmLabel?: string;
  /** Se preenchido, exige digitar exatamente este texto pra liberar o botão. */
  requireText?: string;
}

export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Excluir',
  requireText,
}: ConfirmDeleteProps) {
  const [typed, setTyped] = useState('');
  // Zera o campo quando abre/fecha.
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const canConfirm = !requireText || typed.trim() === requireText.trim();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-vortex-border bg-vortex-surface p-6 shadow-2xl">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogPrimitive.Title className="text-base font-semibold text-foreground">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>

          {requireText ? (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Pra confirmar, digite <span className="font-medium text-foreground">{requireText}</span>:
              </p>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireText}
                autoFocus
              />
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!canConfirm}
              onClick={() => {
                if (!canConfirm) return;
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
