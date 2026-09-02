-- =====================================================================
-- 0001 · Extensões e tipos base
-- Fundamento do banco do app "Gestão de Obras".
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- Papel de um usuário dentro de uma organização (empresa / profissional).
create type public.papel_organizacao as enum (
  'proprietario',   -- dono da conta: tudo, inclusive faturamento e exclusão
  'administrador',  -- gerencia tudo, exceto excluir a organização
  'engenheiro',     -- cria/edita obras, cronograma, financeiro
  'mestre_obras',   -- edita etapas, diário, fotos, presença
  'funcionario',    -- registra diário, fotos e presença nas obras vinculadas
  'prestador'       -- vê apenas as obras/etapas em que trabalha
);

-- Papel de um usuário dentro de UMA obra específica (fora da organização).
create type public.papel_obra as enum (
  'cliente',  -- dono da obra: só visualiza a própria obra
  'equipe'    -- membro da org vinculado explicitamente à obra
);

create type public.status_obra as enum (
  'planejada',
  'em_execucao',
  'pausada',
  'atrasada',
  'concluida',
  'cancelada'
);

-- Função utilitária: mantém "atualizado_em" sempre correto.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
