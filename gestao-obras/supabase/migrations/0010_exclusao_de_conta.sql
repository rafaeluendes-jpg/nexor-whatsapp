-- =====================================================================
-- 0010 · Exclusão de conta
-- Antes: organizacoes.dono_id era ON DELETE RESTRICT, então excluir o
-- usuário no Supabase falhava com erro de chave estrangeira — a conta
-- ficava impossível de apagar (e o direito de exclusão da LGPD, inviável).
-- Agora: excluir o dono apaga a organização e, em cascata, tudo que
-- pertence a ela (obras, clientes, documentos...).
-- =====================================================================
alter table public.organizacoes
  drop constraint organizacoes_dono_id_fkey,
  add constraint organizacoes_dono_id_fkey
    foreign key (dono_id) references public.perfis (id) on delete cascade;

comment on column public.organizacoes.dono_id is
  'Dono da conta. Excluir o usuário apaga a organização e todos os seus dados (cascata).';
