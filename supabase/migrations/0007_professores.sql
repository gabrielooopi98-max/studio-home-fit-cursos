-- =============================================================================
-- Studio HomeFit: cards dos professores editáveis no painel
-- Rode depois do 0001 ao 0006. Pode rodar de novo sem problema.
--
-- Os professores da seção "Conheça seus professores" ficam nas configurações da loja
-- (settings.trainers), numa lista em JSON:
--   [{ "name", "role", "cref", "bio", "specialties": [...], "instagram" }, ...]
-- Vazio (null) = o site mostra os professores que vêm no código (src/dados/conteudo.js).
-- Leitura pública (como o resto das configurações); só o admin edita (regra já existente).
-- =============================================================================

alter table public.settings add column if not exists trainers jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_trainers_check') then
    alter table public.settings add constraint settings_trainers_check check (
      trainers is null or (
        jsonb_typeof(trainers) = 'array'
        and jsonb_array_length(trainers) between 1 and 6
        and octet_length(trainers::text) <= 20000
      )
    );
  end if;
end;
$$;
