import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Monta deep link `https://wa.me/{ddi+ddd+num}` a partir de um telefone com
 * ou sem máscara. Adiciona DDI 55 (Brasil) quando vier sem.
 *
 *   "(31) 99999-9999"   → "https://wa.me/553199999999"
 *   "+55 31 9 9999-9999" → "https://wa.me/5531999999999"
 *   "abc"               → null (muito curto)
 */
export function whatsappLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Se já tem DDI (12+ dígitos), assume ok; senão prepend 55
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return `https://wa.me/${digits}`;
}

/**
 * Constrói URL do perfil de rede social a partir de plataforma + handle.
 * Aceita handle no formato `@usuario`, `usuario` ou URL completa
 * (`https://...`). Quando `handle` já é URL, retorna como veio.
 * Plataforma `outro` sem URL completa retorna `null` (não há base conhecida).
 */
export function socialUrl(
  platform: string | null | undefined,
  handle: string | null | undefined,
): string | null {
  if (!platform || !handle) return null;
  const h = handle.trim();
  if (!h) return null;
  if (h.startsWith('http://') || h.startsWith('https://')) return h;
  const username = h.startsWith('@') ? h.slice(1) : h;
  if (!username) return null;
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${username}`;
    case 'facebook':
      return `https://facebook.com/${username}`;
    case 'x':
      return `https://x.com/${username}`;
    case 'tiktok':
      return `https://tiktok.com/@${username}`;
    case 'linkedin':
      return `https://linkedin.com/in/${username}`;
    case 'youtube':
      return `https://youtube.com/@${username}`;
    default:
      return null;
  }
}
