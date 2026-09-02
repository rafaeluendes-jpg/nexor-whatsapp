-- =====================================================================
-- 0005 · Auditoria: quem fez o quê, quando, em qual registro
-- Registro imutável (sem update/delete pela API).
-- =====================================================================
create table public.auditoria (
  id             bigint generated always as identity primary key,
  organizacao_id uuid,
  obra_id        uuid,
  tabela         text not null,
  registro_id    text not null,
  acao           text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  user_id        uuid,
  antes          jsonb,
  depois         jsonb,
  criado_em      timestamptz not null default now()
);
create index auditoria_org_idx on public.auditoria (organizacao_id, criado_em desc);
create index auditoria_obra_idx on public.auditoria (obra_id, criado_em desc) where obra_id is not null;
create index auditoria_registro_idx on public.auditoria (tabela, registro_id);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha  jsonb;
  v_org    uuid;
  v_obra   uuid;
  v_id     text;
begin
  v_linha := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org   := coalesce((v_linha ->> 'organizacao_id')::uuid, null);
  v_obra  := case
               when tg_table_name = 'obras' then (v_linha ->> 'id')::uuid
               else (v_linha ->> 'obra_id')::uuid
             end;
  v_id    := coalesce(v_linha ->> 'id', v_linha ->> 'obra_id' || ':' || coalesce(v_linha ->> 'user_id', ''));

  insert into public.auditoria (organizacao_id, obra_id, tabela, registro_id, acao, user_id, antes, depois)
  values (
    v_org,
    v_obra,
    tg_table_name,
    v_id,
    tg_op,
    (select auth.uid()),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

-- Tabelas auditadas na base (as próximas migrações ligam as suas).
create trigger auditar_organizacoes after insert or update or delete on public.organizacoes
  for each row execute function public.registrar_auditoria();
create trigger auditar_organizacao_membros after insert or update or delete on public.organizacao_membros
  for each row execute function public.registrar_auditoria();
create trigger auditar_clientes after insert or update or delete on public.clientes
  for each row execute function public.registrar_auditoria();
create trigger auditar_obras after insert or update or delete on public.obras
  for each row execute function public.registrar_auditoria();
create trigger auditar_obra_participantes after insert or update or delete on public.obra_participantes
  for each row execute function public.registrar_auditoria();
