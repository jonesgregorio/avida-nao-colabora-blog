# Sentry — ativação do monitoramento externo

A aplicação possui integração opcional com o Loader Script oficial do Sentry.
Sem a variável `VITE_SENTRY_LOADER_URL`, nenhum script do Sentry é carregado e nenhum dado é enviado.

## Ativação

1. No Sentry, crie um projeto do tipo **React / Browser JavaScript** para o site.
2. Em **Settings → Projects → Client Keys (DSN)**, localize o **Loader Script / CDN URL** do projeto.
3. A URL deve ter este formato:
   `https://js.sentry-cdn.com/SEU_CLIENT_KEY_PUBLICO.min.js`
4. No projeto da Vercel, crie a variável de ambiente de **Production**:
   `VITE_SENTRY_LOADER_URL=<URL_DO_LOADER>`
5. Faça um novo deployment de produção.
6. No Sentry, confirme a chegada de um evento de teste antes de considerar o monitoramento operacional.

## Configuração de privacidade recomendada no Sentry

Este produto lida com conteúdo emocional e potencialmente sensível. No Client Key / Loader Script do projeto:

- mantenha **Session Replay desativado**;
- mantenha **User Feedback automático desativado**;
- não habilite captura de logs/conteúdo de console;
- não habilite envio de PII padrão;
- não use captura de inputs ou conteúdo de formulários.

A aplicação também aplica uma camada adicional de sanitização antes do envio:

- remove `event.user`;
- remove body, cookies, headers e query string de requests;
- descarta breadcrumbs de console;
- remove query string e hash de URLs presentes nos eventos;
- mantém no máximo uma pequena fila em memória caso um erro aconteça antes do loader terminar de carregar.

## Segurança

`VITE_SENTRY_LOADER_URL` contém somente um identificador público de cliente. Não coloque `SENTRY_AUTH_TOKEN`, token pessoal, segredo de organização ou qualquer credencial privada em variáveis que comecem por `VITE_`.

## Source maps

Esta primeira integração monitora erros de navegador sem publicar source maps privados. Source maps podem ser adicionados posteriormente usando o plugin oficial do Sentry e `SENTRY_AUTH_TOKEN` somente no ambiente seguro de build/CI. O token nunca deve ir para o bundle do navegador.
