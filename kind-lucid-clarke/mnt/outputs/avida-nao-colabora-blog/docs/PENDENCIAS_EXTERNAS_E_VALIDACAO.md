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
