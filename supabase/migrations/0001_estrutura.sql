-- =============================================================================
-- Studio HomeFit: banco de dados (Supabase / PostgreSQL)
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Depois rode o 0002, o 0003, o 0004, o 0005 e o 0006, nessa ordem (eles substituem algumas regras daqui).
--
-- Segurança:
--   * RLS (Row Level Security) ligado em TODAS as tabelas.
--   * Administrador = profiles.role = 'admin' E e-mail confirmado (is_admin()).
--   * Ninguém consegue mudar o próprio papel (trigger protect_profile).
--   * Preços são sempre calculados no banco (quote_order); o navegador nunca define valores.
--   * Pedidos e matrículas só são criados por funções do servidor (Edge Functions com
--     service_role) ou pelo modo de teste, que o admin liga/desliga.
--   * Links dos vídeos ficam em lesson_media e só são lidos por quem comprou o curso.
-- =============================================================================

-- E-mail do dono do site: vira administrador automaticamente ao confirmar o cadastro.
create or replace function public.owner_email()
returns text
language sql
immutable
as $$ select 'gabrielooopi98@gmail.com'::text $$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text not null default '' check (char_length(phone) <= 30),
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title        text not null check (char_length(title) between 2 and 120),
  tag          text not null default '' check (char_length(tag) <= 80),
  level        text not null default 'Iniciante' check (level in ('Iniciante', 'Intermediário', 'Avançado')),
  description  text not null default '' check (char_length(description) <= 2000),
  image_url    text not null default '' check (char_length(image_url) <= 1000),
  hours        text not null default '' check (char_length(hours) <= 20),
  price        numeric(10, 2) not null default 0 check (price >= 0 and price <= 100000),
  old_price    numeric(10, 2) check (old_price is null or (old_price > 0 and old_price <= 100000)),
  bestseller   boolean not null default false,
  published    boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  duration    text not null default '' check (char_length(duration) <= 12),
  position    integer not null default 0,
  is_preview  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Link do vídeo separado da aula: a lista de aulas é pública, o vídeo não.
create table if not exists public.lesson_media (
  lesson_id   uuid primary key references public.lessons (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  video_url   text not null default '' check (char_length(video_url) <= 1000),
  updated_at  timestamptz not null default now()
);

create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind        text not null default 'percent' check (kind in ('percent', 'fixed')),
  value       numeric(10, 2) not null check (value > 0),
  active      boolean not null default true,
  starts_at   timestamptz,
  expires_at  timestamptz,
  max_uses    integer check (max_uses is null or max_uses > 0),
  used_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete set null,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  subtotal          numeric(10, 2) not null default 0,
  discount          numeric(10, 2) not null default 0,
  total             numeric(10, 2) not null default 0,
  coupon_id         uuid references public.coupons (id) on delete set null,
  coupon_code       text,
  payment_provider  text not null default 'mercadopago' check (payment_provider in ('mercadopago', 'test', 'manual')),
  payment_id        text,
  payment_method    text,
  payer_name        text not null default '',
  payer_email       text not null default '',
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  updated_at        timestamptz not null default now()
);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  kind        text not null check (kind in ('course', 'combo')),
  course_id   uuid references public.courses (id) on delete set null,
  title       text not null,
  price       numeric(10, 2) not null check (price >= 0)
);

create table if not exists public.enrollments (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists public.lesson_progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Configurações da loja (uma linha só)
create table if not exists public.settings (
  id                  integer primary key default 1 check (id = 1),
  combo_title         text not null default 'Combo Completo',
  combo_description   text not null default '',
  combo_price         numeric(10, 2) not null default 397 check (combo_price >= 0),
  combo_old_price     numeric(10, 2) check (combo_old_price is null or combo_old_price > 0),
  combo_installments  integer not null default 12 check (combo_installments between 1 and 24),
  combo_active        boolean not null default true,
  combo_features      text[] not null default '{}',
  test_mode           boolean not null default false,
  whatsapp            text not null default '',
  instagram           text not null default '',
  youtube             text not null default '',
  contact_email       text not null default '',
  updated_at          timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

create index if not exists modules_course_idx on public.modules (course_id, position);
create index if not exists lessons_module_idx on public.lessons (module_id, position);
create index if not exists lessons_course_idx on public.lessons (course_id);
create index if not exists lesson_media_course_idx on public.lesson_media (course_id);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_course_idx on public.order_items (course_id);
create index if not exists enrollments_course_idx on public.enrollments (course_id);

-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------

-- Administrador: papel admin e e-mail confirmado
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and u.email_confirmed_at is not null
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Perfil criado junto com a conta
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when lower(coalesce(new.email, '')) = lower(public.owner_email()) then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- E-mail trocado na conta: mantém o perfil sincronizado
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

-- Ninguém muda o próprio papel; só admin muda papel de alguém; sempre sobra ao menos 1 admin.
-- Sem security definer de propósito: current_user precisa ser quem fez a alteração
-- (postgres no SQL Editor, authenticated no site).
create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- funções do servidor (service_role) e o próprio banco podem tudo
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'Campos protegidos do perfil não podem ser alterados';
  end if;

  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar papéis';
    end if;
    if old.role = 'admin' and new.role <> 'admin'
       and (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'O site precisa de pelo menos um administrador';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists courses_touch on public.courses;
create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

drop trigger if exists lesson_media_touch on public.lesson_media;
create trigger lesson_media_touch before update on public.lesson_media
  for each row execute function public.touch_updated_at();

-- A aula sempre pertence ao mesmo curso do módulo (evita apontar course_id errado)
create or replace function public.lesson_course_from_module()
returns trigger
language plpgsql
as $$
begin
  select course_id into new.course_id from public.modules where id = new.module_id;
  if new.course_id is null then
    raise exception 'Módulo inexistente';
  end if;
  return new;
end;
$$;

drop trigger if exists lessons_course on public.lessons;
create trigger lessons_course before insert or update of module_id on public.lessons
  for each row execute function public.lesson_course_from_module();

create or replace function public.media_course_from_lesson()
returns trigger
language plpgsql
as $$
begin
  select course_id into new.course_id from public.lessons where id = new.lesson_id;
  if new.course_id is null then
    raise exception 'Aula inexistente';
  end if;
  return new;
end;
$$;

drop trigger if exists lesson_media_course on public.lesson_media;
create trigger lesson_media_course before insert or update of lesson_id on public.lesson_media
  for each row execute function public.media_course_from_lesson();

-- -----------------------------------------------------------------------------
-- RLS: liga em todas as tabelas
-- -----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_media    enable row level security;
alter table public.coupons         enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.settings        enable row level security;

-- Perfis: cada um vê e edita o seu; admin vê e edita todos
drop policy if exists "perfil: ler o próprio" on public.profiles;
create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "perfil: editar o próprio" on public.profiles;
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- Cursos: público vê os publicados; admin vê e edita todos
drop policy if exists "cursos: ler publicados" on public.courses;
create policy "cursos: ler publicados" on public.courses
  for select to anon, authenticated using (published or public.is_admin());

drop policy if exists "cursos: admin edita" on public.courses;
create policy "cursos: admin edita" on public.courses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Módulos e aulas (títulos): públicos quando o curso está publicado
drop policy if exists "módulos: ler" on public.modules;
create policy "módulos: ler" on public.modules
  for select to anon, authenticated using (
    public.is_admin() or exists (select 1 from public.courses c where c.id = course_id and c.published)
  );

drop policy if exists "módulos: admin edita" on public.modules;
create policy "módulos: admin edita" on public.modules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "aulas: ler" on public.lessons;
create policy "aulas: ler" on public.lessons
  for select to anon, authenticated using (
    public.is_admin() or exists (select 1 from public.courses c where c.id = course_id and c.published)
  );

drop policy if exists "aulas: admin edita" on public.lessons;
create policy "aulas: admin edita" on public.lessons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Vídeos: só admin, aluno matriculado, ou aula marcada como prévia gratuita
drop policy if exists "vídeos: ler" on public.lesson_media;
create policy "vídeos: ler" on public.lesson_media
  for select to anon, authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.enrollments e
      where e.course_id = lesson_media.course_id and e.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.lessons l join public.courses c on c.id = l.course_id
      where l.id = lesson_media.lesson_id and l.is_preview and c.published
    )
  );

drop policy if exists "vídeos: admin edita" on public.lesson_media;
create policy "vídeos: admin edita" on public.lesson_media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Cupons: só admin (a validação no checkout é feita pela função quote_order)
drop policy if exists "cupons: admin" on public.coupons;
create policy "cupons: admin" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedidos: aluno vê os seus; admin vê todos. Criar/alterar só pelo servidor ou admin.
drop policy if exists "pedidos: ler" on public.orders;
create policy "pedidos: ler" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "pedidos: admin altera" on public.orders;
create policy "pedidos: admin altera" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "itens: ler" on public.order_items;
create policy "itens: ler" on public.order_items
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

-- Matrículas: aluno vê as suas; só admin concede/remove manualmente
drop policy if exists "matrículas: ler" on public.enrollments;
create policy "matrículas: ler" on public.enrollments
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "matrículas: admin concede" on public.enrollments;
create policy "matrículas: admin concede" on public.enrollments
  for insert to authenticated with check (public.is_admin());

drop policy if exists "matrículas: admin remove" on public.enrollments;
create policy "matrículas: admin remove" on public.enrollments
  for delete to authenticated using (public.is_admin());

-- Progresso: o aluno marca as próprias aulas, só de cursos que ele tem
drop policy if exists "progresso: ler" on public.lesson_progress;
create policy "progresso: ler" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "progresso: marcar" on public.lesson_progress;
create policy "progresso: marcar" on public.lesson_progress
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.lessons l
      join public.enrollments e on e.course_id = l.course_id and e.user_id = (select auth.uid())
      where l.id = lesson_id
    )
  );

drop policy if exists "progresso: desmarcar" on public.lesson_progress;
create policy "progresso: desmarcar" on public.lesson_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- Configurações: leitura pública (preço do combo, contatos); edição só admin
drop policy if exists "config: ler" on public.settings;
create policy "config: ler" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "config: admin edita" on public.settings;
create policy "config: admin edita" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Permissões de coluna: o aluno só consegue editar nome e telefone do próprio perfil
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, role) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- Visitantes não escrevem em nada
revoke insert, update, delete on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Preço do pedido (sempre calculado aqui, nunca no navegador)
-- -----------------------------------------------------------------------------

create or replace function public.quote_order(
  p_course_ids uuid[],
  p_combo boolean default false,
  p_coupon text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s          public.settings;
  items      jsonb := '[]'::jsonb;
  subtotal   numeric(10, 2) := 0;
  disc       numeric(10, 2) := 0;
  c          public.coupons;
  coupon_out jsonb := null;
  coupon_err text := null;
  r          record;
begin
  select * into s from public.settings where id = 1;

  if p_combo then
    if not s.combo_active then
      raise exception 'O combo não está disponível no momento';
    end if;
    items := jsonb_build_array(jsonb_build_object(
      'kind', 'combo', 'course_id', null, 'title', s.combo_title, 'price', s.combo_price
    ));
    subtotal := s.combo_price;
  else
    if p_course_ids is null or cardinality(p_course_ids) = 0 then
      raise exception 'Carrinho vazio';
    end if;
    if cardinality(p_course_ids) > 50 then
      raise exception 'Itens demais no pedido';
    end if;
    for r in
      select c2.id, c2.title, c2.price
      from public.courses c2
      where c2.id = any (p_course_ids) and c2.published
      order by c2.position, c2.title
    loop
      items := items || jsonb_build_object('kind', 'course', 'course_id', r.id, 'title', r.title, 'price', r.price);
      subtotal := subtotal + r.price;
    end loop;
    if jsonb_array_length(items) <> (select count(distinct x) from unnest(p_course_ids) x) then
      raise exception 'Um ou mais cursos não estão disponíveis';
    end if;
  end if;

  if p_coupon is not null and btrim(p_coupon) <> '' then
    select * into c from public.coupons where code = upper(btrim(p_coupon));
    if c.id is null or not c.active then
      coupon_err := 'Cupom inválido';
    elsif c.starts_at is not null and c.starts_at > now() then
      coupon_err := 'Cupom ainda não está valendo';
    elsif c.expires_at is not null and c.expires_at < now() then
      coupon_err := 'Cupom expirado';
    elsif c.max_uses is not null and c.used_count >= c.max_uses then
      coupon_err := 'Cupom esgotado';
    else
      disc := case when c.kind = 'percent' then round(subtotal * c.value / 100, 2) else c.value end;
      disc := least(disc, subtotal);
      coupon_out := jsonb_build_object('id', c.id, 'code', c.code, 'kind', c.kind, 'value', c.value);
    end if;
  end if;

  return jsonb_build_object(
    'items', items,
    'subtotal', subtotal,
    'discount', disc,
    'total', subtotal - disc,
    'coupon', coupon_out,
    'coupon_error', coupon_err
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------

-- Cria pedido pendente (chamada pela Edge Function criar-pagamento, com service_role)
create or replace function public.create_order(
  p_user_id uuid,
  p_course_ids uuid[],
  p_combo boolean,
  p_coupon text,
  p_provider text,
  p_payer_name text,
  p_payer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q        jsonb;
  new_id   uuid;
  item     jsonb;
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Usuário inválido';
  end if;

  q := public.quote_order(p_course_ids, p_combo, p_coupon);
  if q ->> 'coupon_error' is not null then
    raise exception '%', q ->> 'coupon_error';
  end if;

  insert into public.orders (user_id, status, subtotal, discount, total, coupon_id, coupon_code,
                             payment_provider, payer_name, payer_email)
  values (p_user_id, 'pending', (q ->> 'subtotal')::numeric, (q ->> 'discount')::numeric,
          (q ->> 'total')::numeric, nullif(q -> 'coupon' ->> 'id', '')::uuid, q -> 'coupon' ->> 'code',
          p_provider, left(coalesce(p_payer_name, ''), 120), left(coalesce(p_payer_email, ''), 200))
  returning id into new_id;

  for item in select * from jsonb_array_elements(q -> 'items') loop
    insert into public.order_items (order_id, kind, course_id, title, price)
    values (new_id, item ->> 'kind', nullif(item ->> 'course_id', '')::uuid, item ->> 'title', (item ->> 'price')::numeric);
  end loop;

  return (select to_jsonb(o) || jsonb_build_object('items', q -> 'items') from public.orders o where o.id = new_id);
end;
$$;

-- Libera os cursos de um pedido pago (combo = todos os cursos publicados)
create or replace function public.grant_order_courses(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  if o.user_id is null then
    return;
  end if;

  insert into public.enrollments (user_id, course_id, order_id)
  select o.user_id, oi.course_id, o.id
  from public.order_items oi
  where oi.order_id = o.id and oi.kind = 'course' and oi.course_id is not null
  on conflict (user_id, course_id) do nothing;

  if exists (select 1 from public.order_items where order_id = o.id and kind = 'combo') then
    insert into public.enrollments (user_id, course_id, order_id)
    select o.user_id, c.id, o.id from public.courses c where c.published
    on conflict (user_id, course_id) do nothing;
  end if;
end;
$$;

-- Atualiza o pedido a partir do pagamento confirmado pelo gateway (só servidor)
create or replace function public.apply_payment(
  p_order_id uuid,
  p_payment_id text,
  p_status text,
  p_amount numeric,
  p_method text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.orders;
  new_status text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  new_status := case p_status
    when 'approved' then 'paid'
    when 'authorized' then 'pending'
    when 'pending' then 'pending'
    when 'in_process' then 'pending'
    when 'in_mediation' then 'pending'
    when 'rejected' then 'failed'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'refunded'
    when 'charged_back' then 'refunded'
    else o.status
  end;

  -- valor pago precisa bater com o total do pedido
  if new_status = 'paid' and abs(coalesce(p_amount, 0) - o.total) > 0.01 then
    raise exception 'Valor pago (%) diferente do total do pedido (%)', p_amount, o.total;
  end if;

  if new_status = 'paid' and o.status <> 'paid' then
    update public.orders
      set status = 'paid', paid_at = now(), payment_id = p_payment_id, payment_method = p_method
      where id = o.id;
    if o.coupon_id is not null then
      update public.coupons set used_count = used_count + 1 where id = o.coupon_id;
    end if;
    perform public.grant_order_courses(o.id);
  elsif new_status = 'refunded' and o.status <> 'refunded' then
    update public.orders set status = 'refunded', payment_id = coalesce(p_payment_id, payment_id) where id = o.id;
    delete from public.enrollments where order_id = o.id;
  elsif new_status in ('failed', 'cancelled') and o.status = 'pending' then
    update public.orders set status = new_status, payment_id = p_payment_id where id = o.id;
  elsif new_status = 'pending' and o.status = 'pending' then
    update public.orders set payment_id = p_payment_id where id = o.id;
  end if;

  return (select status from public.orders where id = o.id);
end;
$$;

-- Compra de teste (sem cobrança): só funciona com o modo de teste ligado pelo admin
create or replace function public.create_test_order(
  p_course_ids uuid[],
  p_combo boolean default false,
  p_coupon text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o   jsonb;
  uid uuid := auth.uid();
  p   public.profiles;
begin
  if uid is null then
    raise exception 'Faça login para continuar';
  end if;
  if not (select test_mode from public.settings where id = 1) then
    raise exception 'O modo de teste está desligado';
  end if;

  select * into p from public.profiles where id = uid;
  o := public.create_order(uid, p_course_ids, p_combo, p_coupon, 'test', p.full_name, p.email);
  perform public.apply_payment((o ->> 'id')::uuid, 'teste-' || (o ->> 'id'), 'approved', (o ->> 'total')::numeric, 'teste');
  return (select to_jsonb(x) from public.orders x where x.id = (o ->> 'id')::uuid);
end;
$$;

-- Estorno/cancelamento manual pelo admin (remove o acesso dado por esse pedido)
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if p_status not in ('paid', 'refunded', 'cancelled') then
    raise exception 'Status inválido';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  if p_status = 'paid' and o.status <> 'paid' then
    update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()),
      payment_provider = case when payment_provider = 'mercadopago' and payment_id is null then 'manual' else payment_provider end
      where id = o.id;
    perform public.grant_order_courses(o.id);
  elsif p_status in ('refunded', 'cancelled') and o.status <> p_status then
    update public.orders set status = p_status where id = o.id;
    delete from public.enrollments where order_id = o.id;
  end if;

  return (select status from public.orders where id = o.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Painel: números do período (faturamento, vendas, cursos, alunos)
-- -----------------------------------------------------------------------------

create or replace function public.admin_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  len   interval := p_to - p_from;
  prev_from timestamptz := p_from - (p_to - p_from);
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if p_to <= p_from or len > interval '800 days' then
    raise exception 'Período inválido';
  end if;

  with paid as (
    select * from public.orders where status = 'paid' and paid_at >= p_from and paid_at < p_to
  ),
  paid_prev as (
    select * from public.orders where status = 'paid' and paid_at >= prev_from and paid_at < p_from
  ),
  items as (
    select oi.* from public.order_items oi join paid on paid.id = oi.order_id
  ),
  bucket as (
    select case when len > interval '120 days' then 'month' else 'day' end as unit
  ),
  series as (
    select gs as period
    from bucket, generate_series(
      date_trunc(bucket.unit, p_from at time zone 'America/Sao_Paulo'),
      date_trunc(bucket.unit, (p_to - interval '1 second') at time zone 'America/Sao_Paulo'),
      case when bucket.unit = 'month' then interval '1 month' else interval '1 day' end
    ) gs
  ),
  by_period as (
    select date_trunc((select unit from bucket), paid_at at time zone 'America/Sao_Paulo') as period,
           sum(total) as revenue, count(*) as orders
    from paid group by 1
  )
  select jsonb_build_object(
    'unit', (select unit from bucket),
    'revenue', coalesce((select sum(total) from paid), 0),
    'orders', (select count(*) from paid),
    'courses_sold', (select count(*) from items),
    'avg_ticket', coalesce((select round(avg(total), 2) from paid), 0),
    'new_students', (select count(*) from public.profiles where role = 'student' and created_at >= p_from and created_at < p_to),
    'prev', jsonb_build_object(
      'revenue', coalesce((select sum(total) from paid_prev), 0),
      'orders', (select count(*) from paid_prev),
      'courses_sold', (select count(*) from public.order_items oi join paid_prev on paid_prev.id = oi.order_id),
      'avg_ticket', coalesce((select round(avg(total), 2) from paid_prev), 0),
      'new_students', (select count(*) from public.profiles where role = 'student' and created_at >= prev_from and created_at < p_from)
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period', to_char(series.period, 'YYYY-MM-DD'),
        'revenue', coalesce(bp.revenue, 0),
        'orders', coalesce(bp.orders, 0)
      ) order by series.period)
      from series left join by_period bp on bp.period = series.period
    ), '[]'::jsonb),
    'top_items', coalesce((
      select jsonb_agg(t order by t.revenue desc, t.title)
      from (
        select coalesce(c.title, items.title) as title, items.kind, count(*) as sold, sum(items.price) as revenue
        from items left join public.courses c on c.id = items.course_id
        group by 1, 2
        order by revenue desc
        limit 8
      ) t
    ), '[]'::jsonb),
    'status_counts', coalesce((
      select jsonb_object_agg(status, n)
      from (
        select status, count(*) as n from public.orders
        where created_at >= p_from and created_at < p_to group by status
      ) s
    ), '{}'::jsonb),
    'totals', jsonb_build_object(
      'students', (select count(*) from public.profiles where role = 'student'),
      'courses_published', (select count(*) from public.courses where published),
      'courses_total', (select count(*) from public.courses),
      'lessons', (select count(*) from public.lessons)
    )
  ) into result;

  return result;
end;
$$;

-- Lista de alunos com quantos cursos têm e quanto já gastaram
create or replace function public.admin_students(p_search text default null)
returns table (
  id uuid, email text, full_name text, phone text, role text, created_at timestamptz,
  confirmed boolean, courses bigint, spent numeric, last_order timestamptz
)
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
  select p.id, p.email, p.full_name, p.phone, p.role, p.created_at,
         (u.email_confirmed_at is not null) as confirmed,
         (select count(*) from public.enrollments e where e.user_id = p.id) as courses,
         coalesce((select sum(o.total) from public.orders o where o.user_id = p.id and o.status = 'paid'), 0) as spent,
         (select max(o.created_at) from public.orders o where o.user_id = p.id) as last_order
  from public.profiles p
  join auth.users u on u.id = p.id
  where p_search is null or btrim(p_search) = ''
     or p.email ilike '%' || btrim(p_search) || '%'
     or p.full_name ilike '%' || btrim(p_search) || '%'
  order by p.created_at desc
  limit 500;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quem pode chamar cada função
-- -----------------------------------------------------------------------------

revoke all on function public.create_order(uuid, uuid[], boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function public.apply_payment(uuid, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.grant_order_courses(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

grant execute on function public.create_order(uuid, uuid[], boolean, text, text, text, text) to service_role;
grant execute on function public.apply_payment(uuid, text, text, numeric, text) to service_role;
grant execute on function public.grant_order_courses(uuid) to service_role;

revoke all on function public.quote_order(uuid[], boolean, text) from public;
grant execute on function public.quote_order(uuid[], boolean, text) to anon, authenticated, service_role;

revoke all on function public.create_test_order(uuid[], boolean, text) from public, anon;
grant execute on function public.create_test_order(uuid[], boolean, text) to authenticated;

revoke all on function public.admin_set_order_status(uuid, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

revoke all on function public.admin_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_stats(timestamptz, timestamptz) to authenticated;

revoke all on function public.admin_students(text) from public, anon;
grant execute on function public.admin_students(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Imagens dos cursos (Storage): leitura pública, envio só pelo admin
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-images', 'course-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "imagens: admin envia" on storage.objects;
create policy "imagens: admin envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'course-images' and public.is_admin());

drop policy if exists "imagens: admin altera" on storage.objects;
create policy "imagens: admin altera" on storage.objects
  for update to authenticated using (bucket_id = 'course-images' and public.is_admin());

drop policy if exists "imagens: admin remove" on storage.objects;
create policy "imagens: admin remove" on storage.objects
  for delete to authenticated using (bucket_id = 'course-images' and public.is_admin());

-- Dono já cadastrado antes deste script: vira admin agora
update public.profiles set role = 'admin' where lower(email) = lower(public.owner_email()) and role <> 'admin';
