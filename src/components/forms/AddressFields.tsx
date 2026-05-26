import { useEffect } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCEP, useViaCEP } from '@/hooks/useViaCEP';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';

export interface AddressValue {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  neighborhood: string | null;
  city: string | null;
  municipality_code: string | null;
}

interface Props {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  /**
   * Quando true, o município é considerado obrigatório. Vai junto com o
   * MunicipalityCombobox que o pai renderiza ANTES desse componente.
   */
  municipalityRequired?: boolean;
}

// Helper interno: o autocomplete via ViaCEP só preenche se o campo no form
// estiver vazio — não sobrescrevemos o que o usuário digitou.
function preferUserValue(current: string | null, fromCep: string | undefined): string | null {
  if (current && current.trim()) return current;
  return fromCep ?? null;
}

export function AddressFields({ value, onChange }: Props) {
  const cepResult = useViaCEP(value.cep ?? '');

  // Quando o ViaCEP retorna, preenche o que o usuário ainda não tocou e,
  // se o município bater pelo IBGE, sincroniza o municipality_code.
  useEffect(() => {
    if (!cepResult.data) return;
    const fromCep = cepResult.data;
    // ibge no ViaCEP é o código IBGE do município. Só usa se for de MG (31xxxxx).
    const muniFromCep =
      fromCep.ibge && fromCep.ibge.startsWith('31') ? fromCep.ibge : null;

    const muniExistsInList = muniFromCep
      ? MG_MUNICIPALITIES.some((m) => m.code === muniFromCep)
      : false;

    onChange({
      ...value,
      logradouro: preferUserValue(value.logradouro, fromCep.logradouro),
      neighborhood: preferUserValue(value.neighborhood, fromCep.bairro),
      complemento: preferUserValue(value.complemento, fromCep.complemento),
      city: preferUserValue(value.city, fromCep.localidade),
      municipality_code:
        value.municipality_code || (muniExistsInList ? muniFromCep : value.municipality_code),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepResult.data]);

  function update<K extends keyof AddressValue>(key: K, v: AddressValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cep">CEP</Label>
          <div className="relative">
            <Input
              id="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              value={value.cep ?? ''}
              onChange={(e) => update('cep', formatCEP(e.target.value))}
              placeholder="00000-000"
              maxLength={9}
            />
            {cepResult.loading ? (
              <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : cepResult.data ? (
              <MapPin className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            ) : null}
          </div>
          {cepResult.error ? (
            <p className="text-[11px] text-red-300">{cepResult.error}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Preenche rua e bairro automaticamente.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="numero">Número</Label>
          <Input
            id="numero"
            inputMode="numeric"
            value={value.numero ?? ''}
            onChange={(e) => update('numero', e.target.value)}
            placeholder="123"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="logradouro">Logradouro</Label>
        <Input
          id="logradouro"
          value={value.logradouro ?? ''}
          onChange={(e) => update('logradouro', e.target.value)}
          placeholder="Rua, avenida, travessa…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            value={value.neighborhood ?? ''}
            onChange={(e) => update('neighborhood', e.target.value)}
            placeholder="Ex: Savassi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input
            id="complemento"
            value={value.complemento ?? ''}
            onChange={(e) => update('complemento', e.target.value)}
            placeholder="Apto, casa, fundos…"
          />
        </div>
      </div>
    </div>
  );
}
