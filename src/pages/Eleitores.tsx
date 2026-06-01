// Página /eleitores — wrapper enxuto que renderiza o VotersPanel.
// A lógica completa (filtros, CRUD, import/export, geocode) mora em
// src/components/voters/VotersPanel.tsx para também ser reusada no modo
// "Eleitores" do Mapa Eleitoral.

import { VotersPanel } from '@/components/voters/VotersPanel';

export default function EleitoresPage() {
  return <VotersPanel />;
}
