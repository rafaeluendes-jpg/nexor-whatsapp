-- =====================================================================
-- 0002 · Perfis, organizações, membros e convites
-- =====================================================================

-- Um perfil por usuário autenticado (espelho público de auth.users).
create table public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 120),
  telefone      text check (telefone is null or telefone ~ '^\+?[0-9 ()-]{8,20}$'),
  avatar_url    text,
  profissao     text check (profissao is null or char_length(profissao) <= 60),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.perfis is 'Dados públicos do usuário. Um por conta em auth.users.';

create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- Organização = a "conta" do profissional ou empresa. Toda obra pertence a uma.
create table public.organizacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 1 and 120),
  documento     text check (documento is null or documento ~ '^[0-9]{11}$|^[0-9]{14}$'), -- CPF ou CNPJ só dígitos
  dono_id       uuid not null references public.perfis (id) on delete restrict,
  logo_url      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.organizacoes is 'Conta do profissional/empresa. Isola todos os dados (multi-tenant).';
create index organizacoes_dono_idx on public.organizacoes (dono_id);

create trigger organizacoes_atualizado_em before update on public.organizacoes
  for each row execute function public.tocar_atualizado_em();

-- Quem faz parte de qual organização e com qual papel.
create table public.organizacao_membros (
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id        uuid not null references public.perfis (id) on delete cascade,
  papel          public.papel_organizacao not null default 'funcionario',
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (organizacao_id, user_id)
);
create index organizacao_membros_user_idx on public.organizacao_membros (user_id);

create trigger organizacao_membros_atualizado_em before update on public.organizacao_membros
  for each row execute function public.tocar_atualizado_em();

-- Convites por e-mail para entrar numa organização (ou como cliente de uma obra, mais adiante).
create table public.convites (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  email          text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  papel          public.papel_organizacao not null default 'funcionario',
  token          text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  convidado_por  uuid not null references public.perfis (id) on delete cascade,
  expira_em      timestamptz not null default now() + interval '7 days',
  aceito_em      timestamptz,
  criado_em      timestamptz not null default now()
);
create index convites_org_idx on public.convites (organizacao_id);
create unique index convites_pendentes_unicos on public.convites (organizacao_id, lower(email)) where aceito_em is null;

-- Ao criar a conta em auth.users: cria perfil e, salvo se for cliente, a organização própria.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome    text;
  v_tipo    text;
  v_empresa text;
  v_org_id  uuid;
begin
  v_nome    := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
  v_tipo    := coalesce(new.raw_user_meta_data ->> 'tipo_conta', 'profissional');
  v_empresa := nullif(trim(new.raw_user_meta_data ->> 'nome_empresa'), '');

  insert into public.perfis (id, nome, telefone, profissao)
  values (
    new.id,
    left(v_nome, 120),
    nullif(new.raw_user_meta_data ->> 'telefone', ''),
    nullif(new.raw_user_meta_data ->> 'profissao', '')
  );

  if v_tipo <> 'cliente' then
    insert into public.organizacoes (nome, dono_id)
    values (left(coalesce(v_empresa, v_nome), 120), new.id)
    returning id into v_org_id;

    insert into public.organizacao_membros (organizacao_id, user_id, papel)
    values (v_org_id, new.id, 'proprietario');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
