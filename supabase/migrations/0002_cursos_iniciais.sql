-- =============================================================================
-- Studio HomeFit: cursos iniciais (os 8 cursos do site, com módulos e aulas)
-- Rode depois do 0001_estrutura.sql. Pode rodar de novo: não duplica nada.
-- As aulas entram como "Aula 01", "Aula 02"...: troque títulos e vídeos no painel de ADM.
-- =============================================================================

update public.settings set
  combo_title = 'Combo Completo',
  combo_description = 'Todos os cursos do Studio HomeFit em um só acesso, para treinar com técnica do básico ao avançado.',
  combo_price = 397,
  combo_old_price = 826,
  combo_installments = 12,
  combo_features = array['Todos os cursos', 'Acesso vitalício + atualizações', 'Grupo exclusivo de alunos', 'Análise de 3 vídeos do seu treino', 'Certificados de todos os cursos', 'Material de apoio em PDF'],
  whatsapp = '5564999258218',
  contact_email = 'contato@studiohomefit.com.br'
where id = 1;

-- Fundamentos da Execução
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('fundamentos', 'Fundamentos da Execução', 'Postura • Respiração • Core', 'Iniciante', 'A base de tudo: alinhamento, respiração, ativação do core e controle de carga para treinar com segurança.',
        'https://images.unsplash.com/photo-1518611012118-696072aa579a', '2h40', 67, 117, true, true, 1)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'fundamentos'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Postura neutra e alinhamento articular', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3)) as l(title, pos);

with course as (select id from public.courses where slug = 'fundamentos'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Respiração e bracing: protegendo a coluna', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 04', 4), ('Aula 05', 5), ('Aula 06', 6)) as l(title, pos);

with course as (select id from public.courses where slug = 'fundamentos'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Ativação do core em qualquer exercício', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 07', 7), ('Aula 08', 8), ('Aula 09', 9)) as l(title, pos);

with course as (select id from public.courses where slug = 'fundamentos'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Cadência, amplitude e controle de carga', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 10', 10), ('Aula 11', 11), ('Aula 12', 12)) as l(title, pos);

-- Agachamento Perfeito
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('agachamento', 'Agachamento Perfeito', 'Membros inferiores', 'Iniciante', 'Profundidade, posição dos joelhos, quadril e coluna. Variações livre, smith, goblet e búlgaro.',
        'https://images.unsplash.com/photo-1574680096145-d05b474e2155', '3h20', 97, 147, true, true, 2)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'agachamento'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Anatomia do agachamento e mobilidade necessária', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4), ('Aula 05', 5)) as l(title, pos);

with course as (select id from public.courses where slug = 'agachamento'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Agachamento livre: setup, descida e subida', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 06', 6), ('Aula 07', 7), ('Aula 08', 8), ('Aula 09', 9), ('Aula 10', 10)) as l(title, pos);

with course as (select id from public.courses where slug = 'agachamento'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Variações: goblet, smith, búlgaro e hack', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 11', 11), ('Aula 12', 12), ('Aula 13', 13), ('Aula 14', 14)) as l(title, pos);

with course as (select id from public.courses where slug = 'agachamento'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Os 7 erros mais comuns e como corrigir', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 15', 15), ('Aula 16', 16), ('Aula 17', 17), ('Aula 18', 18)) as l(title, pos);

-- Terra sem Dor nas Costas
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('terra', 'Terra sem Dor nas Costas', 'Cadeia posterior', 'Intermediário', 'Levantamento terra, stiff e RDL com a coluna protegida. Pegada, setup e travamento corretos.',
        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438', '3h50', 127, 197, false, true, 3)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'terra'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Dobradiça de quadril: o movimento-base', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4), ('Aula 05', 5)) as l(title, pos);

with course as (select id from public.courses where slug = 'terra'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Terra convencional e sumô passo a passo', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 06', 6), ('Aula 07', 7), ('Aula 08', 8), ('Aula 09', 9), ('Aula 10', 10)) as l(title, pos);

with course as (select id from public.courses where slug = 'terra'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Stiff e RDL para posteriores e glúteos', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 11', 11), ('Aula 12', 12), ('Aula 13', 13), ('Aula 14', 14), ('Aula 15', 15)) as l(title, pos);

with course as (select id from public.courses where slug = 'terra'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Progressão de carga sem sobrecarregar a lombar', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 16', 16), ('Aula 17', 17), ('Aula 18', 18), ('Aula 19', 19), ('Aula 20', 20)) as l(title, pos);

-- Supino & Empurrões Seguros
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('supino', 'Supino & Empurrões Seguros', 'Peitoral • Tríceps', 'Intermediário', 'Retração escapular, trajetória da barra e proteção do ombro no supino reto, inclinado e com halteres.',
        'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61', '3h05', 97, 147, false, true, 4)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'supino'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Escápulas, arco e base: o setup do supino', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4)) as l(title, pos);

with course as (select id from public.courses where slug = 'supino'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Trajetória da barra e posição dos cotovelos', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 05', 5), ('Aula 06', 6), ('Aula 07', 7), ('Aula 08', 8)) as l(title, pos);

with course as (select id from public.courses where slug = 'supino'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Supino inclinado, declinado e com halteres', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 09', 9), ('Aula 10', 10), ('Aula 11', 11), ('Aula 12', 12)) as l(title, pos);

with course as (select id from public.courses where slug = 'supino'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Flexões, paralelas e crucifixos sem dor no ombro', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 13', 13), ('Aula 14', 14), ('Aula 15', 15), ('Aula 16', 16)) as l(title, pos);

-- Costas de Aço
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('costas', 'Costas de Aço', 'Remadas • Puxadas', 'Intermediário', 'Sinta as costas trabalhando de verdade: puxada, remada curvada, serrote e barra fixa com técnica.',
        'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5', '2h55', 97, 147, false, true, 5)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'costas'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Conexão mente-músculo: sentindo as costas', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4)) as l(title, pos);

with course as (select id from public.courses where slug = 'costas'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Puxadas: frente, supinada e barra fixa', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 05', 5), ('Aula 06', 6), ('Aula 07', 7), ('Aula 08', 8)) as l(title, pos);

with course as (select id from public.courses where slug = 'costas'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Remadas: curvada, cavalinho e serrote', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 09', 9), ('Aula 10', 10), ('Aula 11', 11), ('Aula 12', 12)) as l(title, pos);

with course as (select id from public.courses where slug = 'costas'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Pegadas, amplitude e erros que roubam o estímulo', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 13', 13), ('Aula 14', 14), ('Aula 15', 15)) as l(title, pos);

-- Ombros Blindados
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('ombros', 'Ombros Blindados', 'Deltoides • Manguito', 'Avançado', 'Desenvolvimento, elevações e fortalecimento do manguito rotador para crescer sem lesionar.',
        'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e', '2h30', 117, 167, false, true, 6)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'ombros'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Biomecânica do ombro e zonas de risco', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4)) as l(title, pos);

with course as (select id from public.courses where slug = 'ombros'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Desenvolvimento com barra e halteres', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 05', 5), ('Aula 06', 6), ('Aula 07', 7), ('Aula 08', 8)) as l(title, pos);

with course as (select id from public.courses where slug = 'ombros'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Elevações lateral, frontal e crucifixo inverso', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 09', 9), ('Aula 10', 10), ('Aula 11', 11)) as l(title, pos);

with course as (select id from public.courses where slug = 'ombros'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Rotina preventiva para o manguito rotador', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 12', 12), ('Aula 13', 13), ('Aula 14', 14)) as l(title, pos);

-- Treino em Casa com Técnica
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('casa', 'Treino em Casa com Técnica', 'Peso corporal • Elásticos', 'Iniciante', 'Flexões, afundos, pranchas e treinos com elástico executados com a mesma precisão da academia.',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b', '4h10', 77, 127, false, true, 7)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'casa'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Montando seu espaço de treino em casa', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4), ('Aula 05', 5), ('Aula 06', 6)) as l(title, pos);

with course as (select id from public.courses where slug = 'casa'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Membros inferiores só com peso corporal', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 07', 7), ('Aula 08', 8), ('Aula 09', 9), ('Aula 10', 10), ('Aula 11', 11), ('Aula 12', 12)) as l(title, pos);

with course as (select id from public.courses where slug = 'casa'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Superiores com elásticos e mochila', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 13', 13), ('Aula 14', 14), ('Aula 15', 15), ('Aula 16', 16), ('Aula 17', 17)) as l(title, pos);

with course as (select id from public.courses where slug = 'casa'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Core, pranchas e treinos completos guiados', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 18', 18), ('Aula 19', 19), ('Aula 20', 20), ('Aula 21', 21), ('Aula 22', 22)) as l(title, pos);

-- Biomecânica para Hipertrofia
insert into public.courses (slug, title, tag, level, description, image_url, hours, price, old_price, bestseller, published, position)
values ('biomecanica', 'Biomecânica para Hipertrofia', 'Método avançado', 'Avançado', 'Amplitude, cadência, alavancas e curva de força para extrair o máximo de cada repetição.',
        'https://images.unsplash.com/photo-1599058917212-d750089bc07e', '5h15', 147, 247, false, true, 8)
on conflict (slug) do nothing;

with course as (select id from public.courses where slug = 'biomecanica'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Alavancas, torque e curva de resistência', 1 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 1)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 01', 1), ('Aula 02', 2), ('Aula 03', 3), ('Aula 04', 4), ('Aula 05', 5), ('Aula 06', 6)) as l(title, pos);

with course as (select id from public.courses where slug = 'biomecanica'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Escolhendo exercícios pelo comprimento muscular', 2 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 2)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 07', 7), ('Aula 08', 8), ('Aula 09', 9), ('Aula 10', 10), ('Aula 11', 11), ('Aula 12', 12)) as l(title, pos);

with course as (select id from public.courses where slug = 'biomecanica'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Cadência, falha e técnicas avançadas', 3 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 3)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 13', 13), ('Aula 14', 14), ('Aula 15', 15), ('Aula 16', 16), ('Aula 17', 17), ('Aula 18', 18)) as l(title, pos);

with course as (select id from public.courses where slug = 'biomecanica'),
     mod as (
       insert into public.modules (course_id, title, position)
       select course.id, 'Montando treinos com base em biomecânica', 4 from course
       where not exists (select 1 from public.modules x where x.course_id = course.id and x.position = 4)
       returning id
     )
insert into public.lessons (module_id, course_id, title, position)
select mod.id, course.id, l.title, l.pos
from mod, course, (values ('Aula 19', 19), ('Aula 20', 20), ('Aula 21', 21), ('Aula 22', 22), ('Aula 23', 23), ('Aula 24', 24)) as l(title, pos);
