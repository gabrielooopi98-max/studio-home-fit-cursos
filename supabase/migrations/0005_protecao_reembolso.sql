-- =============================================================================
-- Studio HomeFit: proteção contra "assistir tudo e pedir reembolso"
-- Rode depois do 0001 ao 0004 (e o 0006 logo depois). Pode rodar de novo sem problema.
--
-- O direito de desistir em 7 dias (Código de Defesa do Consumidor, art. 49) continua
-- valendo: nada aqui recusa reembolso. O que muda:
--   * Liberação gradual: nas compras pagas, o 1º módulo de cada curso libera na hora e os
--     outros vão abrindo até o dia escolhido no painel (padrão: 8º dia, depois do prazo de
--     7 dias). Cursos liberados à mão pelo admin, compras de teste e cupons de 100% ficam
--     liberados por completo.
--   * Sem "prévia grátis": nenhuma aula abre para quem não comprou (a opção saiu do painel;
--     a coluna lessons.is_preview continua existindo, mas não libera mais nada).
--   * Registro de consumo: o link de cada vídeo só sai pela função open_lesson, que confere
--     se a aula já está liberada e registra a abertura (lesson_views). O link temporário de
--     um arquivo do Storage só é gerado depois desse registro.
--   * Painel: consumo do aluno em cada pedido e quantos reembolsos ele já teve.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configuração (Painel > Configurações)
-- -----------------------------------------------------------------------------

-- prévia grátis desativada: desmarca as aulas que estavam abertas para visitantes
update public.lessons set is_preview = false where is_preview;

alter table public.settings add column if not exists drip_enabled boolean not null default true;
alter table public.settings add column if not exists drip_days integer not null default 8;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_drip_days_check') then
    alter table public.settings add constraint settings_drip_days_check check (drip_days between 1 and 60);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registro de aulas abertas
-- -----------------------------------------------------------------------------

create table if not exists public.lesson_views (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  lesson_id        uuid not null references public.lessons (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  first_viewed_at  timestamptz not null default now(),
  last_viewed_at   timestamptz not null default now(),
  views            integer not null default 1,
  primary key (user_id, lesson_id)
);

create index if not exists lesson_views_course_idx on public.lesson_views (user_id, course_id);

alter table public.lesson_views enable row level security;

drop policy if exists "aulas abertas: ler" on public.lesson_views;
create policy "aulas abertas: ler" on public.lesson_views
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- só a função open_lesson grava aqui
revoke all on public.lesson_views from anon, authenticated;
grant select on public.lesson_views to authenticated;

-- -----------------------------------------------------------------------------
-- Quando cada módulo libera para um aluno
-- -----------------------------------------------------------------------------

-- Data em que o módulo libera para o aluno (null = não tem acesso ao curso)
create or replace function public.module_unlock_at(p_user_id uuid, p_module_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m       public.modules;
  e       public.enrollments;
  o       public.orders;
  s       public.settings;
  total   integer;
  idx     integer;
  base    timestamptz;
begin
  select * into m from public.modules where id = p_module_id;
  if m.id is null then
    return null;
  end if;

  select * into e from public.enrollments where user_id = p_user_id and course_id = m.course_id;
  if e.user_id is null then
    return null;
  end if;

  select * into s from public.settings where id = 1;
  if e.order_id is not null then
    select * into o from public.orders where id = e.order_id;
  end if;

  -- liberado por completo: liberação gradual desligada, curso dado pelo admin (sem pedido),
  -- compra de teste/manual ou pedido sem valor (cupom de 100%)
  if not coalesce(s.drip_enabled, false)
     or e.order_id is null
     or o.payment_provider <> 'mercadopago'
     or coalesce(o.total, 0) <= 0 then
    return e.created_at;
  end if;

  base := coalesce(o.paid_at, e.created_at);

  -- posição do módulo entre os módulos do curso que têm aulas (0 = primeiro)
  select count(*) into total
  from public.modules x
  where x.course_id = m.course_id and exists (select 1 from public.lessons l where l.module_id = x.id);

  select count(*) into idx
  from public.modules x
  where x.course_id = m.course_id
    and exists (select 1 from public.lessons l where l.module_id = x.id)
    and (x.position, x.created_at, x.id) < (m.position, m.created_at, m.id);

  if total <= 1 or idx <= 0 then
    return base;
  end if;

  -- o primeiro na hora, o último no dia drip_days, os do meio espaçados por igual
  return base + make_interval(days => round(idx::numeric * s.drip_days / (total - 1))::integer);
end;
$$;

-- O aluno logado pode assistir esta aula agora?
create or replace function public.can_watch_lesson(p_lesson_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l      public.lessons;
  unlock timestamptz;
begin
  select * into l from public.lessons where id = p_lesson_id;
  if l.id is null then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;
  if auth.uid() is null then
    return false;
  end if;
  unlock := public.module_unlock_at(auth.uid(), l.module_id);
  return unlock is not null and unlock <= now();
end;
$$;

-- Calendário de liberação de um curso para o aluno logado (a tela mostra "libera em ...")
create or replace function public.my_course_unlocks(p_course_id uuid)
returns table (module_id uuid, unlock_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, public.module_unlock_at(auth.uid(), m.id)
  from public.modules m
  where m.course_id = p_course_id and auth.uid() is not null;
$$;

-- -----------------------------------------------------------------------------
-- Abrir uma aula: confere a liberação, registra e devolve o vídeo
-- -----------------------------------------------------------------------------

create or replace function public.open_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l      public.lessons;
  uid    uuid := auth.uid();
  unlock timestamptz;
  video  text;
begin
  select * into l from public.lessons where id = p_lesson_id;
  if l.id is null then
    raise exception 'Aula não encontrada';
  end if;

  if not public.can_watch_lesson(l.id) then
    unlock := case when uid is null then null else public.module_unlock_at(uid, l.module_id) end;
    if unlock is null then
      raise exception 'Você não tem acesso a esta aula';
    end if;
    return jsonb_build_object('locked', true, 'unlock_at', unlock);
  end if;

  -- registra a abertura (aluno logado; o admin conferindo o curso não conta)
  if uid is not null and not public.is_admin() then
    insert into public.lesson_views (user_id, lesson_id, course_id)
    values (uid, l.id, l.course_id)
    on conflict (user_id, lesson_id) do update
      set last_viewed_at = now(), views = public.lesson_views.views + 1;
  end if;

  select video_url into video from public.lesson_media where lesson_id = l.id;
  return jsonb_build_object('locked', false, 'video_url', coalesce(video, ''));
end;
$$;

-- -----------------------------------------------------------------------------
-- Vídeos: o link só sai pela open_lesson (que registra a abertura)
-- -----------------------------------------------------------------------------

-- Tabela de links: leitura direta só para o admin
drop policy if exists "vídeos: ler" on public.lesson_media;
create policy "vídeos: ler" on public.lesson_media
  for select to authenticated using (public.is_admin());

/*
  Arquivo no Storage (courses/<curso>/<aula>/<arquivo>): pode gerar o link temporário?
  Admin sempre; aluno só para aula liberada e aberta pela open_lesson nos últimos 10 minutos.
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

drop policy if exists "vídeos-arquivo: assistir" on storage.objects;
create policy "vídeos-arquivo: assistir" on storage.objects
  for select to anon, authenticated using (bucket_id = 'lesson-videos' and public.can_read_video_file(objects.name));

-- Progresso: só dá para marcar aula que já está liberada
drop policy if exists "progresso: marcar" on public.lesson_progress;
create policy "progresso: marcar" on public.lesson_progress
  for insert to authenticated with check (
    user_id = (select auth.uid()) and public.can_watch_lesson(lesson_id)
  );

-- -----------------------------------------------------------------------------
-- Painel: consumo do aluno num pedido e histórico de reembolsos
-- -----------------------------------------------------------------------------

create or replace function public.admin_order_consumption(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o       public.orders;
  courses uuid[];
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  -- cursos do pedido (combo = todos os publicados)
  if exists (select 1 from public.order_items where order_id = o.id and kind = 'combo') then
    select array_agg(id) into courses from public.courses where published;
  else
    select array_agg(course_id) into courses from public.order_items where order_id = o.id and course_id is not null;
  end if;

  return jsonb_build_object(
    'lessons_total', (select count(*) from public.lessons where course_id = any (coalesce(courses, '{}'))),
    'lessons_opened', (
      select count(*) from public.lesson_views v
      where v.user_id = o.user_id and v.course_id = any (coalesce(courses, '{}'))
        and v.first_viewed_at >= coalesce(o.paid_at, o.created_at)
    ),
    'lessons_done', (
      select count(*) from public.lesson_progress p join public.lessons l on l.id = p.lesson_id
      where p.user_id = o.user_id and l.course_id = any (coalesce(courses, '{}'))
    ),
    'first_view', (
      select min(first_viewed_at) from public.lesson_views v
      where v.user_id = o.user_id and v.course_id = any (coalesce(courses, '{}'))
        and v.first_viewed_at >= coalesce(o.paid_at, o.created_at)
    ),
    'last_view', (
      select max(last_viewed_at) from public.lesson_views v
      where v.user_id = o.user_id and v.course_id = any (coalesce(courses, '{}'))
        and v.first_viewed_at >= coalesce(o.paid_at, o.created_at)
    ),
    'refunds', (
      select count(*) from public.orders x where x.user_id = o.user_id and x.status = 'refunded'
    ),
    'refunds_with_access', (
      -- reembolsos de pedidos em que o aluno abriu metade ou mais das aulas
      select count(*) from public.orders x
      where x.user_id = o.user_id and x.status = 'refunded' and x.id <> o.id
        and (
          select count(*) from public.lesson_views v
          join public.order_items oi on oi.order_id = x.id
          where v.user_id = x.user_id
            and (oi.kind = 'combo' or v.course_id = oi.course_id)
            and v.first_viewed_at >= coalesce(x.paid_at, x.created_at)
        ) * 2 >= greatest(1, (
          select count(*) from public.lessons l
          join public.order_items oi on oi.order_id = x.id
          where oi.kind = 'combo' or l.course_id = oi.course_id
        ))
    )
  );
end;
$$;

-- Reembolsos por aluno (Painel > Alunos)
create or replace function public.admin_refund_counts()
returns table (user_id uuid, refunds bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  return query
  select o.user_id, count(*) from public.orders o
  where o.status = 'refunded' and o.user_id is not null
  group by o.user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quem pode chamar cada função
-- -----------------------------------------------------------------------------

revoke all on function public.module_unlock_at(uuid, uuid) from public, anon, authenticated;
grant execute on function public.module_unlock_at(uuid, uuid) to service_role;

revoke all on function public.can_watch_lesson(uuid) from public;
grant execute on function public.can_watch_lesson(uuid) to anon, authenticated, service_role;

revoke all on function public.can_read_video_file(text) from public;
grant execute on function public.can_read_video_file(text) to anon, authenticated, service_role;

revoke all on function public.my_course_unlocks(uuid) from public, anon;
grant execute on function public.my_course_unlocks(uuid) to authenticated;

revoke all on function public.open_lesson(uuid) from public;
grant execute on function public.open_lesson(uuid) to anon, authenticated;

revoke all on function public.admin_order_consumption(uuid) from public, anon;
grant execute on function public.admin_order_consumption(uuid) to authenticated;

revoke all on function public.admin_refund_counts() from public, anon;
grant execute on function public.admin_refund_counts() to authenticated;
