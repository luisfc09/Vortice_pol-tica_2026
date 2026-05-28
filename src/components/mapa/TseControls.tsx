import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TseCombinacao } from '@/lib/tseApi';

export function comboKey(c: { ano: number; cargo_codigo: string; turno: number }): string {
  return `${c.ano}-${c.cargo_codigo}-${c.turno}`;
}

function comboLabel(c: TseCombinacao): string {
  const turnoTxt = c.turno === 2 ? ' · 2º turno' : '';
  return `${c.ano} · ${c.cargo_label}${turnoTxt}`;
}

interface TseControlsProps {
  combinacoes: TseCombinacao[];
  value: string | null;
  onChange: (key: string) => void;
  loading?: boolean;
}

export function TseControls({ combinacoes, value, onChange, loading }: TseControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Eleição
      </label>
      <Select value={value ?? undefined} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="w-[300px] max-w-full">
          <SelectValue
            placeholder={loading ? 'Carregando eleições…' : 'Selecione ano e cargo'}
          />
        </SelectTrigger>
        <SelectContent>
          {combinacoes.map((c) => (
            <SelectItem key={comboKey(c)} value={comboKey(c)}>
              {comboLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value ? (
        <span className="text-xs text-muted-foreground">
          {combinacoes.find((c) => comboKey(c) === value)?.municipios ?? 0} municípios com dado
        </span>
      ) : null}
    </div>
  );
}
