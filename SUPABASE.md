# Studio HomeFit: como ligar o banco, o login, o painel e os pagamentos

Enquanto o `.env` não tiver a chave do Supabase, o site funciona no **modo demonstração**: os cursos vêm do
`src/dados/conteudo.js`, não há login nem painel e as "compras" ficam só no navegador. Siga os passos abaixo
uma vez e tudo passa a funcionar de verdade.

Projeto: `https://ouxmqebhjtbqiwdihyvq.supabase.co`

---

## 1. Chaves no arquivo `.env` (2 minutos)

1. No Supabase: **Project Settings > API Keys**.
2. Copie a chave **anon public** (ou a **publishable key**, que começa com `sb_publishable_`).
3. Cole em `VITE_SUPABASE_ANON_KEY=` no arquivo `.env` da raiz do projeto.
4. Pare e rode de novo o `npm run dev` (o Vite só lê o `.env` ao iniciar).

> Nunca coloque no `.env` a **service_role / secret key** nem o token do Mercado Pago. Essas ficam só nos
> *Secrets* das Edge Functions (passo 6). O `.env` já está no `.gitignore`.

## 2. Criar o banco (3 minutos)

No Supabase: **SQL Editor > New query**.

1. Cole todo o arquivo `supabase/migrations/0001_estrutura.sql` e clique em **Run**.
2. Nova query: cole `supabase/migrations/0002_cursos_iniciais.sql` (os 8 cursos atuais, com módulos e aulas) e **Run**.
3. Nova query: cole `supabase/migrations/0003_videos.sql` (local privado para os vídeos enviados pelo painel) e **Run**.

Os arquivos podem ser rodados de novo sem duplicar nada.

O que o `0001_estrutura.sql` cria:

| Parte | Para que serve |
|---|---|
| `profiles` | Nome, WhatsApp e papel (aluno/admin) de cada conta |
| `courses`, `modules`, `lessons` | Cursos, módulos e aulas (o que aparece no site) |
| `lesson_media` | Link do vídeo de cada aula, **só visível para quem comprou** |
| `orders`, `order_items` | Pedidos e o que foi comprado em cada um |
| `enrollments` | Quem tem acesso a qual curso |
| `lesson_progress` | Aulas concluídas por aluno |
| `coupons` | Cupons de desconto |
| `settings` | Preço do combo, contatos, modo de teste |
| Bucket `course-images` | Imagens de capa enviadas pelo painel |

E o `0003_videos.sql` cria o bucket **privado** `lesson-videos`, com os vídeos enviados como arquivo.

### Vídeos das aulas: arquivo ou link

No painel, em **Cursos > (curso) > Aulas**, cada aula tem duas opções:

- **Enviar vídeo:** escolha o arquivo (MP4, WebM ou MOV). Aparece uma barra de progresso, e a duração da aula é
  preenchida sozinha. Se a internet cair, o envio continua de onde parou. Se fechar a página, envie o mesmo arquivo
  de novo na mesma aula e ele retoma o envio. Depois dá para **Assistir**, **Trocar** ou **Remover**, e o arquivo
  antigo é apagado do servidor.
- **Colar link:** YouTube (não listado), Vimeo, Panda etc.

Quem assiste um vídeo enviado recebe um link temporário (6 horas), gerado só para quem comprou o curso, para o admin,
ou para qualquer visitante se a aula estiver marcada como **prévia grátis**. Esse link não serve como endereço fixo
para compartilhar.

**Limites do plano do Supabase (importante):**

| | Plano Free | Plano Pro (US$ 25/mês) |
|---|---|---|
| Tamanho máximo por arquivo | **50 MB** (cerca de 3 a 5 min em 1080p) | Ajustável até 500 GB em **Storage > Settings** |
| Espaço total | 1 GB | 100 GB inclusos |
| Tráfego por mês (alunos assistindo) | 5 GB | 250 GB inclusos |

Para aulas longas, ou com muitos alunos, o mais econômico é exportar em **MP4 720p** e usar o plano Pro, ou hospedar
no **Panda Video**, **Bunny Stream** ou **Vimeo** e colar o link. As duas formas podem ser usadas no mesmo curso.

## 3. Configurar o login (3 minutos) 

No Supabase: **Authentication**.

1. **URL Configuration**
   - *Site URL*: o endereço do site (ex.: `https://studiohomefit.com.br`).
   - *Redirect URLs*: adicione `https://studiohomefit.com.br/**`, `http://localhost:5173/**` e `http://localhost:4173/**`.
2. **Sign In / Providers > Email**
   - **Confirm email**: ligado (o dono só vira admin depois de confirmar o e-mail).
   - **Secure password change** e **Secure email change**: ligados.
   - **Minimum password length**: 8, e em *Password requirements* escolha **letras e números**.
3. **E-mails de verdade (importante):** o envio padrão do Supabase só manda e-mails para os membros da equipe
   do projeto e tem limite por hora. Para os alunos receberem a confirmação e o "esqueci minha senha", configure
   um SMTP em **Authentication > Emails > SMTP Settings** (Resend, Brevo e Amazon SES têm planos grátis).
4. Opcional: traduza os modelos de e-mail em **Authentication > Emails > Templates**.

## 4. Criar a conta do dono (1 minuto)

Faça isso **o quanto antes**: enquanto a conta do dono não existe, outra pessoa poderia tentar cadastrar esse e-mail primeiro.

1. Rode o site, clique no ícone de usuário e **Criar conta** com **gabrielooopi98@gmail.com**.
2. Confirme o e-mail pelo link que chegar.
3. O site pede para você **criar a senha do painel** na hora. Isso garante que só você sabe a senha, mesmo que alguém tenha cadastrado o e-mail antes, e desconecta qualquer outro aparelho.
4. Pronto: a conta vira administradora e o menu mostra **Painel de ADM**.

Se o login com a sua senha não funcionar depois de confirmar, use **Esqueci minha senha**: o link do e-mail também cria uma senha nova e derruba os outros acessos.

Para ter mais administradores: **Painel > Alunos > (pessoa) > Tornar administrador**.

## 5. Testar tudo antes do Mercado Pago (opcional)

**Painel > Configurações > Pagamentos > Modo de teste**: com ele ligado, qualquer pessoa logada "compra" sem
pagar. Serve para testar a compra, a área do aluno e os números do painel.
**Desligue antes de divulgar o site.**

## 6. Ligar o Mercado Pago (Pix, cartão e boleto)

1. **Credenciais**: no Mercado Pago, entre em *Seu negócio > Configurações > Credenciais* (ou no painel de
   desenvolvedores) e copie o **Access Token**. Comece pelo de teste (`TEST-...`) e depois troque pelo de produção.
2. **Publicar as funções** (no terminal, na pasta do projeto):

   ```bash
   npx supabase login
   npx supabase link --project-ref ouxmqebhjtbqiwdihyvq
   npx supabase secrets set MP_ACCESS_TOKEN=SEU_ACCESS_TOKEN SITE_URL=https://studiohomefit.com.br
   npx supabase functions deploy criar-pagamento
   npx supabase functions deploy webhook-mercadopago
   ```

   O `supabase/config.toml` já deixa as duas funções sem a checagem automática de token, porque o login é
   conferido dentro da `criar-pagamento` e o Mercado Pago não manda token de usuário.
3. **Webhook**: no Mercado Pago, em *Suas integrações > (sua aplicação) > Webhooks*:
   - URL: `https://ouxmqebhjtbqiwdihyvq.supabase.co/functions/v1/webhook-mercadopago`
   - Evento: **Pagamentos**
   - Copie a **assinatura secreta** e rode:
     `npx supabase secrets set MP_WEBHOOK_SECRET=SUA_ASSINATURA_SECRETA`
4. **Teste** com a credencial `TEST-` e os cartões de teste do Mercado Pago. Depois troque o `MP_ACCESS_TOKEN`
   pelo de produção e **desligue o modo de teste** no painel.

Como funciona:

1. O aluno logado clica em pagar.
2. A função `criar-pagamento` cria o pedido com o **preço calculado no banco** e abre a página segura do Mercado Pago.
3. Quando o pagamento é aprovado, o Mercado Pago avisa a função `webhook-mercadopago`. Ela busca o pagamento direto
   na API do Mercado Pago e confere se o valor bate com o pedido. Só então libera os cursos.
4. O aluno volta para o site (`/?pedido=...`) e vê o status atualizando sozinho.
5. Estorno ou chargeback no Mercado Pago removem o acesso daquele pedido automaticamente.

## Segurança: o que já está protegido

- **RLS em todas as tabelas.** Mesmo com a chave pública (que é visível no navegador), ninguém lê ou altera o
  que não pode.
- **Admin exige papel `admin` e e-mail confirmado.** Ninguém consegue se promover: o banco bloqueia, e testamos isso.
- **O valor da compra nunca vem do navegador.** É calculado no banco (`quote_order`), e o webhook confere o valor
  pago contra o total do pedido.
- **Pedidos e matrículas só nascem no servidor:** Edge Functions com a service_role, ou o modo de teste ligado
  pelo admin.
- **Vídeos protegidos.** Só quem comprou o curso (ou aula marcada como prévia grátis) consegue ler o link. Os
  arquivos enviados ficam num bucket privado: só o admin envia ou apaga, e quem assiste recebe um link que expira.
  Para links externos, use YouTube "não listado", Vimeo ou Panda com domínio restrito.
- **Webhook com assinatura (HMAC) conferida** e pagamento consultado direto no Mercado Pago. Avisos repetidos
  não liberam nada duas vezes.
- **Login:**
  - mensagens que não revelam se o e-mail existe;
  - pausa crescente depois de 5 senhas erradas;
  - senha forte obrigatória;
  - campo contra robôs no cadastro;
  - links de e-mail com código de uso único (PKCE);
  - limite de tentativas do próprio Supabase.
- **Sempre existe pelo menos um administrador:** o último não consegue se remover.
- **Trocar a senha desconecta os outros aparelhos**, tanto pelo "esqueci minha senha" quanto em Minha conta.
- **Cabeçalhos de segurança no site publicado** (`vercel.json`): o navegador só carrega scripts do próprio site e só envia dados para o Supabase. O site também não pode ser aberto dentro de outro site, o que evita cliques falsos.

Arquivos do servidor:

- `supabase/migrations/0001_estrutura.sql`: tabelas, regras (RLS), funções e permissões.
- `supabase/migrations/0002_cursos_iniciais.sql`: cursos iniciais.
- `supabase/migrations/0003_videos.sql`: bucket privado dos vídeos e quem pode assistir.
- `supabase/functions/criar-pagamento`: cria o pedido e o pagamento.
- `supabase/functions/webhook-mercadopago`: confirma pagamentos, estornos e chargebacks.
