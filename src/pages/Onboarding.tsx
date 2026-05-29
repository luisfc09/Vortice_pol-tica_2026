import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Target,
  MapPin,
  Upload,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  X,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { VorticeLogo } from '@/components/brand/VorticeLogo';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import { collections } from '@/lib/data';
import { parseCsv, pickField } from '@/lib/csv-import';
import { exportToCsv } from '@/lib/csv-export';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';

const STEPS = ['Boas-vindas', 'Meta de votos', 'Municípios-alvo', 'Lideranças', 'Concluir'];

export default function OnboardingPage() {
  const session = useEffectiveSession();
  const realSession = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const campaign = session?.campaign ?? null;
  const [step, setStep] = useState(0);
  const [voteTarget, setVoteTarget] = useState(() => String(campaign?.vote_target ?? 0));
  const [muniCodes, setMuniCodes] = useState<string[]>(
    () => campaign?.target_municipalities ?? [],
  );
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; skip: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of MG_MUNICIPALITIES) m.set(x.code, x.name);
    return m;
  }, []);

  if (!session) return <Navigate to="/login" replace />;
  if (!campaign) return <Navigate to="/dashboard" replace />;
  const campaignId = campaign.id;

  function addMuni(code: string) {
    if (!code) return;
    setMuniCodes((arr) => (arr.includes(code) ? arr : [...arr, code]));
  }
  function removeMuni(code: string) {
    setMuniCodes((arr) => arr.filter((c) => c !== code));
  }

  function baixarModelo() {
    exportToCsv(
      'modelo-liderancas',
      [
        {
          Nome: 'Maria Souza',
          Telefone: '(31) 99999-0000',
          Email: 'maria@exemplo.com',
          Cidade: 'Belo Horizonte',
          Bairro: 'Savassi',
          Papel: 'Liderança comunitária',
        },
      ],
      [
        { header: 'Nome', value: (r) => r.Nome },
        { header: 'Telefone', value: (r) => r.Telefone },
        { header: 'Email', value: (r) => r.Email },
        { header: 'Cidade', value: (r) => r.Cidade },
        { header: 'Bairro', value: (r) => r.Bairro },
        { header: 'Papel', value: (r) => r.Papel },
      ],
    );
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !realSession) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      let ok = 0;
      let skip = 0;
      for (const r of rows) {
        const name = pickField(r, 'Nome', 'name');
        if (!name) {
          skip++;
          continue;
        }
        await collections.supporters.create({
          data: {
            campaign_id: campaignId,
            created_by: realSession.id,
            name,
            cpf: null,
            phone: pickField(r, 'Telefone', 'phone', 'celular') || null,
            email: pickField(r, 'Email', 'e-mail') || null,
            city: pickField(r, 'Cidade', 'city') || null,
            neighborhood: pickField(r, 'Bairro', 'neighborhood') || null,
            municipality_code: null,
            cep: null,
            logradouro: null,
            numero: null,
            complemento: null,
            role: 'outro',
            role_custom: pickField(r, 'Papel', 'cargo', 'role') || null,
            status: 'ativo',
          },
        });
        ok++;
      }
      setImportResult({ ok, skip });
      toast.success(
        `${ok} liderança${ok === 1 ? '' : 's'} importada${ok === 1 ? '' : 's'}.` +
          (skip ? ` ${skip} linha(s) sem nome ignorada(s).` : ''),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao importar o CSV.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function persist(patch: Record<string, unknown>) {
    const { error } = await supabase.from('campaigns').update(patch).eq('id', campaignId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (realSession?.campaign && realSession.campaign.id === campaignId) {
      setSession({ ...realSession, campaign: { ...realSession.campaign, ...patch } });
    }
    return true;
  }

  async function finish() {
    setSaving(true);
    try {
      const ok = await persist({
        vote_target: Number(voteTarget.replace(/\D/g, '')) || 0,
        target_municipalities: muniCodes.length ? muniCodes : null,
        onboarding_completed: true,
      });
      if (!ok) return;
      toast.success('Configuração concluída! 🚀');
      navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    try {
      const ok = await persist({ onboarding_completed: true });
      if (ok) navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-vortex-surface/60">
            <VorticeLogo size={28} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Configuração inicial</p>
            <h2 className="font-display text-2xl tracking-wide text-foreground">
              Vamos preparar a campanha
            </h2>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void skip()} disabled={saving}>
          Pular por agora
        </Button>
      </div>

      {/* Stepper */}
      <ol className="flex gap-1">
        {STEPS.map((t, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'pending';
          return (
            <li
              key={t}
              className={
                'flex-1 rounded-md border px-2 py-1.5 text-center text-[11px] font-medium ' +
                (state === 'active'
                  ? 'border-primary bg-primary/10 text-primary'
                  : state === 'done'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground')
              }
            >
              {i + 1}. {t}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-5">
        {step === 0 ? (
          <div className="space-y-3 text-sm text-foreground/90">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-display text-lg tracking-wide text-foreground">
                Bem-vindo(a) ao Vórtice
              </p>
            </div>
            <p>
              Em 3 passos rápidos você define a <strong>meta de votos</strong>, os{' '}
              <strong>municípios-alvo</strong> e pode <strong>importar suas lideranças</strong> de
              uma planilha. Dá pra pular qualquer passo e ajustar depois.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">Qual a meta de votos da campanha?</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta">Meta de votos</Label>
              <Input
                id="meta"
                inputMode="numeric"
                value={voteTarget}
                onChange={(e) => setVoteTarget(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex.: 70000"
              />
              <p className="text-xs text-muted-foreground">
                Usada nas metas do Dashboard e nos relatórios. Você pode mudar depois.
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">Municípios-alvo</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Onde a campanha vai concentrar esforços. Adicione quantos quiser.
            </p>
            <MunicipalityCombobox value="" onChange={(code) => addMuni(code)} placeholder="Buscar e adicionar município…" />
            {muniCodes.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {muniCodes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full border border-vortex-border bg-vortex-surface px-2.5 py-1 text-xs text-foreground"
                  >
                    {nameByCode.get(code) ?? code}
                    <button
                      type="button"
                      onClick={() => removeMuni(code)}
                      aria-label="Remover"
                      className="text-muted-foreground hover:text-red-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum município adicionado ainda.</p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">Importar lideranças (opcional)</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Suba um CSV com as colunas <strong>Nome, Telefone, Email, Cidade, Bairro, Papel</strong>
              {' '}(mesmo formato do export). Linhas sem nome são ignoradas.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={baixarModelo}>
                <Download className="h-4 w-4" /> Baixar modelo
              </Button>
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? 'Importando…' : 'Escolher CSV'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onPickFile}
              />
            </div>
            {importResult ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                <Check className="h-4 w-4" />
                {importResult.ok} importada(s)
                {importResult.skip ? ` · ${importResult.skip} ignorada(s)` : ''}.
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 text-sm text-foreground/90">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <p className="font-display text-lg tracking-wide text-foreground">Tudo pronto!</p>
            </div>
            <ul className="space-y-1">
              <li>• Meta de votos: <strong>{Number(voteTarget || '0').toLocaleString('pt-BR')}</strong></li>
              <li>• Municípios-alvo: <strong>{muniCodes.length}</strong></li>
              {importResult ? <li>• Lideranças importadas: <strong>{importResult.ok}</strong></li> : null}
            </ul>
            <p className="text-muted-foreground">
              Clique em concluir para salvar e ir para o Dashboard. Tudo pode ser ajustado depois.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        {isLast ? (
          <Button onClick={() => void finish()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Salvando…' : 'Concluir configuração'}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
