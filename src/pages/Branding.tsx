import { useEffect, useRef, useState } from 'react';
import {
  Palette,
  Upload,
  Save,
  Loader2,
  RotateCcw,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { hexToHslVar, isValidHex } from '@/lib/color';
import { VorticeLogo } from '@/components/brand/VorticeLogo';

const DEFAULT_PRIMARY = '#A3E635';
const DEFAULT_SECONDARY = '#A78BFA';
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

export default function BrandingPage() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slogan, setSlogan] = useState('');
  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [secondary, setSecondary] = useState(DEFAULT_SECONDARY);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!session?.campaign) return;
    setSlogan(session.campaign.slogan ?? '');
    setPrimary(session.campaign.brand_primary_hex ?? DEFAULT_PRIMARY);
    setSecondary(session.campaign.brand_secondary_hex ?? DEFAULT_SECONDARY);
    setLogoUrl(session.campaign.brand_logo_url ?? null);
  }, [session?.campaign?.id]);

  if (!session?.campaign) return null;
  const campaignId = session.campaign.id;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Arquivo maior que 2MB. Reduza ou comprima.');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `${campaignId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success('Logo enviado. Clique em Salvar para aplicar.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeLogo() {
    setLogoUrl(null);
    toast.info('Logo removido. Clique em Salvar para aplicar.');
  }

  async function save() {
    if (!session?.campaign) return;
    if (primary && !isValidHex(primary)) {
      toast.error('Cor primária inválida.');
      return;
    }
    if (secondary && !isValidHex(secondary)) {
      toast.error('Cor secundária inválida.');
      return;
    }

    setSaving(true);
    try {
      const patch = {
        slogan: slogan.trim() || null,
        brand_primary_hex: primary === DEFAULT_PRIMARY ? null : primary,
        brand_secondary_hex: secondary === DEFAULT_SECONDARY ? null : secondary,
        brand_logo_url: logoUrl,
      };
      const { error } = await supabase
        .from('campaigns')
        .update(patch)
        .eq('id', campaignId);
      if (error) {
        toast.error(error.message);
        return;
      }
      // Atualiza a session local para refletir imediatamente
      setSession({
        ...session,
        campaign: { ...session.campaign, ...patch },
      });
      toast.success('Identidade da campanha salva.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSlogan('Estratégia que move eleições.');
    setPrimary(DEFAULT_PRIMARY);
    setSecondary(DEFAULT_SECONDARY);
    setLogoUrl(null);
  }

  const primaryHsl = hexToHslVar(primary);
  const secondaryHsl = hexToHslVar(secondary);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-primary">Identidade</span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Branding da campanha
          </h2>
          <p className="text-sm text-muted-foreground">
            Aplique a logo, cores e slogan próprios do candidato. Aparecem no app inteiro,
            menos na tela de login (que é da plataforma Vórtice).
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Voltar ao padrão Vórtice
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Logo */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Logo
            </CardTitle>
            <CardDescription>PNG, JPG, SVG ou WebP — até 2MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-vortex-border bg-vortex-bg/40">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo atual"
                  className="max-h-32 max-w-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <VorticeLogo size={56} />
                  <p className="mt-2 text-xs text-muted-foreground">Usando logo padrão Vórtice</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Enviando…' : 'Enviar logo'}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-300 hover:text-red-200"
                  onClick={removeLogo}
                >
                  Remover
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
            <p className="text-[11px] text-muted-foreground">
              Use fundo transparente sempre que possível. Proporção quadrada renderiza melhor.
            </p>
          </CardContent>
        </Card>

        {/* Cores */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-vortex-violet" />
              Cores
            </CardTitle>
            <CardDescription>
              Aplicadas em botões, gráficos e destaques. Use cores com bom contraste sobre fundo
              escuro.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              label="Cor primária"
              value={primary}
              onChange={setPrimary}
              defaultValue={DEFAULT_PRIMARY}
            />
            <ColorField
              label="Cor secundária"
              value={secondary}
              onChange={setSecondary}
              defaultValue={DEFAULT_SECONDARY}
            />

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="slogan">Slogan</Label>
              <Textarea
                id="slogan"
                rows={2}
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ex: A força que move a mudança."
              />
              <p className="text-[11px] text-muted-foreground">
                Frase exibida em telas internas (não no login da plataforma).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-400" /> Pré-visualização
          </CardTitle>
          <CardDescription>
            Como vai aparecer no app. Cores aplicam ao salvar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur"
            style={{
              ['--preview-primary' as string]: primaryHsl ?? undefined,
              ['--preview-accent' as string]: secondaryHsl ?? undefined,
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-12 w-12 object-contain" />
              ) : (
                <VorticeLogo size={48} />
              )}
              <div>
                <p className="font-display text-2xl tracking-wide text-foreground">
                  {session.campaign.candidate_name}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  {slogan || 'Sem slogan ainda'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <span
                className="rounded-md px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: primary,
                  color: getContrastText(primary),
                }}
              >
                Botão primário
              </span>
              <span
                className="rounded-md px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: `${secondary}26`,
                  color: secondary,
                  border: `1px solid ${secondary}66`,
                }}
              >
                Destaque secundário
              </span>
              <span
                className="rounded-md border border-vortex-border px-4 py-2 text-sm text-foreground"
              >
                Botão neutro
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <PreviewSwatch label="Primária" hex={primary} />
              <PreviewSwatch label="Secundária" hex={secondary} />
              <PreviewSwatch label="Background" hex="#0A0F1E" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="lg" onClick={save} disabled={saving} className="shadow-xl">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando…' : 'Salvar identidade'}
        </Button>
      </div>
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
}

function ColorField({ label, value, onChange, defaultValue }: ColorFieldProps) {
  const isDefault = value.toLowerCase() === defaultValue.toLowerCase();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {isDefault ? <Badge variant="outline">Padrão</Badge> : null}
      </div>
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <input
            type="color"
            value={isValidHex(value) ? value : defaultValue}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-md border border-vortex-border bg-transparent"
            aria-label={`${label} (color picker)`}
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultValue}
        />
      </div>
    </div>
  );
}

function PreviewSwatch({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-vortex-border bg-vortex-bg/60 p-2 text-xs">
      <div
        className="h-6 w-6 shrink-0 rounded-md border border-white/10"
        style={{ backgroundColor: hex }}
      />
      <div className="min-w-0">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-mono text-foreground">{hex}</p>
      </div>
    </div>
  );
}

// Decide texto preto/branco com base no brilho do fundo
function getContrastText(hex: string): string {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length !== 6) return '#000';
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#0A0F1E' : '#FFFFFF';
}
