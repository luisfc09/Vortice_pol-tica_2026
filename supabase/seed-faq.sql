-- Seed inicial de FAQ globais (campaign_id null = vale para todas as campanhas).
-- Conteúdo idêntico ao src/data/faq-seed.ts para começarmos com algo carregado.
-- Rode APÓS schema.sql.

insert into faq_items (campaign_id, category, question, suggested_answer, support_data, avoid_saying)
values
  (null, 'seguranca',
   'O que será feito para reduzir a violência?',
   'Mais policiamento ostensivo, integração com inteligência e foco em facções. Tecnologia (câmeras com IA, monitoramento de áreas críticas) somada à valorização salarial e treinamento das polícias civil e militar.',
   'MG fechou 2024 com queda de homicídios em 12 das 17 RISPs, mas com aumento de crimes patrimoniais em áreas metropolitanas.',
   'Não prometa "acabar com a violência". Não defenda armamento irrestrito da população.'),
  (null, 'saude',
   'Por que a fila do SUS demora tanto?',
   'Subfinanciamento crônico, gestão fragmentada e falta de regulação efetiva. Vamos reorganizar a Central de Regulação estadual e investir em atenção primária.',
   'MG tem mais de 1,2 milhão de pessoas em fila de cirurgias eletivas (TCE-MG 2024).',
   'Não prometa "fila zero em 100 dias". Não ataque servidores da saúde.'),
  (null, 'emprego',
   'Como gerar emprego em MG?',
   'Atração de indústria via incentivos vinculados a metas de geração de vagas, qualificação profissional alinhada às vocações regionais e crédito facilitado para MEI.',
   'MG fechou 2024 com saldo positivo de 180 mil empregos formais (CAGED).',
   'Não prometa número exato de empregos sem fonte. Quem contrata é o setor produtivo.');
-- Demais entradas são carregadas via UI ou importação CSV — o app já vem com 25+ no src/data/faq-seed.ts.
