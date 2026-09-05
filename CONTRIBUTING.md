# Contribuição — A Vida Não Colabora

## Fluxo obrigatório

1. Sincronize a `main` antes de começar.
2. Trabalhe em branch própria.
3. Prepare alterações relacionadas localmente e, sempre que possível, envie **um commit consolidado por etapa**. Evite commits intermediários apenas para preparar assets ou pequenos ajustes que disparem previews desnecessários na Vercel.
4. Abra Pull Request para `main` somente quando a etapa estiver pronta para CI/E2E.
5. Corrija qualquer falha do CI antes do merge; se uma correção adicional for necessária, agrupe mudanças relacionadas antes do próximo push sempre que possível.
6. Faça merge apenas quando testes, TypeScript, Deno check, lint e build estiverem aprovados.
7. Após o merge, valide o deployment automático da Vercel e o smoke test nos domínios oficiais antes de considerar a alteração concluída em produção.

## Política de deployments

- Preview de PR é validação, não um passo de edição iterativa: evite gerar vários previews para a mesma etapa quando as mudanças podem ser consolidadas.
- Não faça deploy manual de cada arquivo/ajuste intermediário.
- Prefira um único deployment de produção proveniente da `main` já aprovada.
- Assets críticos da Home devem ter teste de carregamento real (`complete`, `naturalWidth > 0` e resposta HTTP válida), não apenas presença no DOM.
- O workflow **Production Smoke** valida os domínios `avidanaocolabora.com` e `www.avidanaocolabora.com`, uma sessão autenticada, o gate administrativo e assets essenciais após o CI da `main`.

Claude, Codex e ChatGPT devem preservar as implementações dos demais agentes e não usar ZIPs antigos como fonte de verdade quando a `main` for mais recente.

> A proteção efetiva da branch (`Require pull request` + `Require status checks`) é uma configuração do GitHub e deve permanecer habilitada no repositório. Este arquivo documenta o fluxo, mas não substitui a regra de proteção do GitHub.
