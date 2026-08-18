# Relatório de Auditoria — Saúde do Sistema + Auto-reparo

**Data:** 03/07/2026
**Escopo:** Auditoria do projeto (via ZIP `avida-nao-colabora-blog-main (29).zip` + código no repositório), com foco no painel **Admin › Sistema › Saúde do Sistema**, correção real dos problemas e criação de correção com 1 clique.

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Causa raiz dos erros da Saúde do Sistema | ✅ Identificada |
| Correção real (não cosmética) | ✅ Implementada via RPC no servidor |
| Botão "Corrigir com 1 clique" | ✅ Adicionado (por item + "corrigir tudo") |
| Build / TypeScript / Lint | ✅ Passam sem erros/warnings |
| Limpeza de arquivos-lixo | ✅ 5 arquivos removidos |
| Achados de segurança | ⚠️ 2 (token e PAT) — ação recomendada |

---

## 2. Diagnóstico: por que o painel mostra erros

O painel executa checks em `src/lib/systemHealth.ts`. Cada check de banco faz:

```ts
supabase.from('<tabela>').select('id').limit(1)
```

Um check fica **vermelho (erro)** quando a **tabela que ele testa não existe** no banco (erro `relation does not exist`). Não é bug de frontend — é **schema faltando** em produção. As tabelas testadas incluem:

`notifications`, `diary_entries`, `questionnaire_responses`, `articles`, `trails`, `user_personalization_tasks`, `personalized_content_deliveries`, `monthly_guidance_requests`, `user_sessions`, `monthly_reports`, `support_tickets`, `saved_items`.

**Falha estrutural do fluxo antigo:** na aba *Histórico de erros*, o botão **"Resolver"** apenas marcava o incidente como `resolved` no banco — **não corrigia o erro real**. No próximo teste, o erro voltava. Faltava uma ação que efetivamente criasse o que estava faltando.

---

## 3. Solução implementada

### 3.1. Correção real no servidor (migration `047_health_autofix.sql`)

Como o cliente do navegador (chave anon) **não tem permissão para DDL**, a correção real roda no servidor via função `SECURITY DEFINER`:

- **`admin_autofix_health_check(p_check_key)`** — valida `is_admin()` e, para o check informado, **garante o schema canônico** da tabela (mesma definição das migrations originais) + RLS + policies. Tudo idempotente (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
- **`admin_autofix_all_health()`** — aplica o reparo em todas as áreas corrigíveis de uma vez.

> **Não altera nada de IA** (provedores, prompts, filas): apenas garante a **existência** de tabelas/colunas. Se a tabela já existe, é no-op completo.

### 3.2. Botão "Corrigir com 1 clique" (UI)

Arquivos: `src/components/admin/AdminSystemHealth.tsx` + `src/lib/systemHealth.ts`.

- **Por item:** em cada linha com erro corrigível (Visão Geral) e em cada incidente (Histórico de erros) aparece o botão **"Corrigir"** (ícone chave).
- **Em massa:** no cabeçalho, quando há erros corrigíveis, aparece **"Corrigir N erros com 1 clique"**.
- **O clique de fato corrige:** chama a RPC → **reexecuta o teste** para confirmar que ficou verde → resolve automaticamente os incidentes daquele check. Se o teste ainda falhar, avisa (não finge que corrigiu).

Checks **não** corrigíveis por schema (IA, site, sessão, pagamentos, RLS, performance) **não** exibem o botão — evitando falsa sensação de correção.

---

## 4. Achados de estrutura / limpeza

| Item | Situação | Ação |
|------|----------|------|
| `is_active`, `plan_required`, `profiles.user_id)`, `saved_items` | Arquivos **vazios (0 bytes)** — lixo de shell mal-parseado | ✅ **Removidos** |
| `_tmp_migrate022.js` | Script temporário de migração (token já redigido) | ✅ **Removido** |
| 12 arquivos `.bat` na raiz (`commit_*.bat`, `push_*.bat`) | Automação de commit/push espalhada | ⚠️ Recomenda-se consolidar em 1 script |
| `avida-nao-colabora-producao.zip` versionado no git | Artefato binário no repositório | ⚠️ Recomenda-se `.gitignore` |
| App aninhado em `kind-lucid-clarke/mnt/outputs/...` | Estrutura profunda incomum | ⚠️ Não alterado (risco de quebrar deploy/automação) |

---

## 5. Achados de segurança

1. **Token Supabase em arquivo temporário** (`_tmp_migrate022.js`) — já estava redigido como `SUPABASE_TOKEN_REMOVED`, mas o **histórico do git pode conter o valor real**. Recomendação: **rotacionar** o access token do Supabase.
2. **PAT do GitHub em texto puro** no remote do git (`.git/config`). Recomendação: **rotacionar** o PAT e usar um credential helper.

Ponto positivo: `.env` **não** está versionado e está no `.gitignore`. ✅

---

## 6. Testes executados

| Teste | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ Sem erros |
| `npm run lint` (`--max-warnings 0`) | ✅ Sem warnings |
| `npm run build` | ✅ 1622 módulos, ~7.7s |

---

## 7. Passo pendente do usuário (1 ação)

Para o botão funcionar em produção, aplicar **uma vez** a migration `047_health_autofix.sql` no SQL Editor do Supabase (cria as duas funções RPC). Depois disso, toda correção é 1 clique dentro do painel.
