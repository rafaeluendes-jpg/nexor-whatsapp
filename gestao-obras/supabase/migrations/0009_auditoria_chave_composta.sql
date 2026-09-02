-- =====================================================================
-- 0009 · Correção: auditoria em tabelas com chave composta
-- organizacao_membros e obra_participantes não têm coluna "id";
-- o registro_id passa a ser montado a partir das colunas da chave.
-- =====================================================================
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
  v_org   := (v_linha ->> 'organizacao_id')::uuid;
  v_obra  := case
               when tg_table_name = 'obras' then (v_linha ->> 'id')::uuid
               else (v_linha ->> 'obra_id')::uuid
             end;
  v_id    := coalesce(
               v_linha ->> 'id',
               case when v_linha ? 'obra_id' and v_linha ? 'user_id'
                    then (v_linha ->> 'obra_id') || ':' || (v_linha ->> 'user_id') end,
               case when v_linha ? 'organizacao_id' and v_linha ? 'user_id'
                    then (v_linha ->> 'organizacao_id') || ':' || (v_linha ->> 'user_id') end,
               '?'
             );

  -- obras: a própria org sai da linha; tabelas filhas de obra buscam a org pela obra
  if v_org is null and v_obra is not null then
    select o.organizacao_id into v_org from public.obras o where o.id = v_obra;
  end if;

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
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
