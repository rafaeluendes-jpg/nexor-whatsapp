-- =====================================================================
-- 0004 · Funções de segurança usadas pelas políticas de RLS
-- Todas SECURITY DEFINER + search_path vazio: evitam recursão de RLS e
-- sequestro de search_path. Retornam apenas booleanos/enum, nunca dados.
-- =====================================================================

-- É membro ativo da organização?
create or replace function public.eh_membro(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizacao_membros m
    where m.organizacao_id = p_org
      and m.user_id = (select auth.uid())
      and m.ativo
  );
$$;

-- Papel do usuário atual na organização (null se não for membro).
create or replace function public.papel_na_org(p_org uuid)
returns public.papel_organizacao
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel from public.organizacao_membros m
  where m.organizacao_id = p_org
    and m.user_id = (select auth.uid())
    and m.ativo
  limit 1;
$$;

-- Administra a organização (membros, dados da conta)?
create or replace function public.eh_admin_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.papel_na_org(p_org) in ('proprietario', 'administrador');
$$;

-- Pode criar/editar obras, clientes, cronograma e financeiro?
create or replace function public.pode_gerir_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.papel_na_org(p_org) in ('proprietario', 'administrador', 'engenheiro', 'mestre_obras');
$$;

-- Organização dona de uma obra.
create or replace function public.org_da_obra(p_obra uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.organizacao_id from public.obras o where o.id = p_obra;
$$;

-- Pode VER a obra? Membro da org (exceto prestador, que precisa estar vinculado)
-- ou participante explícito (cliente / equipe).
create or replace function public.pode_ver_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public.papel_na_org(public.org_da_obra(p_obra)) not in ('prestador'), false)
    or exists (
      select 1 from public.obra_participantes p
      where p.obra_id = p_obra and p.user_id = (select auth.uid())
    );
$$;

-- Pode EDITAR a obra (dados cadastrais)?
create or replace function public.pode_editar_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pode_gerir_org(public.org_da_obra(p_obra));
$$;

-- É cliente desta obra (acesso do portal)?
create or replace function public.eh_cliente_da_obra(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.obra_participantes p
    where p.obra_id = p_obra and p.user_id = (select auth.uid()) and p.papel = 'cliente'
  );
$$;

-- Dois usuários compartilham alguma organização ou obra? (para ver nome/avatar um do outro)
create or replace function public.compartilha_contexto(p_outro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizacao_membros a
    join public.organizacao_membros b on a.organizacao_id = b.organizacao_id
    where a.user_id = (select auth.uid()) and b.user_id = p_outro
  ) or exists (
    select 1 from public.obra_participantes a
    join public.obras o on o.id = a.obra_id
    where a.user_id = p_outro
      and (public.eh_membro(o.organizacao_id) or exists (
        select 1 from public.obra_participantes b where b.obra_id = a.obra_id and b.user_id = (select auth.uid())
      ))
  );
$$;

-- Bloqueia acesso anônimo às funções de segurança: só usuários logados podem chamá-las.
revoke execute on function
  public.eh_membro(uuid), public.papel_na_org(uuid), public.eh_admin_org(uuid), public.pode_gerir_org(uuid),
  public.org_da_obra(uuid), public.pode_ver_obra(uuid), public.pode_editar_obra(uuid),
  public.eh_cliente_da_obra(uuid), public.compartilha_contexto(uuid)
from public, anon;
grant execute on function
  public.eh_membro(uuid), public.papel_na_org(uuid), public.eh_admin_org(uuid), public.pode_gerir_org(uuid),
  public.org_da_obra(uuid), public.pode_ver_obra(uuid), public.pode_editar_obra(uuid),
  public.eh_cliente_da_obra(uuid), public.compartilha_contexto(uuid)
to authenticated;
