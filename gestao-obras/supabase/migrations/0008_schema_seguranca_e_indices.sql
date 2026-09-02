-- =====================================================================
-- 0008 · Funções de segurança fora da API + índices de chaves estrangeiras
-- O linter do Supabase alerta que funções SECURITY DEFINER no schema
-- "public" ficam expostas em /rest/v1/rpc. Movemos para um schema
-- privado (não exposto pela API); as políticas continuam funcionando
-- porque referenciam as funções por OID.
-- =====================================================================
create schema if not exists seguranca;
revoke all on schema seguranca from public;
grant usage on schema seguranca to authenticated, service_role;

alter function public.eh_membro(uuid)            set schema seguranca;
alter function public.papel_na_org(uuid)         set schema seguranca;
alter function public.eh_admin_org(uuid)         set schema seguranca;
alter function public.pode_gerir_org(uuid)       set schema seguranca;
alter function public.org_da_obra(uuid)          set schema seguranca;
alter function public.pode_ver_obra(uuid)        set schema seguranca;
alter function public.pode_editar_obra(uuid)     set schema seguranca;
alter function public.eh_cliente_da_obra(uuid)   set schema seguranca;
alter function public.compartilha_contexto(uuid) set schema seguranca;

-- Funções auxiliares em SQL chamam umas às outras pelo nome qualificado: reescreve os corpos.
create or replace function seguranca.eh_admin_org(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select seguranca.papel_na_org(p_org) in ('proprietario', 'administrador');
$$;
create or replace function seguranca.pode_gerir_org(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select seguranca.papel_na_org(p_org) in ('proprietario', 'administrador', 'engenheiro', 'mestre_obras');
$$;
create or replace function seguranca.pode_ver_obra(p_obra uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    coalesce(seguranca.papel_na_org(seguranca.org_da_obra(p_obra)) not in ('prestador'), false)
    or exists (
      select 1 from public.obra_participantes p
      where p.obra_id = p_obra and p.user_id = (select auth.uid())
    );
$$;
create or replace function seguranca.pode_editar_obra(p_obra uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select seguranca.pode_gerir_org(seguranca.org_da_obra(p_obra));
$$;
create or replace function seguranca.compartilha_contexto(p_outro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizacao_membros a
    join public.organizacao_membros b on a.organizacao_id = b.organizacao_id
    where a.user_id = (select auth.uid()) and b.user_id = p_outro
  ) or exists (
    select 1 from public.obra_participantes a
    join public.obras o on o.id = a.obra_id
    where a.user_id = p_outro
      and (seguranca.eh_membro(o.organizacao_id) or exists (
        select 1 from public.obra_participantes b where b.obra_id = a.obra_id and b.user_id = (select auth.uid())
      ))
  );
$$;

-- Funções de trigger nunca devem ser chamadas pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;

-- Índices para as chaves estrangeiras apontadas pelo linter de desempenho.
create index if not exists clientes_criado_por_idx on public.clientes (criado_por);
create index if not exists convites_convidado_por_idx on public.convites (convidado_por);
create index if not exists obra_participantes_adicionado_por_idx on public.obra_participantes (adicionado_por);
create index if not exists obras_criado_por_idx on public.obras (criado_por);
create index if not exists obras_responsavel_idx on public.obras (responsavel_id);
