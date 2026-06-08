// ============================================================================
// homeRoute — fonte única da "home" do usuário baseado no role.
// ----------------------------------------------------------------------------
// Usado por TODOS os pontos do app que precisam decidir pra onde mandar o user
// quando não há um destino explícito (login, troca de senha, rota negada,
// fallback do `/`). Mantido aqui pra evitar lógica duplicada — se mudar a
// matriz de roles, muda só este arquivo e todos os call-sites se adaptam.
//
// Call-sites atuais:
//   • src/components/layout/ProtectedRoute.tsx — `fallbackHome` em redirects
//     de role negado
//   • src/App.tsx — `<HomeRedirect />` que decide `/` por role
//   • src/pages/TrocarSenha.tsx — pra onde mandar depois de trocar senha
//   • src/pages/AguardandoAtivacao.tsx — guard defensivo quando o user
//     já tem campanha
//
// Regra atual:
//   • supporter → /minha-rede  (não pode acessar /dashboard)
//   • leader    → /agenda      (não pode acessar /dashboard)
//   • demais    → /dashboard   (admin, candidate, coordinator, researcher,
//                                field_agent — todos têm acesso)
// ============================================================================

import type { UserRole } from '@/types';

export function resolveHomeRoute(role: UserRole | null | undefined): string {
  if (role === 'supporter') return '/minha-rede';
  if (role === 'leader') return '/agenda';
  return '/dashboard';
}
