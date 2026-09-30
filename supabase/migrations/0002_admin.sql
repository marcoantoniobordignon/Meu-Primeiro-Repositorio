-- Ninho · painel de admin.
-- Toda leitura do painel passa por RPCs security definer que exigem eh_admin().
-- Só agregados saem daqui: nenhuma RPC devolve nome, sintoma ou nota de uma família.

create or replace function public.exigir_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    raise exception 'só admin' using errcode = '42501';
  end if;
end $$;

-- Quem sou eu no painel: e-mail e se está na lista de admins.
create or replace function public.admin_eu()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('email', auth.jwt() ->> 'email', 'admin', public.eh_admin())
$$;

-- Números do topo da visão geral.
create or replace function public.admin_resumo()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select jsonb_build_object(
    'familias', (select count(*) from public.familias),
    'familias_7d', (select count(*) from public.familias where criado_em >= now() - interval '7 days'),
    'familias_30d', (select count(*) from public.familias where criado_em >= now() - interval '30 days'),
    'ativas_1d', (select count(distinct familia_id) from public.membros_familia where ultimo_acesso_em >= now() - interval '1 day'),
    'ativas_7d', (select count(distinct familia_id) from public.membros_familia where ultimo_acesso_em >= now() - interval '7 days'),
    'ativas_30d', (select count(distinct familia_id) from public.membros_familia where ultimo_acesso_em >= now() - interval '30 days'),
    'gestacao', (select count(*) from public.v_modo where modo = 'gestacao'),
    'bebe', (select count(*) from public.v_modo where modo = 'bebe'),
    'plano_ativo', (select count(*) from public.familias where plano = 'ativo'),
    'trial', (select count(*) from public.familias where plano = 'trial'),
    'cortesia', (select count(*) from public.familias where cortesia_fim > now()),
    'membros', (select count(*) from public.membros_familia),
    'cuidadores', (select count(*) from public.membros_familia where papel <> 'mae'),
    'registros_7d', (select count(*) from public.registros where apagado_em is null and criado_em >= now() - interval '7 days'),
    'sintomas_7d', (select count(*) from public.sintomas where apagado_em is null and criado_em >= now() - interval '7 days'),
    'leituras_7d', (select count(*) from public.conteudos_lidos where apagado_em is null and lido_em >= now() - interval '7 days'),
    'voz_7d', (select count(*) from public.voz_interpretacoes where criado_em >= now() - interval '7 days'),
    'onboarding_concluido', (select count(*) from public.profiles where onboarding_concluido_em is not null),
    'perfis', (select count(*) from public.profiles),
    'com_email', (select count(*) from auth.users where email is not null and (is_anonymous is distinct from true))
  ) into r;
  return r;
end $$;

-- Série diária dos últimos p_dias: novas famílias, famílias ativas, registros, leituras.
create or replace function public.admin_serie_diaria(p_dias int default 30)
returns table (dia date, novas int, ativas int, registros int, leituras int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  return query
  with dias as (
    select generate_series((current_date - (p_dias - 1))::date, current_date, interval '1 day')::date as dia
  )
  select d.dia,
    (select count(*)::int from public.familias f where f.criado_em::date = d.dia),
    (select count(distinct m.familia_id)::int from public.membros_familia m where m.ultimo_acesso_em::date = d.dia),
    (select count(*)::int from public.registros r where r.apagado_em is null and r.criado_em::date = d.dia),
    (select count(*)::int from public.conteudos_lidos l where l.apagado_em is null and l.lido_em::date = d.dia)
  from dias d order by d.dia;
end $$;

-- Distribuições: semana gestacional, mês do bebê, papéis, tipos de registro,
-- origem dos registros, sintomas mais marcados (só o slug e a contagem).
create or replace function public.admin_distribuicoes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select jsonb_build_object(
    'semanas', coalesce((
      select jsonb_agg(jsonb_build_object('chave', s, 'n', n) order by s)
      from (
        select least(42, greatest(1, 40 - ((p.dpp - current_date) / 7)))::int as s, count(*) as n
        from public.profiles p join public.membros_familia m on m.profile_id = p.id and m.papel = 'mae'
        join public.v_modo v on v.familia_id = m.familia_id
        where p.dpp is not null and v.modo = 'gestacao'
        group by 1
      ) x
    ), '[]'::jsonb),
    'meses_bebe', coalesce((
      select jsonb_agg(jsonb_build_object('chave', mes, 'n', n) order by mes)
      from (
        select least(24, floor(extract(epoch from (now() - b.nascido_em)) / 2629800))::int as mes, count(*) as n
        from public.bebes b where b.apagado_em is null group by 1
      ) x
    ), '[]'::jsonb),
    'papeis', coalesce((
      select jsonb_agg(jsonb_build_object('chave', papel, 'n', n) order by n desc)
      from (select papel, count(*) as n from public.membros_familia group by papel) x
    ), '[]'::jsonb),
    'tipos_registro', coalesce((
      select jsonb_agg(jsonb_build_object('chave', tipo, 'n', n) order by n desc)
      from (select tipo, count(*) as n from public.registros where apagado_em is null and criado_em >= now() - interval '30 days' group by tipo) x
    ), '[]'::jsonb),
    'origens_registro', coalesce((
      select jsonb_agg(jsonb_build_object('chave', origem, 'n', n) order by n desc)
      from (select origem, count(*) as n from public.registros where apagado_em is null and criado_em >= now() - interval '30 days' group by origem) x
    ), '[]'::jsonb),
    'sintomas', coalesce((
      select jsonb_agg(jsonb_build_object('chave', slug, 'n', n) order by n desc)
      from (select slug, count(*) as n from public.sintomas where apagado_em is null and criado_em >= now() - interval '30 days' group by slug order by n desc limit 10) x
    ), '[]'::jsonb),
    'planos', coalesce((
      select jsonb_agg(jsonb_build_object('chave', plano, 'n', n) order by n desc)
      from (select plano, count(*) as n from public.familias group by plano) x
    ), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- Lista de famílias, sem nome nem dado de saúde: id curto, modo, semana ou mês,
-- membros, plano, criação e último acesso.
create or replace function public.admin_familias(p_limite int default 50, p_offset int default 0)
returns table (id uuid, modo text, semana int, mes_bebe int, membros int, plano text, criado_em timestamptz, ultimo_acesso_em timestamptz, registros int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  return query
  select f.id, v.modo,
    (select least(42, greatest(1, 40 - ((p.dpp - current_date) / 7)))::int from public.profiles p where p.id = f.dona_id and p.dpp is not null) as semana,
    (select floor(extract(epoch from (now() - min(b.nascido_em))) / 2629800)::int from public.bebes b where b.familia_id = f.id and b.apagado_em is null) as mes_bebe,
    (select count(*)::int from public.membros_familia m where m.familia_id = f.id) as membros,
    f.plano, f.criado_em,
    (select max(m.ultimo_acesso_em) from public.membros_familia m where m.familia_id = f.id) as ultimo_acesso_em,
    (select count(*)::int from public.registros r where r.familia_id = f.id and r.apagado_em is null) as registros
  from public.familias f join public.v_modo v on v.familia_id = f.id
  order by ultimo_acesso_em desc nulls last
  limit p_limite offset p_offset;
end $$;

-- Leituras por conteúdo (para saber o que é lido e o que é guardado).
create or replace function public.admin_leituras()
returns table (conteudo_id text, leituras int, guardados int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_admin();
  return query
  select l.conteudo_id, count(*) filter (where l.lido_em is not null)::int, count(*) filter (where l.guardado)::int
  from public.conteudos_lidos l where l.apagado_em is null group by l.conteudo_id;
end $$;

-- Voz: qualidade da interpretação. A transcrição é o que a pessoa disse e fica
-- restrita ao painel; nunca sai do Supabase do projeto.
create or replace function public.admin_voz(p_limite int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select jsonb_build_object(
    'total', (select count(*) from public.voz_interpretacoes),
    'total_30d', (select count(*) from public.voz_interpretacoes where criado_em >= now() - interval '30 days'),
    'aceitas', (select count(*) from public.voz_interpretacoes where aceita),
    'corrigidas', (select count(*) from public.voz_interpretacoes where corrigida),
    'nao_entendidas', (select count(*) from public.voz_interpretacoes where aceita is false and not corrigida),
    'confianca_media', (select round(avg(confianca)::numeric, 2) from public.voz_interpretacoes),
    'ms_mediano', (select percentile_cont(0.5) within group (order by ms_total) from public.voz_interpretacoes where ms_total is not null),
    'recentes', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'transcricao', transcricao, 'resposta', resposta, 'confianca', confianca, 'aceita', aceita, 'corrigida', corrigida, 'ms_total', ms_total, 'criado_em', criado_em) order by criado_em desc)
      from (select * from public.voz_interpretacoes order by criado_em desc limit p_limite) x
    ), '[]'::jsonb)
  ) into r;
  return r;
end $$;

grant execute on function public.admin_eu() to anon, authenticated;
grant execute on function public.admin_resumo(), public.admin_serie_diaria(int), public.admin_distribuicoes(), public.admin_familias(int, int), public.admin_leituras(), public.admin_voz(int) to authenticated;
