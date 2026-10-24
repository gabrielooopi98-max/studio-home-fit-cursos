-- =============================================================================
-- Studio HomeFit: vídeos das aulas enviados como arquivo (Supabase Storage)
-- Rode depois do 0001 e do 0002. Pode rodar de novo sem problema.
--
-- Os arquivos ficam no bucket PRIVADO "lesson-videos", no caminho:
--   courses/<id do curso>/<id da aula>/<arquivo>
-- Na aula, o vídeo fica registrado como "storage:lesson-videos/<caminho>".
-- Quem pode assistir: administrador, aluno matriculado no curso, ou qualquer um
-- se a aula for "prévia grátis" de um curso publicado. O player recebe um link
-- temporário (assinado) gerado só para quem tem essa permissão.
-- =============================================================================

-- Tamanho por arquivo: vale o limite do projeto (Storage > Settings). No plano Free é 50 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-videos', 'lesson-videos', false, null, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Quem pode ler (assistir / gerar o link temporário)
drop policy if exists "vídeos-arquivo: assistir" on storage.objects;
create policy "vídeos-arquivo: assistir" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'lesson-videos'
    and split_part(objects.name, '/', 1) = 'courses'
    and (
      public.is_admin()
      or exists (
        select 1 from public.enrollments e
        where e.user_id = (select auth.uid())
          and e.course_id::text = split_part(objects.name, '/', 2)
      )
      or exists (
        select 1 from public.lessons l
        join public.courses c on c.id = l.course_id
        where l.id::text = split_part(objects.name, '/', 3)
          and c.id::text = split_part(objects.name, '/', 2)
          and l.is_preview
          and c.published
      )
    )
  );

-- Só o admin envia, troca e apaga
drop policy if exists "vídeos-arquivo: admin envia" on storage.objects;
create policy "vídeos-arquivo: admin envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'lesson-videos' and public.is_admin());

drop policy if exists "vídeos-arquivo: admin altera" on storage.objects;
create policy "vídeos-arquivo: admin altera" on storage.objects
  for update to authenticated using (bucket_id = 'lesson-videos' and public.is_admin());

drop policy if exists "vídeos-arquivo: admin remove" on storage.objects;
create policy "vídeos-arquivo: admin remove" on storage.objects
  for delete to authenticated using (bucket_id = 'lesson-videos' and public.is_admin());
