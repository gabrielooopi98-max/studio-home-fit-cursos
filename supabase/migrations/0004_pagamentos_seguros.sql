-- =============================================================================
-- Studio HomeFit: pagamentos mais seguros
-- Rode depois do 0001, 0002 e 0003. Pode rodar de novo sem problema.
-- Se um dia rodar o 0001 de novo, rode este arquivo logo depois (ele substitui
-- as funções de pagamento do 0001).
--
-- O que muda:
--   * Registro de todos os eventos de pagamento (payment_events), só o admin lê.
--   * O mesmo pagamento não libera dois pedidos.
--   * Moeda conferida (só BRL) além do valor.
--   * Estorno de um pagamento não tira o acesso pago por outro pagamento, e não
--     tira cursos que o aluno também comprou em outro pedido.
--   * Pedido estornado ou cancelado depois de pago não volta sozinho para "pago"
--     com um aviso atrasado (só o admin reativa).
--   * Não dá para comprar de novo um curso que já tem.
--   * Compra de teste (sem cobrança) só para administradores.
--   * Lista de inconsistências para o painel e rotina de correção.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas e colunas novas
-- -----------------------------------------------------------------------------

-- Histórico de eventos de pagamento (auditoria). order_id sem chave estrangeira
-- de propósito: o registro continua existindo mesmo se o pedido for apagado.
create table if not exists public.payment_events (
  id          bigint generated always as identity primary key,
  order_id    uuid,
  payment_id  text,
  mp_status   text,
  amount      numeric(10, 2),
  currency    text,
  source      text not null default 'mercadopago' check (source in ('mercadopago', 'test', 'free', 'admin')),
  result      text not null,
  created_at  timestamptz not null default now()
);

create index if not exists payment_events_order_idx on public.payment_events (order_id, created_at desc);
create index if not exists payment_events_created_idx on public.payment_events (created_at desc);

-- Última consulta ao Mercado Pago (limita as conferências por pedido)
alter table public.orders add column if not exists checked_at timestamptz;

-- Um pagamento só pode ter pagado um pedido
create unique index if not exists orders_payment_paid_uq
  on public.orders (payment_id)
  where paid_at is not null and payment_id is not null;

alter table public.payment_events enable row level security;

drop policy if exists "eventos de pagamento: admin lê" on public.payment_events;
create policy "eventos de pagamento: admin lê" on public.payment_events
  for select to authenticated using (public.is_admin());

revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;

-- -----------------------------------------------------------------------------
-- Pedido: recusa curso que o aluno já tem
-- -----------------------------------------------------------------------------

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
  q       jsonb;
  new_id  uuid;
  item    jsonb;
  owned   text;
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Usuário inválido';
  end if;

  q := public.quote_order(p_course_ids, p_combo, p_coupon);
  if q ->> 'coupon_error' is not null then
    raise exception '%', q ->> 'coupon_error';
  end if;

  if p_combo then
    if not exists (
      select 1 from public.courses c
      where c.published
        and not exists (select 1 from public.enrollments e where e.user_id = p_user_id and e.course_id = c.id)
    ) then
      raise exception 'Você já tem todos os cursos';
    end if;
  else
    select c.title into owned
    from public.enrollments e join public.courses c on c.id = e.course_id
    where e.user_id = p_user_id and e.course_id = any (p_course_ids)
    limit 1;
    if owned is not null then
      raise exception 'Você já tem o curso "%"', owned;
    end if;
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

-- -----------------------------------------------------------------------------
-- Remover acesso de um pedido sem tirar o que o aluno pagou em outros pedidos
-- -----------------------------------------------------------------------------

create or replace function public.revoke_order_courses(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  r   record;
begin
  select user_id into uid from public.orders where id = p_order_id;
  delete from public.enrollments where order_id = p_order_id;
  if uid is null then
    return;
  end if;
  -- o mesmo curso pode ter vindo também de outro pedido pago (ex.: curso avulso + combo)
  for r in
    select id from public.orders
    where user_id = uid and status = 'paid' and id <> p_order_id
    order by paid_at
  loop
    perform public.grant_order_courses(r.id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pagamento confirmado pelo servidor
--
-- Chamada só pelas Edge Functions (service_role), DEPOIS de buscar o pagamento
-- direto na API do Mercado Pago. Devolve o que foi feito (fica registrado em
-- payment_events):
--   liberado | repetido | pendente | failed | cancelled | acesso_removido
--   ignorado:...  (aviso fora de ordem ou de status desconhecido; nada muda)
--   alerta:...    (nada muda, mas o admin deve olhar: pagamento em dobro etc.)
--   recusado:...  (valor, moeda ou pedido não batem; nada é liberado)
-- -----------------------------------------------------------------------------

drop function if exists public.apply_payment(uuid, text, text, numeric, text);

create or replace function public.apply_payment(
  p_order_id uuid,
  p_payment_id text,
  p_status text,
  p_amount numeric,
  p_currency text,
  p_method text default null,
  p_source text default 'mercadopago'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.orders;
  pid        text := nullif(btrim(coalesce(p_payment_id, '')), '');
  new_status text;
  other_pid  text;
  result     text;
begin
  -- trava o pedido: avisos simultâneos do mesmo pedido são processados um de cada vez
  select * into o from public.orders where id = p_order_id for update;

  if o.id is null then
    result := 'recusado:pedido_inexistente';
  else
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
      else null
    end;

    if new_status is null then
      result := 'ignorado:status_desconhecido';

    elsif new_status = 'paid' then
      if upper(coalesce(p_currency, '')) <> 'BRL' then
        result := 'recusado:moeda';
      elsif p_amount is null or abs(p_amount - o.total) > 0.01 then
        result := 'recusado:valor';
      elsif o.status = 'paid' then
        -- o mesmo aviso de novo (normal) ou um segundo pagamento do mesmo pedido (devolver um deles)
        result := case when o.payment_id is not distinct from pid then 'repetido' else 'alerta:pagamento_em_dobro' end;
      elsif o.status in ('refunded', 'cancelled') and o.paid_at is not null then
        -- já foi pago e depois estornado/cancelado: só o admin reativa
        result := 'ignorado:pedido_encerrado';
      elsif pid is not null and exists (
        select 1 from public.orders x where x.payment_id = pid and x.id <> o.id and x.paid_at is not null
      ) then
        result := 'recusado:pagamento_de_outro_pedido';
      else
        update public.orders
          set status = 'paid', paid_at = now(), payment_id = pid, payment_method = left(p_method, 40)
          where id = o.id;
        if o.coupon_id is not null then
          update public.coupons set used_count = used_count + 1 where id = o.coupon_id;
        end if;
        perform public.grant_order_courses(o.id);
        result := 'liberado';
      end if;

    elsif new_status = 'refunded' then
      if o.status = 'refunded' then
        result := 'repetido';
      elsif o.status = 'paid' and o.payment_id is distinct from pid then
        -- estorno de um pagamento que não foi o que pagou este pedido (ex.: pagou duas vezes)
        result := 'alerta:estorno_de_outro_pagamento';
      else
        -- pagou duas vezes e o estornado foi o que liberou: o outro pagamento aprovado passa a valer
        if o.status = 'paid' then
          select e.payment_id into other_pid
          from public.payment_events e
          where e.order_id = o.id and e.result = 'alerta:pagamento_em_dobro' and e.payment_id is distinct from pid
            and not exists (
              select 1 from public.payment_events r
              where r.order_id = o.id and r.payment_id = e.payment_id and r.mp_status in ('refunded', 'charged_back')
            )
          order by e.created_at desc
          limit 1;
        end if;

        if other_pid is not null then
          update public.orders set payment_id = other_pid where id = o.id;
          result := 'alerta:estorno_com_outro_pagamento_valido';
        else
          update public.orders set status = 'refunded', payment_id = coalesce(pid, payment_id) where id = o.id;
          perform public.revoke_order_courses(o.id);
          result := 'acesso_removido';
        end if;
      end if;

    elsif new_status in ('failed', 'cancelled') then
      if o.status = 'pending' then
        update public.orders set status = new_status, payment_id = coalesce(pid, payment_id) where id = o.id;
        result := new_status;
      else
        result := 'ignorado:fora_de_ordem';
      end if;

    else -- pending
      -- 'failed' volta para pendente: o aluno tentou de novo (ex.: cartão recusado e depois Pix)
      if o.status in ('pending', 'failed') then
        update public.orders set status = 'pending', payment_id = coalesce(pid, payment_id) where id = o.id;
        result := 'pendente';
      else
        result := 'ignorado:fora_de_ordem';
      end if;
    end if;
  end if;

  insert into public.payment_events (order_id, payment_id, mp_status, amount, currency, source, result)
  values (p_order_id, left(pid, 60), left(p_status, 30), p_amount, left(p_currency, 5),
          coalesce(p_source, 'mercadopago'), result);

  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Compra de teste: modo de teste ligado E administrador
-- (se o modo de teste ficar ligado por engano, aluno nenhum ganha curso de graça)
-- -----------------------------------------------------------------------------

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
  if not public.is_admin() then
    raise exception 'A loja está em modo de teste: só administradores conseguem finalizar compras agora';
  end if;

  select * into p from public.profiles where id = uid;
  o := public.create_order(uid, p_course_ids, p_combo, p_coupon, 'test', p.full_name, p.email);
  perform public.apply_payment((o ->> 'id')::uuid, 'teste-' || (o ->> 'id'), 'approved',
                               (o ->> 'total')::numeric, 'BRL', 'teste', 'test');
  return (select to_jsonb(x) from public.orders x where x.id = (o ->> 'id')::uuid);
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: marcar pago, estornar ou cancelar à mão (fica registrado)
-- -----------------------------------------------------------------------------

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
    perform public.revoke_order_courses(o.id);
  end if;

  insert into public.payment_events (order_id, payment_id, mp_status, amount, currency, source, result)
  values (o.id, o.payment_id, null, o.total, 'BRL', 'admin', 'admin:' || p_status || ' por ' || coalesce(auth.uid()::text, '?'));

  return (select status from public.orders where id = o.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Conferência: o que está fora do lugar
-- -----------------------------------------------------------------------------

-- Pedidos pagos em que o aluno está sem algum curso do pedido
create or replace function public.paid_orders_missing_access()
returns table (order_id uuid, user_id uuid, paid_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.user_id, o.paid_at
  from public.orders o
  where o.status = 'paid' and o.user_id is not null
    and (
      exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id and oi.kind = 'course' and oi.course_id is not null
          and not exists (select 1 from public.enrollments e where e.user_id = o.user_id and e.course_id = oi.course_id)
      )
      or (
        exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.kind = 'combo')
        and exists (
          select 1 from public.courses c
          where c.published
            and not exists (select 1 from public.enrollments e where e.user_id = o.user_id and e.course_id = c.id)
        )
      )
    );
$$;

-- Painel: resumo do que precisa de atenção
create or replace function public.admin_payment_issues()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  return jsonb_build_object(
    'paid_without_access', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.order_id, 'paid_at', m.paid_at) order by m.paid_at desc)
      from public.paid_orders_missing_access() m
    ), '[]'::jsonb),
    'access_without_payment', coalesce((
      select jsonb_agg(jsonb_build_object('order_id', e.order_id, 'user_id', e.user_id, 'course_id', e.course_id, 'status', o.status))
      from public.enrollments e join public.orders o on o.id = e.order_id
      where o.status <> 'paid'
    ), '[]'::jsonb),
    'old_pending', (
      select count(*) from public.orders where status = 'pending' and created_at < now() - interval '3 days'
    ),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object('order_id', a.order_id, 'payment_id', a.payment_id, 'result', a.result, 'created_at', a.created_at)
                       order by a.created_at desc)
      from (
        select * from public.payment_events
        where (result like 'alerta:%' or result like 'recusado:%') and created_at > now() - interval '30 days'
        order by created_at desc
        limit 50
      ) a
    ), '[]'::jsonb)
  );
end;
$$;

-- Correção automática (servidor): pedido pago sem o acesso -> libera de novo
create or replace function public.repair_paid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  fixed integer := 0;
begin
  for r in select order_id from public.paid_orders_missing_access() loop
    perform public.grant_order_courses(r.order_id);
    insert into public.payment_events (order_id, source, result) values (r.order_id, 'admin', 'reparo:acesso_liberado');
    fixed := fixed + 1;
  end loop;
  return fixed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quem pode chamar cada função
-- -----------------------------------------------------------------------------

revoke all on function public.apply_payment(uuid, text, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, numeric, text, text, text) to service_role;

revoke all on function public.revoke_order_courses(uuid) from public, anon, authenticated;
grant execute on function public.revoke_order_courses(uuid) to service_role;

revoke all on function public.paid_orders_missing_access() from public, anon, authenticated;
grant execute on function public.paid_orders_missing_access() to service_role;

revoke all on function public.repair_paid_orders() from public, anon, authenticated;
grant execute on function public.repair_paid_orders() to service_role;

revoke all on function public.create_order(uuid, uuid[], boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid[], boolean, text, text, text, text) to service_role;

revoke all on function public.create_test_order(uuid[], boolean, text) from public, anon;
grant execute on function public.create_test_order(uuid[], boolean, text) to authenticated;

revoke all on function public.admin_set_order_status(uuid, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

revoke all on function public.admin_payment_issues() from public, anon;
grant execute on function public.admin_payment_issues() to authenticated;
