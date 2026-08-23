# Pendências externas e validações que dependem de ambiente

Este arquivo evita que Claude, Codex ou ChatGPT tratem como “concluído” algo que depende de configuração fora do código.

## 1. Proteção real da branch `main`

O repositório já contém:

- CI com testes, TypeScript, Deno, lint e build;
- `CODEOWNERS`;
- template de Pull Request;
- `CONTRIBUTING.md` exigindo branch → PR → CI.

A proteção real da `main` é uma configuração do GitHub e deve exigir o check de CI antes do merge, bloquear force push e preferir PRs. Arquivos versionados não conseguem substituir essa configuração do repositório.

## 2. Auditoria npm

O CI executa `npm audit --omit=dev --audit-level=high` e o Dependabot foi configurado para abrir PRs controlados. Durante a publicação do ZIP 68, o lockfile foi atualizado sem `--force` e a auditoria de dependências de produção retornou **0 vulnerabilidades**.

Nunca usar `npm audit fix --force` sem revisar as mudanças e passar o CI completo.

## 3. Validação integral das migrations em banco shadow/local

O histórico antigo contém vários prefixos numéricos duplicados (por exemplo, versões 060/061/062/067 em mais de um arquivo). O deploy de produção atual aplica migrations alteradas pelo workflow oficial, mas essa estrutura histórica impede assumir que um `supabase db reset` limpo reproduzirá o projeto sem uma normalização dedicada do histórico.

Não renomear migrations antigas já aplicadas em produção de forma automática. A normalização deve ser tratada como manutenção específica, comparando o histórico real do banco antes de qualquer mudança.

## 4. Regra de continuidade

Antes de qualquer nova rodada:

1. partir da `main` mais recente;
2. criar branch;
3. alterar código e testes no mesmo conjunto;
4. abrir PR;
5. exigir CI verde;
6. só então fazer merge/publicação.

## 5. E2E autenticada por plano (Tarefa 12)

### Situação confirmada em 2026-08-23

- O único projeto Vercel conectado é o de produção; os previews usam o mesmo
  repositório, mas não constituem um ambiente de dados separado.
- O repositório versiona um único `project_id` do Supabase.
- A suíte Browser E2E atual é deliberadamente segura: ela executa o Vite local
  e intercepta chamadas para `https://e2e.supabase.co`. Portanto ela não cria
  contas, não consulta dados de pessoas usuárias e não pode testar login real.

Por isso, **não é permitido** ampliar a E2E autenticada contra produção ou
contra um preview apontado para o Supabase de produção.

### Pré-requisitos para liberar a E2E autenticada

1. Criar um projeto Supabase exclusivo de staging, com Auth, banco, Storage e
   Edge Functions independentes da produção.
2. Criar uma implantação/ambiente Vercel de staging que use somente as variáveis
   públicas desse projeto Supabase de staging.
3. Configurar Stripe exclusivamente em modo de teste nesse ambiente. Nenhum
   teste pode usar Price, cliente, webhook ou chave live.
4. Criar três contas descartáveis no staging: `e2e-free`, `e2e-essential` e
   `e2e-plus`. E-mail e senha ficam apenas em secrets do GitHub; nunca no
   repositório, no bundle ou no relatório de CI.
5. Criar um mecanismo server-side e restrito ao staging para restaurar os dados
   dessas contas antes de cada execução. O navegador não recebe `service_role`.

### Cobertura a ativar depois da infraestrutura

Com os pré-requisitos acima, a suíte deve testar gradualmente: login, Diário e
limite Gratuito, paywall, Questionários, Suporte, Notificações, Relatórios,
Orientação e Plano de Autocuidado. Fluxos de cobrança devem permanecer em modo
de teste e não podem criar cobrança real.
