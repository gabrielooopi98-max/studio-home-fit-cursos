-- =============================================================================
-- Studio HomeFit: apresentação do curso
-- Rode depois do 0001 ao 0005. Pode rodar de novo sem problema.
-- Se um dia rodar o 0005 de novo, rode este arquivo logo depois (ele substitui a regra
-- dos arquivos de vídeo do 0005).
--
-- Cada curso pode ter um vídeo de apresentação (opcional), gravado para falar do curso:
-- para quem é, o objetivo e o que a pessoa vai aprender. Ele aparece para TODOS (até sem
-- conta) na página do curso e na área do aluno, sempre antes do Módulo 1.
--   * Link (YouTube, Vimeo, Panda...): fica no próprio curso, que já é público.
--   * Arquivo enviado: fica no bucket privado dos vídeos, em
--     courses/<id do curso>/apresentacao/<arquivo>, e só ESSE arquivo (o atual, de um curso
--     publicado) pode ter link temporário gerado por qualquer pessoa. As aulas continuam
--     protegidas como antes.
-- =============================================================================

alter table public.courses add column if not exists intro_video_url text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_intro_video_url_check') then
    alter table public.courses add constraint courses_intro_video_url_check check (char_length(intro_video_url) <= 1000);
  end if;
end;
$$;

/*
  Arquivo no Storage (courses/<curso>/<aula>/<arquivo>): pode gerar o link temporário?
  Admin sempre; apresentação atual de um curso publicado para todos; aluno só para aula
  liberada e aberta pela open_lesson nos últimos 10 minutos.
  Fica numa função (security definer) porque a regra do Storage também roda para visitantes,
  que não têm permissão de ler lesson_views diretamente.
*/
create or replace function public.can_read_video_file(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.lessons;
begin
  if split_part(p_name, '/', 1) <> 'courses' then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;

  -- apresentação do curso: aberta para todos, mas só o arquivo que está no curso agora
  if split_part(p_name, '/', 3) = 'apresentacao' then
    return exists (
      select 1 from public.courses c
      where c.id::text = split_part(p_name, '/', 2)
        and c.published
        and c.intro_video_url = 'storage:lesson-videos/' || p_name
    );
  end if;

  select * into l from public.lessons
  where id::text = split_part(p_name, '/', 3) and course_id::text = split_part(p_name, '/', 2);
  if l.id is null then
    return false;
  end if;

  return auth.uid() is not null
    and exists (
      select 1 from public.lesson_views v
      where v.user_id = auth.uid() and v.lesson_id = l.id and v.last_viewed_at > now() - interval '10 minutes'
    )
    and public.can_watch_lesson(l.id);
end;
$$;

revoke all on function public.can_read_video_file(text) from public;
grant execute on function public.can_read_video_file(text) to anon, authenticated, service_role;
