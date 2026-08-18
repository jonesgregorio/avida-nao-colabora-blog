# Contribuição — A Vida Não Colabora

## Fluxo obrigatório

1. Sincronize a `main` antes de começar.
2. Trabalhe em branch própria.
3. Abra Pull Request para `main`.
4. Corrija qualquer falha do CI antes do merge.
5. Faça merge apenas quando testes, TypeScript, Deno check, lint e build estiverem aprovados.

Claude, Codex e ChatGPT devem preservar as implementações dos demais agentes e não usar ZIPs antigos como fonte de verdade quando a `main` for mais recente.

> A proteção efetiva da branch (`Require pull request` + `Require status checks`) é uma configuração do GitHub e deve permanecer habilitada no repositório. Este arquivo documenta o fluxo, mas não substitui a regra de proteção do GitHub.
