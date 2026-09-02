-- =====================================================================
-- 0007 · Storage: buckets privados por obra
-- Convenção de caminho: {organizacao_id}/{obra_id}/{qualquer}/{arquivo}
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('obras-documentos', 'obras-documentos', false, 26214400, -- 25 MB
    array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
          'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip','application/acad','image/vnd.dwg','application/dxf']),
  ('obras-fotos', 'obras-fotos', false, 15728640, -- 15 MB
    array['image/jpeg','image/png','image/webp','image/heic']),
  ('avatares', 'avatares', true, 2097152, -- 2 MB
    array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Documentos e fotos: ler quem vê a obra; escrever quem gere a organização.
create policy "storage obras: ler quem vê a obra"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('obras-documentos', 'obras-fotos')
    and public.pode_ver_obra(((storage.foldername(name))[2])::uuid)
  );

create policy "storage obras: enviar quem gere a org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('obras-documentos', 'obras-fotos')
    and public.pode_gerir_org(((storage.foldername(name))[1])::uuid)
    and public.org_da_obra(((storage.foldername(name))[2])::uuid) = ((storage.foldername(name))[1])::uuid
  );

create policy "storage obras: atualizar quem gere a org"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('obras-documentos', 'obras-fotos')
    and public.pode_gerir_org(((storage.foldername(name))[1])::uuid)
  );

create policy "storage obras: excluir quem gere a org"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('obras-documentos', 'obras-fotos')
    and public.pode_gerir_org(((storage.foldername(name))[1])::uuid)
  );

-- Avatares: caminho {user_id}/{arquivo}. Público para leitura, cada um escreve só o seu.
create policy "avatares: leitura pública"
  on storage.objects for select to public
  using (bucket_id = 'avatares');

create policy "avatares: cada um envia o seu"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: cada um atualiza o seu"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: cada um exclui o seu"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
