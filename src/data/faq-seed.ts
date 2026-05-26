import type { FaqCategory, FaqItem } from '@/types';

type FaqSeed = Omit<FaqItem, 'id' | 'campaign_id' | 'created_at' | 'is_active'>;

function item(
  category: FaqCategory,
  question: string,
  suggested_answer: string,
  support_data: string,
  avoid_saying: string,
): FaqSeed {
  return { category, question, suggested_answer, support_data, avoid_saying };
}

// Conteúdo de seed para o FAQ de argumentação política.
// Em produção, lê-se de faq_items no Supabase; em mocks, este array é a fonte.
export const FAQ_SEED: FaqSeed[] = [
  // Segurança
  item(
    'seguranca',
    'O que será feito para reduzir a violência?',
    'Mais policiamento ostensivo, integração com inteligência e foco em facções. Tecnologia (câmeras com IA, monitoramento de áreas críticas) somada à valorização salarial e treinamento das polícias civil e militar.',
    'MG fechou 2024 com queda de homicídios em 12 das 17 RISPs, mas com aumento de crimes patrimoniais em áreas metropolitanas. Investimento per capita em segurança em MG está abaixo da média nacional.',
    'Não prometa "acabar com a violência". Não defenda armamento irrestrito da população. Evite discursos punitivistas sem base em dados.',
  ),
  item(
    'seguranca',
    'Vocês são a favor da liberação de armas?',
    'Defendemos o direito legal de quem cumpre requisitos rigorosos, com mais fiscalização sobre armas ilegais — que são a origem da maioria dos crimes. Foco em desarmar o crime, não em armar a população.',
    'Segundo o Atlas da Violência, mais de 70% dos homicídios em MG são cometidos com armas de fogo, e a maior parte é de origem ilegal.',
    'Não trate o assunto como bandeira ideológica. Não defenda flexibilização sem fiscalização.',
  ),
  item(
    'seguranca',
    'Como combater o tráfico nas periferias?',
    'Atuação integrada: inteligência financeira para sufocar o caixa do crime, ocupação social com creches, esporte e cursos profissionalizantes, e presença permanente do Estado nas comunidades.',
    'Estudos do FBSP mostram que territórios com investimento social sustentado têm queda de até 30% em homicídios em 4 anos.',
    'Não criminalize quem mora na periferia. Não fale em "guerra contra o tráfico" como solução única.',
  ),

  // Saúde
  item(
    'saude',
    'Por que a fila do SUS demora tanto?',
    'Subfinanciamento crônico, gestão fragmentada e falta de regulação efetiva. Vamos reorganizar a Central de Regulação estadual, ampliar mutirões para casos críticos e investir em atenção primária — que resolve 80% das demandas.',
    'MG tem mais de 1,2 milhão de pessoas em fila de cirurgias eletivas (TCE-MG 2024). UBS resolvem cerca de 80% das demandas quando bem estruturadas.',
    'Não prometa "fila zero em 100 dias". Não ataque servidores da saúde — são parte da solução.',
  ),
  item(
    'saude',
    'Vão privatizar o SUS?',
    'Não. O SUS é constitucional, universal e gratuito — e assim deve continuar. Vamos modernizar a gestão e usar parcerias controladas onde a iniciativa privada já complementa o sistema, sempre com indicadores públicos.',
    'O SUS atende mais de 75% da população brasileira como única forma de acesso à saúde.',
    'Não diga que parceria público-privada é privatização. Não confunda complementaridade com terceirização total.',
  ),
  item(
    'saude',
    'E a saúde mental, especialmente dos jovens?',
    'Vamos expandir os CAPS no interior, criar protocolos de acolhimento nas escolas e ampliar o atendimento de psicólogos via telessaúde.',
    'Suicídio é a 4ª maior causa de morte entre brasileiros de 15 a 29 anos (Ministério da Saúde).',
    'Não banalize o tema. Não atribua o problema apenas a redes sociais.',
  ),

  // Emprego
  item(
    'emprego',
    'Como gerar emprego em MG?',
    'Atração de indústria via incentivos vinculados a metas de geração de vagas, qualificação profissional alinhada às vocações regionais (mineração, agro, tecnologia, turismo) e crédito facilitado para MEI e pequenas empresas.',
    'MG fechou 2024 com saldo positivo de 180 mil empregos formais, mas com forte concentração na RMBH (CAGED).',
    'Não prometa número exato de empregos sem fonte. Não atribua emprego só ao governo — quem contrata é o setor produtivo.',
  ),
  item(
    'emprego',
    'O que será feito pelos trabalhadores informais?',
    'Crédito acessível para virar MEI, capacitação gratuita em parceria com Sebrae e Sistema S, e revisão da tributação para reduzir o custo de formalização.',
    'Mais de 40% da força de trabalho em MG é informal (IBGE). Cada MEI ativo gera, em média, 1,3 emprego adicional.',
    'Não trate informalidade como escolha — a maioria é por falta de opção.',
  ),
  item(
    'emprego',
    'Como atrair investimento privado para o interior?',
    'Plano de logística (rodovias, ferrovias, conectividade), incentivos fiscais condicionados a investimento local e segurança jurídica com revisão de marcos regulatórios estaduais.',
    'Cidades do interior crescem 1,8x mais quando há infraestrutura logística adequada (FGV/IBRE).',
    'Não prometa fábrica em cidade específica sem haver memorando firmado.',
  ),

  // Educação
  item(
    'educacao',
    'Como melhorar a educação pública estadual?',
    'Reforço da alfabetização nos anos iniciais, valorização do professor com piso e plano de carreira, escolas em tempo integral nas regiões mais vulneráveis e currículo conectado ao mundo do trabalho.',
    'IDEB de MG no ensino médio caiu de 4,0 (2017) para 3,8 (2023). 67% dos alunos do 3º ano do EM não atingem nível adequado em matemática (Saeb).',
    'Não responsabilize apenas o professor pelos resultados. Não defenda apagar conteúdos sem debate técnico.',
  ),
  item(
    'educacao',
    'Vão acabar com as escolas cívico-militares?',
    'Vamos avaliar caso a caso, com base em resultados de aprendizagem e demanda das comunidades escolares. Onde funciona, mantém-se; onde há problemas, ajusta-se.',
    'Estudos do INEP indicam ganhos de disciplina, mas resultados mistos em aprendizagem entre escolas cívico-militares.',
    'Não trate o tema como bandeira ideológica. Não generalize sucesso ou fracasso.',
  ),
  item(
    'educacao',
    'Como expandir o ensino técnico?',
    'Parcerias com Sistema S e SENAI/SENAC, polos regionais alinhados à vocação produtiva (agro no Triângulo, mineração no Norte, TI na RMBH) e bolsa-permanência para alunos de baixa renda.',
    'Egressos do ensino técnico ganham, em média, 25% a mais que portadores apenas de ensino médio regular (IPEA).',
    'Não confunda ensino técnico com substituição do ensino superior — são caminhos complementares.',
  ),

  // Infraestrutura
  item(
    'infraestrutura',
    'O que será feito pelas estradas de MG?',
    'Plano plurianual de recuperação com priorização por trafegabilidade e impacto econômico, concessões com indicadores rígidos de qualidade e fiscalização social via app público.',
    'MG tem a maior malha rodoviária do país. 58% das estradas estaduais estão em condição regular, ruim ou péssima (CNT 2024).',
    'Não prometa "asfaltar todas as estradas" — irrealista. Não ataque concessões sem propor alternativa.',
  ),
  item(
    'infraestrutura',
    'E o saneamento básico?',
    'Universalizar coleta e tratamento de esgoto até 2033 conforme o Marco do Saneamento, com licitações regionalizadas que viabilizem cidades pequenas e tarifa social para baixa renda.',
    '20% dos domicílios mineiros ainda não têm acesso a esgoto tratado (SNIS 2023).',
    'Não diga que privatização resolve tudo. Não defenda o status quo da Copasa sem ressalvas.',
  ),
  item(
    'infraestrutura',
    'E a falta de internet em comunidades rurais?',
    'Programa estadual de conectividade rural via parceria com operadoras e satélite, priorizando escolas, UBSs e produtores rurais.',
    'Mais de 600 escolas estaduais em MG não têm conexão adequada para uso pedagógico (Educacenso).',
    'Não prometa fibra ótica em todas as cidades — em muitos casos a solução é satélite.',
  ),

  // Política
  item(
    'politica',
    'Você vai apoiar [nome polêmico]?',
    'Nosso compromisso é com a campanha e com os mineiros. Alianças são decididas pelo conjunto da coligação, com critérios programáticos. Não fazemos cálculo de palanque, fazemos cálculo de entrega.',
    '—',
    'Não confirme nem negue apoio a nomes específicos sem alinhamento prévio. Não ataque adversários nominalmente em campo.',
  ),
  item(
    'politica',
    'Por que confiar em mais um político?',
    'Confiança se constrói com entrega. Nossa trajetória mostra [exemplo concreto da carreira do candidato]. Não pedimos voto de fé — pedimos voto de avaliação, pelas propostas e pelo histórico.',
    '—',
    'Não generalize "todo político é igual". Não prometa o que não pode entregar.',
  ),
  item(
    'politica',
    'O que pensa sobre o governo atual?',
    'Respeitamos a vontade dos eleitores que escolheram esse governo. Reconhecemos avanços em áreas específicas e divergimos em outras — sempre com argumentos, não com ataques pessoais.',
    '—',
    'Não personalize o ataque. Concentre nos resultados e propostas.',
  ),

  // Partido
  item(
    'partido',
    'Por que esse partido?',
    'Porque compartilhamos princípios e prioridades: [listar 3 pilares programáticos da legenda]. O partido é o veículo das ideias, não o dono delas — quem governa é o candidato com seu programa.',
    '—',
    'Não defenda toda a história do partido cegamente. Reconheça que partidos têm contradições.',
  ),
  item(
    'partido',
    'Esse partido não tem caso de corrupção?',
    'Onde houver desvio, deve haver responsabilização — independente da legenda. Nossa candidatura tem ficha limpa e compromisso público com transparência total: orçamento e contratos abertos.',
    'A Lei da Ficha Limpa (LC 135/2010) já bloqueia candidaturas com condenação em segunda instância.',
    'Não relativize corrupção. Não generalize ("todos roubam"). Não esconda fatos.',
  ),

  // Local / MG
  item(
    'local_mg',
    'O que muda para o Norte de Minas?',
    'Plano específico para a região: irrigação no Jaíba, polo industrial em Montes Claros, recuperação da BR-365 e atração de indústria têxtil. Combate à desigualdade regional é prioridade.',
    'Norte de Minas tem o pior IDH médio do estado (Atlas Brasil/PNUD).',
    'Não trate o Norte como "região atrasada". Reconheça a vocação produtiva (agro irrigado, mineração).',
  ),
  item(
    'local_mg',
    'O que muda para o Triângulo?',
    'Aproveitar a vocação para agronegócio com infraestrutura logística (hidrovia Tietê-Paraná), tecnologia (parques tecnológicos em Uberlândia/Uberaba) e qualificação profissional.',
    'O Triângulo concentra 22% do PIB estadual com 8% da população (Fundação João Pinheiro).',
    'Não trate o Triângulo como "São Paulo de Minas". Reconheça identidade mineira da região.',
  ),
  item(
    'local_mg',
    'O que muda para o Vale do Aço?',
    'Diversificação econômica reduzindo dependência da Usiminas — atração de tecnologia, mineração responsável e turismo (Parque do Rio Doce). Saúde e qualidade do ar como prioridades.',
    'A região registra os piores índices de poluição atmosférica de MG (FEAM 2024).',
    'Não ataque a Usiminas frontalmente — é a maior empregadora da região.',
  ),
  item(
    'local_mg',
    'O que muda para o Sul de Minas?',
    'Apoio ao café especial (denominação de origem, exportação direta), turismo de experiência e modernização rodoviária — especialmente BR-381 e MG-050.',
    'Sul de Minas responde por mais de 50% da produção nacional de café arábica (Conab).',
    'Não confunda Sul de Minas com Zona da Mata. Conheça a divisão regional antes de falar.',
  ),
  item(
    'local_mg',
    'O que muda para a Zona da Mata?',
    'Modernização da UFJF, recuperação de estradas estaduais, apoio ao polo metalmecânico de Juiz de Fora e investimento no turismo histórico (estrada real, Mariana, Tiradentes).',
    'A Zona da Mata é a 3ª maior economia do estado.',
    'Não generalize "interior". Cada região mineira tem identidade própria.',
  ),
  item(
    'local_mg',
    'O que muda para a RMBH e periferias?',
    'Mobilidade integrada (metrô linhas 2 e 3), habitação popular com regularização fundiária, segurança nas periferias com investimento social e UBSs 24h em pontos críticos.',
    'A RMBH tem mais de 6 milhões de habitantes, 17 das 30 cidades mais violentas do estado em homicídios per capita (SEJUSP).',
    'Não trate periferia como "problema". Reconheça que é onde está a maioria do eleitor.',
  ),
];
