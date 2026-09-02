-- =====================================================================
-- Teste de segurança da base (RLS + trigger + auditoria)
-- Rode inteiro no SQL Editor do Supabase. Termina em ROLLBACK: não deixa
-- nada no banco. Cada linha do resultado mostra o esperado.
-- =====================================================================
begin;
create temp table resultado (ordem serial, passo text, valor text);
grant all on resultado to authenticated;
grant all on sequence resultado_ordem_seq to authenticated;

-- simula o GoTrue criando dois usuários: um profissional e um cliente
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','teste1@example.com','x',now(),'{"provider":"email","providers":["email"]}','{"nome":"Teste Um","nome_empresa":"Construtora Um","tipo_conta":"profissional"}',now(),now()),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','teste2@example.com','x',now(),'{"provider":"email","providers":["email"]}','{"nome":"Cliente Dois","tipo_conta":"cliente"}',now(),now());

insert into resultado (passo, valor) values ('trigger: perfis criados (esperado 2)', (select count(*)::text from public.perfis));
insert into resultado (passo, valor) values ('trigger: organizacoes criadas (esperado 1)', (select count(*)::text from public.organizacoes));
insert into resultado (passo, valor) values ('trigger: membro proprietario (esperado 1)', (select count(*)::text from public.organizacao_membros where papel='proprietario'));

-- usuário 1 (profissional, dono da organização)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into resultado (passo, valor) values ('u1 vê organizacoes (esperado 1)', (select count(*)::text from public.organizacoes));
insert into public.clientes (organizacao_id, nome) select id, 'Cliente X' from public.organizacoes;
insert into public.obras (organizacao_id, nome) select id, 'Obra X' from public.organizacoes;
insert into resultado (passo, valor) values ('u1 vê obras (esperado 1)', (select count(*)::text from public.obras));
insert into resultado (passo, valor) values ('u1 vê perfil do u2 antes do vínculo (esperado 0)', (select count(*)::text from public.perfis where id='00000000-0000-0000-0000-000000000002'));

-- usuário 2 (cliente) antes de ser vinculado à obra
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
insert into resultado (passo, valor) values ('u2 vê obras antes do vínculo (esperado 0)', (select count(*)::text from public.obras));
insert into resultado (passo, valor) values ('u2 vê organizacoes (esperado 0)', (select count(*)::text from public.organizacoes));
insert into resultado (passo, valor) values ('u2 vê clientes (esperado 0)', (select count(*)::text from public.clientes));

-- u1 libera o acesso do cliente à obra
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.obra_participantes (obra_id, user_id, papel) select id, '00000000-0000-0000-0000-000000000002', 'cliente' from public.obras;
insert into resultado (passo, valor) values ('u1 vê perfil do u2 após vínculo (esperado 1)', (select count(*)::text from public.perfis where id='00000000-0000-0000-0000-000000000002'));

-- u2 agora vê só a obra, e nada mais
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
insert into resultado (passo, valor) values ('u2 vê obras após vínculo (esperado 1)', (select count(*)::text from public.obras));
insert into resultado (passo, valor) values ('u2 vê clientes (esperado 0)', (select count(*)::text from public.clientes));
insert into resultado (passo, valor) values ('u2 vê auditoria (esperado 0)', (select count(*)::text from public.auditoria));
with upd as (update public.obras set nome = 'Hackeada' returning 1) insert into resultado (passo, valor) values ('u2 editou obras (esperado 0)', (select count(*)::text from upd));

reset role;
insert into resultado (passo, valor) values ('anon: privilégio nas tabelas', (select case when has_table_privilege('anon','public.perfis','SELECT') then 'TEM (ruim)' else 'negado (ok)' end));
insert into resultado (passo, valor) values ('auditoria gravada (esperado >0)', (select count(*)::text from public.auditoria));
insert into resultado (passo, valor) values ('auditoria de membros com registro_id', (select registro_id from public.auditoria where tabela='organizacao_membros' limit 1));
insert into resultado (passo, valor) values ('u1 é o autor na auditoria da obra', (select user_id::text from public.auditoria where tabela='obras' and acao='INSERT' limit 1));
select passo, valor from resultado order by ordem;
rollback;
