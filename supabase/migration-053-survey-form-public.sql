-- ============================================================================
-- Vórtice — migration 053 — Formulário de Pesquisa: canal PÚBLICO (Fase 3)
--
-- Permite publicar um survey_form como link /f/:token pro eleitor responder
-- sozinho. A resposta cai no MESMO repositório (survey_responses) com
-- channel='publico'. Reaproveita o padrão das pesquisas públicas (migration
-- 050/051): RPC de leitura aberta ao anon + RPC de submit só service_role
-- (edge function survey-form-submit calcula o ip_hash confiável).
--
-- ⚠️ Aditivo: só cria 2 funções. Não altera tabelas nem o fluxo presencial.
-- Idempotente.
-- ============================================================================

-- 1) get_survey_form_by_token — leitura pública do formulário + perguntas -----
-- Usada pela rota /f/:token pra montar o formulário. Rejeita se não existe,
-- não está público (is_public=false), inativo, ou fora da janela temporal.
create or replace function public.get_survey_form_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.survey_forms%rowtype;
  v_questions jsonb;
begin
  select * into v_form
    from public.survey_forms
   where share_token = p_token
   limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if not v_form.is_public or not v_form.is_active then
    return jsonb_build_object('error', 'inactive');
  end if;

  if v_form.public_starts_at is not null and now() < v_form.public_starts_at then
    return jsonb_build_object('error', 'not_started');
  end if;

  if v_form.public_ends_at is not null and now() > v_form.public_ends_at then
    return jsonb_build_object('error', 'ended');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',          q.id,
             'text',        q.text,
             'type',        q.type,
             'options',     q.options,
             'is_required', q.is_required,
             'position',    q.position
           ) order by q.position, q.created_at
         ), '[]'::jsonb)
    into v_questions
    from public.survey_form_questions q
   where q.form_id = v_form.id;

  return jsonb_build_object(
    'id',                   v_form.id,
    'campaign_id',          v_form.campaign_id,
    'name',                 v_form.name,
    'description',          v_form.description,
    'collect_phone',        v_form.collect_phone,
    'collect_municipality', v_form.collect_municipality,
    'collect_neighborhood', v_form.collect_neighborhood,
    'questions',            v_questions
  );
end;
$$;

grant execute on function public.get_survey_form_by_token(text) to anon, authenticated;

-- 2) submit_survey_form_response — grava resposta pública ---------------------
-- Chamada pela edge function survey-form-submit (service_role), que calcula o
-- ip_hash a partir do x-forwarded-for. Valida token/is_public/janela/dedup IP.
create or replace function public.submit_survey_form_response(
  p_token             text,
  p_answers           jsonb,
  p_ip_hash           text,
  p_user_agent        text default null,
  p_name              text default null,
  p_age_range         text default null,
  p_gender            text default null,
  p_religion          text default null,
  p_phone             text default null,
  p_municipality      text default null,
  p_neighborhood      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.survey_forms%rowtype;
  v_existing_id uuid;
  v_response_id uuid;
begin
  select * into v_form
    from public.survey_forms
   where share_token = p_token
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not v_form.is_public or not v_form.is_active then
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  if v_form.public_starts_at is not null and now() < v_form.public_starts_at then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;

  if v_form.public_ends_at is not null and now() > v_form.public_ends_at then
    return jsonb_build_object('ok', false, 'error', 'ended');
  end if;

  -- Anti-fraude: 1 resposta pública por IP quando allow_multiple_per_ip=false.
  if not v_form.allow_multiple_per_ip and p_ip_hash is not null then
    select id into v_existing_id
      from public.survey_responses
     where form_id = v_form.id
       and channel = 'publico'
       and ip_hash = p_ip_hash
     limit 1;
    if found then
      return jsonb_build_object('ok', false, 'error', 'duplicate_ip');
    end if;
  end if;

  insert into public.survey_responses (
    form_id, campaign_id, channel, interviewer_id,
    respondent_name, age_range, gender, religion,
    respondent_phone, municipality_code, neighborhood,
    answers, ip_hash, user_agent
  ) values (
    v_form.id, v_form.campaign_id, 'publico', null,
    nullif(trim(p_name), ''), nullif(p_age_range, ''), nullif(p_gender, ''), nullif(p_religion, ''),
    nullif(trim(p_phone), ''), nullif(p_municipality, ''), nullif(trim(p_neighborhood), ''),
    coalesce(p_answers, '{}'::jsonb), p_ip_hash, p_user_agent
  )
  returning id into v_response_id;

  return jsonb_build_object('ok', true, 'id', v_response_id);
end;
$$;

-- Só service_role executa direto (via edge function); nunca anon/authenticated.
revoke all on function public.submit_survey_form_response(
  text, jsonb, text, text, text, text, text, text, text, text, text
) from anon, authenticated, public;
grant execute on function public.submit_survey_form_response(
  text, jsonb, text, text, text, text, text, text, text, text, text
) to service_role;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from pg_proc where proname='get_survey_form_by_token')
     and exists (select 1 from pg_proc where proname='submit_survey_form_response')
    then 'OK migration 053 aplicada (formulario publico - fase 3)'
    else 'FALHA'
  end as status;
