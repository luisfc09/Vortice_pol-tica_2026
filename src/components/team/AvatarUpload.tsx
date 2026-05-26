import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { initials, cn } from '@/lib/utils';

interface Props {
  userId: string;
  name: string;
  currentUrl?: string | null;
  canEdit: boolean;
  size?: 'sm' | 'md' | 'lg';
  onUpdated?: (newUrl: string | null) => void;
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
};

const ICON_SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const MAX_BYTES = 2 * 1024 * 1024;

// Avatar com upload inline. Click → seletor de arquivo → upload → update profile.
// canEdit: se false, mostra só a imagem (sem hover de câmera).
export function AvatarUpload({
  userId,
  name,
  currentUrl,
  canEdit,
  size = 'md',
  onUpdated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [urlOverride, setUrlOverride] = useState<string | null>(null);

  const url = urlOverride ?? currentUrl ?? null;
  const hasPhoto = Boolean(url);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo maior que 2MB.');
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = pub.publicUrl;

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: newUrl })
        .eq('id', userId);
      if (dbErr) {
        toast.error(`Upload feito, mas falha ao salvar no perfil: ${dbErr.message}`);
        return;
      }

      setUrlOverride(newUrl);
      onUpdated?.(newUrl);
      toast.success('Foto atualizada.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removePhoto() {
    if (!canEdit || !hasPhoto) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setUrlOverride(null);
      onUpdated?.(null);
      toast.success('Foto removida.');
    } finally {
      setRemoving(false);
    }
  }

  const wrapperClass = cn(
    'relative group',
    canEdit && 'cursor-pointer',
    SIZE_CLASS[size],
  );

  return (
    <div className="flex items-center gap-2">
      <div
        className={wrapperClass}
        onClick={() => canEdit && !uploading && fileInputRef.current?.click()}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? 'Trocar foto' : undefined}
      >
        <Avatar className={cn('ring-1 ring-vortex-border', SIZE_CLASS[size])}>
          {url ? <AvatarImage src={url} alt={name} /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>

        {canEdit ? (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-full transition-opacity',
              uploading
                ? 'bg-black/60 opacity-100'
                : 'bg-black/50 opacity-0 group-hover:opacity-100',
            )}
          >
            {uploading ? (
              <Loader2 className={cn('animate-spin text-white', ICON_SIZE[size])} />
            ) : (
              <Camera className={cn('text-white', ICON_SIZE[size])} />
            )}
          </div>
        ) : null}
      </div>

      {canEdit && hasPhoto && size !== 'sm' ? (
        <button
          type="button"
          onClick={removePhoto}
          disabled={removing}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-vortex-surface hover:text-red-300 disabled:opacity-50"
          aria-label="Remover foto"
          title="Remover foto"
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={pickFile}
      />
    </div>
  );
}
