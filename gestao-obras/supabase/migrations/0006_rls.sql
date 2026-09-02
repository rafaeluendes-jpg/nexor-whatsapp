-- =====================================================================
-- 0006 · Row Level Security em TODAS as tabelas
-- Regra geral: nada é visível sem política explícita. Anônimo não vê nada.
-- =====================================================================
alter table public.perfis              enable row level security;
alter table public.organizacoes        enable row level security;
alter table public.organizacao_membros enable row level security;
alter table public.convites            enable row level security;
alter table public.clientes            enable row level security;
alter table public.obras               enable row level security;
alter table public.obra_participantes  enable row level security;
alter table public.auditoria           enable row level security;

-- ---------- perfis ----------
create policy "perfis: ver o próprio ou de quem compartilha contexto"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()) or public.compartilha_contexto(id));

create policy "perfis: editar o próprio"
  on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- (insert é feito pelo trigger handle_new_user; delete cai em cascata de auth.users)

-- ---------- organizacoes ----------
create policy "organizacoes: membros veem"
  on public.organizacoes for select to authenticated
  using (public.eh_membro(id));

create policy "organizacoes: criar como dono"
  on public.organizacoes for insert to authenticated
  with check (dono_id = (select auth.uid()));

create policy "organizacoes: admins editam"
  on public.organizacoes for update to authenticated
  using (public.eh_admin_org(id))
  with check (public.eh_admin_org(id) and dono_id = (select o.dono_id from public.organizacoes o where o.id = organizacoes.id));

create policy "organizacoes: só o dono exclui"
  on public.organizacoes for delete to authenticated
  using (dono_id = (select auth.uid()));

-- ---------- organizacao_membros ----------
create policy "membros: membros veem a lista"
  on public.organizacao_membros for select to authenticated
  using (public.eh_membro(organizacao_id));

create policy "membros: admins adicionam"
  on public.organizacao_membros for insert to authenticated
  with check (public.eh_admin_org(organizacao_id) and papel <> 'proprietario');

create policy "membros: admins alteram (não o proprietário)"
  on public.organizacao_membros for update to authenticated
  using (public.eh_admin_org(organizacao_id) and papel <> 'proprietario')
  with check (public.eh_admin_org(organizacao_id) and papel <> 'proprietario');

create policy "membros: admins removem (não o proprietário) ou o próprio sai"
  on public.organizacao_membros for delete to authenticated
  using (
    (public.eh_admin_org(organizacao_id) and papel <> 'proprietario')
    or (user_id = (select auth.uid()) and papel <> 'proprietario')
  );

-- ---------- convites ----------
create policy "convites: admins veem"
  on public.convites for select to authenticated
  using (public.eh_admin_org(organizacao_id));

create policy "convites: admins criam"
  on public.convites for insert to authenticated
  with check (public.eh_admin_org(organizacao_id) and convidado_por = (select auth.uid()) and papel <> 'proprietario');

create policy "convites: admins cancelam"
  on public.convites for delete to authenticated
  using (public.eh_admin_org(organizacao_id));

-- ---------- clientes ----------
create policy "clientes: membros da org veem"
  on public.clientes for select to authenticated
  using (public.eh_membro(organizacao_id) or user_id = (select auth.uid()));

create policy "clientes: gestores criam"
  on public.clientes for insert to authenticated
  with check (public.pode_gerir_org(organizacao_id));

create policy "clientes: gestores editam"
  on public.clientes for update to authenticated
  using (public.pode_gerir_org(organizacao_id))
  with check (public.pode_gerir_org(organizacao_id));

create policy "clientes: admins excluem"
  on public.clientes for delete to authenticated
  using (public.eh_admin_org(organizacao_id));

-- ---------- obras ----------
create policy "obras: quem pode ver"
  on public.obras for select to authenticated
  using (public.pode_ver_obra(id));

create policy "obras: gestores criam"
  on public.obras for insert to authenticated
  with check (public.pode_gerir_org(organizacao_id));

create policy "obras: gestores editam"
  on public.obras for update to authenticated
  using (public.pode_gerir_org(organizacao_id))
  with check (public.pode_gerir_org(organizacao_id));

create policy "obras: admins excluem"
  on public.obras for delete to authenticated
  using (public.eh_admin_org(organizacao_id));

-- ---------- obra_participantes ----------
create policy "participantes: quem vê a obra vê a lista"
  on public.obra_participantes for select to authenticated
  using (public.pode_ver_obra(obra_id));

create policy "participantes: gestores adicionam"
  on public.obra_participantes for insert to authenticated
  with check (public.pode_editar_obra(obra_id));

create policy "participantes: gestores alteram permissões"
  on public.obra_participantes for update to authenticated
  using (public.pode_editar_obra(obra_id))
  with check (public.pode_editar_obra(obra_id));

create policy "participantes: gestores removem"
  on public.obra_participantes for delete to authenticated
  using (public.pode_editar_obra(obra_id));

-- ---------- auditoria ----------
create policy "auditoria: admins da org consultam"
  on public.auditoria for select to authenticated
  using (organizacao_id is not null and public.eh_admin_org(organizacao_id));
-- sem insert/update/delete via API: só o trigger (security definer) grava.

-- Garantia extra: anônimo não tem nenhum privilégio nas tabelas.
revoke all on all tables in schema public from anon;
