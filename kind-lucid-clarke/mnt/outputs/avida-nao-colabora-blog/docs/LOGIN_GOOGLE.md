# Login e cadastro com o Google

O site oferece "Cadastrar com o Google" e "Entrar com o Google" na tela `/login`. O código já está
no app; **o botão só aparece depois que o provedor Google é ligado no Supabase**. Enquanto isso não
for feito, nada muda para o visitante.

## Como ligar (uma vez, ~10 minutos)

Isto exige credenciais do Google e é feito no painel; não vai para o repositório.

1. **Google Cloud Console** → *APIs e serviços* → *Tela de permissão OAuth*: tipo *Externo*, nome do
   app "A Vida Não Colabora", e-mail de suporte, domínio `avidanaocolabora.com`, links da
   [Política de Privacidade](https://www.avidanaocolabora.com/privacidade) e dos
   [Termos](https://www.avidanaocolabora.com/termos). Escopos: apenas `openid`, `email` e `profile`
   (não exigem verificação do Google). Publique o app ("Em produção") para qualquer pessoa poder entrar.
2. *Credenciais* → *Criar credenciais* → *ID do cliente OAuth* → tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas**: `https://www.avidanaocolabora.com` e `https://avidanaocolabora.com`.
   - **URIs de redirecionamento autorizados**: `https://lejvvhzluggyxlfwfoxl.supabase.co/auth/v1/callback`
3. **Supabase** → *Authentication* → *Providers* → **Google** → ligar e colar o *Client ID* e o
   *Client Secret*. Salvar.
4. Nada mais: as URLs de retorno do site (`/login?oauth=google`) já estão na lista de permissões do
   Auth (`supabase/auth-config.json`).

Nunca coloque o Client Secret no código, em logs, em commits ou em variáveis `VITE_*`.

## Como funciona

- O botão consulta `GET /auth/v1/settings` e só é mostrado se `external.google` for verdadeiro.
- Fluxo: botão → Google (escolha de conta) → Supabase → `/login?oauth=google` → a tela conclui o
  acesso e leva para a área logada.
- **Cadastro novo** (conta criada e primeiro acesso no mesmo instante): registra `register_success`
  e `registration_complete`, dispara `CompleteRegistration` (Pixel/CAPI, respeitando o consentimento),
  grava a origem da campanha no usuário e envia o e-mail de boas-vindas. O nome vem do Google
  (`full_name`), então o aviso "Como você gostaria de ser chamado(a)?" não aparece.
- **Quem já tinha conta com o mesmo e-mail**: o Supabase vincula o Google à conta existente
  (e-mail verificado pelo Google); a pessoa entra normalmente e registra `login_success`.
- E-mail do Google já vem verificado: não há etapa de confirmação.
- Conta bloqueada pelo Admin continua bloqueada (mensagem de suporte).
- Quem entrou só com o Google pode definir uma senha depois por "Esqueci minha senha".
- O texto "Ao continuar com o Google você concorda com os Termos…" aparece no botão (login e cadastro),
  porque o Google não distingue "entrar" de "criar conta".

## Como testar depois de ligar

1. Janela anônima → `/login?mode=signup` → "Cadastrar com o Google" com uma conta Google que nunca
   usou o site. Deve cair na área logada, com o nome já preenchido.
2. Sair e "Entrar com o Google" de novo: entra direto, sem novo cadastro.
3. Admin → Usuários: o novo usuário aparece com o nome do Google.
