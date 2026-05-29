import { useRef, useState } from 'react';
import { Upload, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Galeria gratuita (pravatar.cc) — retratos estáveis e hotlinkáveis.
const STOCK_AVATARS = [
  'https://i.pravatar.cc/240?img=12',
  'https://i.pravatar.cc/240?img=13',
  'https://i.pravatar.cc/240?img=5',
  'https://i.pravatar.cc/240?img=33',
  'https://i.pravatar.cc/240?img=8',
  'https://i.pravatar.cc/240?img=47',
  'https://i.pravatar.cc/240?img=15',
  'https://i.pravatar.cc/240?img=60',
  'https://i.pravatar.cc/240?img=24',
  'https://i.pravatar.cc/240?img=68',
];

const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  value: string;
  onChange: (url: string) => void;
  userId: string | null;
  agentKey: string;
}

// Seletor de foto do agente: galeria de fotos gratuitas + upload + URL manual.
export function AgentPhotoPicker({ value, onChange, userId, agentKey }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!userId) {
      toast.error('Sessão inválida.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo maior que 2MB.');
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
      const path = `${userId}/agent-${agentKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success('Foto enviada. Clique em "Salvar configurações" para confirmar.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {STOCK_AVATARS.map((url) => {
          const selected = value === url;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              title="Usar esta foto"
              className={cn(
                'relative aspect-square overflow-hidden rounded-full border-2 transition-colors',
                selected ? 'border-primary' : 'border-transparent hover:border-vortex-border',
              )}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              {selected ? (
                <span className="absolute inset-0 flex items-center justify-center bg-primary/40">
                  <Check className="h-4 w-4 text-white" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Enviar foto
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <span className="text-[11px] text-muted-foreground">JPG/PNG até 2MB</span>
      </div>

      <Input
        placeholder="ou cole uma URL de imagem…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
