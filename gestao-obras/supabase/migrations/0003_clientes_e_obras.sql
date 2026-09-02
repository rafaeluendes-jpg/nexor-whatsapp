-- =====================================================================
-- 0003 · Clientes, obras e participantes de obra
-- =====================================================================

create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (char_length(nome) between 1 and 120),
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone       text check (telefone is null or telefone ~ '^\+?[0-9 ()-]{8,20}$'),
  documento      text check (documento is null or documento ~ '^[0-9]{11}$|^[0-9]{14}$'),
  endereco       jsonb not null default '{}'::jsonb,
  observacoes    text,
  user_id        uuid references public.perfis (id) on delete set null, -- conta do cliente no portal, se tiver
  criado_por     uuid references public.perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index clientes_org_idx on public.clientes (organizacao_id);
create index clientes_user_idx on public.clientes (user_id) where user_id is not null;

create trigger clientes_atualizado_em before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

-- A "pasta" de cada obra. Tudo (etapas, financeiro, fotos...) pendura aqui.
create table public.obras (
  id               uuid primary key default gen_random_uuid(),
  organizacao_id   uuid not null references public.organizacoes (id) on delete cascade,
  cliente_id       uuid references public.clientes (id) on delete set null,
  codigo           text,                                  -- código interno livre (ex.: OB-2026-001)
  nome             text not null check (char_length(nome) between 1 and 160),
  descricao        text,
  status           public.status_obra not null default 'planejada',
  endereco         jsonb not null default '{}'::jsonb,
  area_m2          numeric(12,2) check (area_m2 is null or area_m2 >= 0),
  valor_contratado numeric(14,2) check (valor_contratado is null or valor_contratado >= 0),
  data_inicio_prevista date,
  data_fim_prevista    date,
  data_inicio_real     date,
  data_fim_real        date,
  responsavel_id   uuid references public.perfis (id) on delete set null,
  criado_por       uuid references public.perfis (id) on delete set null,
  arquivada_em     timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint obras_datas_previstas check (
    data_fim_prevista is null or data_inicio_prevista is null or data_fim_prevista >= data_inicio_prevista
  ),
  constraint obras_codigo_unico unique (organizacao_id, codigo)
);
create index obras_org_idx on public.obras (organizacao_id);
create index obras_cliente_idx on public.obras (cliente_id);
create index obras_status_idx on public.obras (organizacao_id, status);

create trigger obras_atualizado_em before update on public.obras
  for each row execute function public.tocar_atualizado_em();

-- Quem tem acesso a UMA obra específica: o cliente e membros da equipe vinculados.
create table public.obra_participantes (
  obra_id      uuid not null references public.obras (id) on delete cascade,
  user_id      uuid not null references public.perfis (id) on delete cascade,
  papel        public.papel_obra not null,
  -- permissões finas do cliente no portal (o padrão é só ver)
  permissoes   jsonb not null default '{"ver_financeiro": false, "ver_documentos": true, "ver_fotos": true, "ver_diario": false}'::jsonb,
  adicionado_por uuid references public.perfis (id) on delete set null,
  criado_em    timestamptz not null default now(),
  primary key (obra_id, user_id)
);
create index obra_participantes_user_idx on public.obra_participantes (user_id);
