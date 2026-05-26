import type { Campaign, Profile, SessionUser, UserRole } from '@/types';

export const MOCK_CAMPAIGN: Campaign = {
  id: 'campaign-mock-1',
  name: 'Coligação MG 2026',
  candidate_name: 'Maria Andrade',
  party: 'Partido Exemplo',
  party_number: '99',
  state: 'MG',
  office: 'Governador',
  election_year: 2026,
  logo_url: null,
  vote_target: 350_000,
  slogan: 'Estratégia que move eleições.',
  status: 'active',
  trial_ends_at: null,
  notes: null,
  brand_logo_url: null,
  brand_primary_hex: null,
  brand_secondary_hex: null,
  created_at: new Date().toISOString(),
};

export const MOCK_PROFILE: Profile = {
  id: 'user-mock-1',
  full_name: 'Coordenador de Teste',
  phone: '(31) 99999-0000',
  avatar_url: null,
  municipality_code: '3106200',
  must_change_password: false,
  created_at: new Date().toISOString(),
};

export const MOCK_CREDENTIALS = {
  admin: { email: 'admin@vortice.app', password: 'vortice2026' },
  field: { email: 'campo@vortice.app', password: 'vortice2026' },
};

export function buildMockSession(role: UserRole = 'admin'): SessionUser {
  return {
    id: MOCK_PROFILE.id,
    email: role === 'field_agent' ? MOCK_CREDENTIALS.field.email : MOCK_CREDENTIALS.admin.email,
    profile: { ...MOCK_PROFILE, full_name: role === 'field_agent' ? 'Agente de Campo' : MOCK_PROFILE.full_name },
    campaign: MOCK_CAMPAIGN,
    role,
    is_super_admin: role === 'admin',
  };
}

export function resolveMockLogin(
  email: string,
  password: string,
): SessionUser | null {
  if (
    email === MOCK_CREDENTIALS.admin.email &&
    password === MOCK_CREDENTIALS.admin.password
  ) {
    return buildMockSession('admin');
  }
  if (
    email === MOCK_CREDENTIALS.field.email &&
    password === MOCK_CREDENTIALS.field.password
  ) {
    return buildMockSession('field_agent');
  }
  return null;
}
