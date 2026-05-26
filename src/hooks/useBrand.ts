import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { hexToHslVar, isValidHex } from '@/lib/color';

const DEFAULTS = {
  primary: '83 76% 56%', // lime
  accent: '262 91% 76%', // violet
};

// Aplica as cores da campanha (CSS vars --primary / --accent) ao <html>.
// Reverte aos defaults quando não houver branding ou na ausência de sessão.
export function useBrandSync(): void {
  const session = useAuthStore((s) => s.session);
  const primary = session?.campaign?.brand_primary_hex;
  const secondary = session?.campaign?.brand_secondary_hex;

  useEffect(() => {
    const root = document.documentElement;
    if (primary && isValidHex(primary)) {
      const v = hexToHslVar(primary);
      if (v) root.style.setProperty('--primary', v);
    } else {
      root.style.setProperty('--primary', DEFAULTS.primary);
    }
    if (secondary && isValidHex(secondary)) {
      const v = hexToHslVar(secondary);
      if (v) root.style.setProperty('--accent', v);
    } else {
      root.style.setProperty('--accent', DEFAULTS.accent);
    }
  }, [primary, secondary]);
}

export function useBrand() {
  const session = useAuthStore((s) => s.session);
  const campaign = session?.campaign ?? null;
  return {
    logoUrl: campaign?.brand_logo_url ?? null,
    primaryHex: campaign?.brand_primary_hex ?? null,
    secondaryHex: campaign?.brand_secondary_hex ?? null,
    slogan: campaign?.slogan ?? null,
    candidateName: campaign?.candidate_name ?? null,
  };
}
