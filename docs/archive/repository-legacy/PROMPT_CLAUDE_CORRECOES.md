# 🔧 PROMPT PARA CLAUDE — CORREÇÕES DO PROJETO

Copie e cole este prompt completo no Claude para realizar as correções necessárias.

---

## INSTRUÇÕES INICIAIS

Você é um especialista em desenvolvimento full-stack (React/TypeScript/Supabase/PostgreSQL). 

**Contexto:** Estou auditando o projeto "A Vida Não Colabora" (blog de saúde mental com React + Supabase). Uma análise completa identificou **3 problemas críticos, 5 problemas altos e vários médios**.

**Seu objetivo:** Gerar código corrigido, migrations SQL, e instruções passo-a-passo para cada correção.

**Formato esperado:**
```
## [NÚMERO] - [NOME DA CORREÇÃO]

### Descrição do Problema
[Explicação]

### Arquivos Afetados
- `arquivo1.ts`
- `arquivo2.tsx`

### Código Antes (Errado)
\`\`\`typescript
[código com problema]
\`\`\`

### Código Depois (Correto)
\`\`\`typescript
[código corrigido]
\`\`\`

### Passos para Implementar
1. [Passo 1]
2. [Passo 2]
...

### Testes Recomendados
- [Teste 1]
- [Teste 2]
```

---

## 🔴 CRÍTICOS — FAZER PRIMEIRO (SEMANA 1)

### C1 - REMOVER PRICE IDS STRIPE HARDCODED

**Problema:**
- Arquivo: `supabase/functions/create-checkout/index.ts` (linhas 9-11)
- Arquivo: `supabase/functions/stripe-webhook/index.ts` (linhas 10-12)
- Price IDs de produção real estão hardcoded no código como fallback
- Se env vars não forem configuradas, IDs ficam expostos no repositório público
- Risco: Cobrança não autorizada, vazamento de dados financeiros

**Tarefa:**
1. Refatore ambas as Edge Functions para EXIGIR variáveis de ambiente (sem fallback)
2. Crie um arquivo `.env.example` documentando todas as variáveis necessárias
3. Adicione validação no startup que falha se alguma var estiver faltando
4. Gere código de exemplo para configurar as vars no Supabase

**Entrega esperada:**
- Código das 2 Edge Functions corrigido
- `.env.example` atualizado
- Script de validação
- Instruções de setup no Supabase

---

### C2 - ADICIONAR LIMITE DE DIÁRIO NO BANCO DE DADOS

**Problema:**
- Arquivo: `src/components/DiaryPage.tsx` (linha 103)
- Limite de 5 entradas/mês para plano gratuito existe **apenas no cliente**
- Usuário pode contornar via API direta (POST ao Supabase REST)
- Sem validação no banco, qualquer um consegue inserir quantas entradas quiser

**Tarefa:**
1. Crie uma migration SQL (tipo 034_add_diary_limit_check.sql) que:
   - Crie função PL/pgSQL `check_diary_limit()` que valida limite
   - Crie trigger `diary_limit_check` que roda antes de INSERT
   - O trigger deve verificar: se plano = 'free' E count(entradas do mês) >= 5, lance erro
   - A mensagem de erro deve ser amigável: "Limite de 5 entradas/mês para o plano Gratuito"

2. Atualize RLS em `diary_entries` se necessário

3. Remova ou mantenha a verificação no cliente (para UX), mas deixe claro que é só visual

**Entrega esperada:**
- Migration SQL completa e testável
- Documentação da função e trigger
- Código TypeScript para tratar erro quando limite é atingido
- Testes SQL demonstrando o comportamento

---

### C3 - RESTRINGIR INSERT EM QUESTIONNAIRE_RESPONSES

**Problema:**
- Arquivo: `supabase/migrations/001_initial_schema.sql` (linha ~97-98)
- RLS permite INSERT público (qualquer um, autenticado ou não)
- `WITH CHECK (true)` = qualquer pessoa consegue inserir respostas
- Risco: Spam massivo, dados fake, manipulação de analytics

**Tarefa:**
1. Crie migration SQL (tipo 035_restrict_questionnaire_responses.sql) que:
   - Alter a política de INSERT em `questionnaire_responses`
   - Exija autenticação: `WITH CHECK (auth.role() = 'authenticated')`
   - Se possível, adicione validation para que cada usuário responda 1x por questionário

2. Considere se deveria haver RLS adicional ou apenas autenticação

**Entrega esperada:**
- Migration SQL com política corrigida
- Documentação sobre o novo comportamento
- Exemplo de como testar a restrição

---

## 🟠 ALTOS — CORRIGIR LOGO (SEMANA 2)

### A1 - ADICIONAR CAMPO `action_view` EM NOTIFICAÇÕES

**Problema:**
- Arquivo: `src/components/admin/AdminNotifications.tsx`
- Formulário não tem campo `action_view`
- Admin não consegue definir para onde usuário vai ao clicar no botão de ação
- Resultado: Notificação aparece, botão existe, mas é inoperante

**Tarefa:**
1. Atualize schema de `notifications` (migration 036) para adicionar coluna `action_view` se não existir
   - Tipo: `VARCHAR(255) NULL`
   - Exemplos: `/diary`, `/my-evolution`, `/questionnaires`, `https://example.com`

2. Atualize formulário no AdminNotifications para incluir:
   - Campo select/input para `action_view`
   - Options predefinidas + custom input
   - Validação (não pode estar vazio se `type` = 'action')

3. Atualize frontend (NotificationsPage.tsx) para usar `action_view` ao clicar no botão:
   ```typescript
   const handleAction = (actionView: string) => {
     if (actionView.startsWith('http')) {
       window.open(actionView);
     } else {
       navigate(actionView);
     }
   }
   ```

**Entrega esperada:**
- Migration SQL
- Componente AdminNotifications atualizado
- NotificationsPage.tsx atualizado
- Testes de navegação

---

### A2 - MIGRAR IA PARA OPENAI COM CONTRATO DE PRIVACIDADE

**CRÍTICO — LGPD/GDPR**

**Problema:**
- Arquivos: `src/lib/aiContent.ts`, `AdminPersonalization.tsx`, `AdminAutomated.tsx`, `AdminUsers.tsx`
- Usa Pollinations.ai (serviço público SEM termos de privacidade)
- Envia dados de saúde mental: entradas de diário, emoções, diagnósticos
- Violação de LGPD (Brasil) e GDPR (Europa)
- Sem contrato de processamento de dados

**Tarefa:**
1. Crie Edge Function `supabase/functions/generate-content-ai/index.ts` que:
   - Integre com OpenAI (ou Anthropic/Google Gemini)
   - Use API key do Deno env vars (não expor no cliente)
   - Implemente rate limiting e logging
   - Cacheie resultados quando possível

2. Refatore `src/lib/aiContent.ts` para chamar a Edge Function em vez de Pollinations.ai:
   ```typescript
   async function callAI(prompt: string) {
     const response = await supabase.functions.invoke('generate-content-ai', {
       body: { prompt }
     });
     return response.data.content;
   }
   ```

3. Atualize todos os componentes admin para usar a mesma função (remover Pollinations direto)

4. Implemente consentimento explícito do usuário (modal perguntando se autoriza IA)

5. Adicione documentação sobre privacidade de dados

**Entrega esperada:**
- Edge Function `generate-content-ai/index.ts` completa
- `aiContent.ts` refatorado
- Todos os componentes atualizados
- Modal de consentimento IA
- Documentação de privacidade
- `.env.example` com `OPENAI_API_KEY`

---

### A3 - CORRIGIR `useEffect` COM DEPENDÊNCIAS FALTANDO

**Problema:**
- Arquivo: `src/components/admin/AdminUsers.tsx` (linha 285)
- useEffect não tem `selectedUserId` no array de dependências
- Resultado: Admin navega entre usuários mas dados não atualizam

**Tarefa:**
1. Localize o useEffect que carrega dados do usuário selecionado
2. Adicione `selectedUserId` ao array de dependências
3. Considere se há outras dependências faltando (filters, etc)
4. Trate o caso onde `selectedUserId === null` gracefully

**Entrega esperada:**
- Código corrigido em AdminUsers.tsx
- Antes/depois mostrando a mudança
- Teste demonstrando que funciona ao trocar de usuário

---

### A4 - IMPLEMENTAR CODE SPLITTING PARA REDUZIR BUNDLE

**Problema:**
- Bundle: 1.15 MB (278 KB gzip)
- Recomendado: 500 KB (200 KB gzip)
- Causa: Admin + usuário no mesmo chunk
- Impacto: Carregamento lento, especialmente mobile

**Tarefa:**
1. Implemente `React.lazy()` para área admin:
   ```typescript
   const AdminLayout = React.lazy(() => import('./AdminLayout'));
   ```

2. Crie componente wrapper `Suspense` para mostrar loading

3. Configure Vite para otimizar chunks (adicione em `vite.config.ts`):
   ```typescript
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'admin': ['./src/components/admin/...']
         }
       }
     }
   }
   ```

4. Execute `npm run build` e valide novo tamanho de bundle

**Entrega esperada:**
- Código com React.lazy() implementado
- Configuração Vite atualizada
- Suspense boundary
- Screenshot do tamanho de bundle após otimização

---

### A5 - UNIFICAR PROVIDERS DE IA (REMOVER DUPLICAÇÃO)

**Problema:**
- 2 providers paralelos: Pollinations.ai (cliente) vs Google Gemini (Edge Function)
- AdminPersonalization, AdminAutomated, AdminNotifications, AdminUsers usam Pollinations
- Edge Function `generate-content` existe mas não é usada
- Inconsistência de qualidade e privacidade

**Tarefa:**
1. Após A2 (migrar para OpenAI), remova todas as referências a Pollinations.ai:
   - Delete código direto do cliente que chama Pollinations.ai
   - Atualize Edge Function anterior para usar novo provider

2. Consolide Edge Functions:
   - Se tiver `generate-content/index.ts`, delete ou refatore
   - Use apenas `generate-content-ai/index.ts` criada em A2

3. Atualize todos os componentes para chamar Edge Function centralizada

4. Remova imports/dependências de Pollinations.ai

**Entrega esperada:**
- Todos os componentes refatorados
- Código morto removido
- Teste mostrando que geração de IA funciona uniformemente
- Documentação da arquitetura de IA centralizada

---

## 🟡 MÉDIOS — CORRIGIR QUANDO POSSÍVEL (SEMANA 3)

### M1 - CENTRALIZAR UTILITY `monthKey()`

**Problema:**
- Definida em: `src/lib/personalizationTasks.ts` E `src/components/MyEvolutionPage.tsx`
- Mesma implementação em 2 lugares
- Risco de divergência futura

**Tarefa:**
1. Crie arquivo `src/lib/dateUtils.ts` com:
   ```typescript
   export function monthKey(date: Date): string {
     return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
   }
   ```

2. Importe e use em ambos os arquivos

3. Delete duplicatas

**Entrega esperada:**
- Novo arquivo `dateUtils.ts`
- Ambos os arquivos importando a função
- Teste confirmando que funciona igual

---

### M2 - CENTRALIZAR CONSTANTES DE PLANOS

**Problema:**
- `PLAN_LABELS`, `PLAN_COLORS` redefinidas em:
  - `AdminPersonalization.tsx`
  - `AdminAutomated.tsx`
  - `AdminUsers.tsx`
- Difícil de manter, risco de inconsistência

**Tarefa:**
1. Crie arquivo `src/lib/planConstants.ts`:
   ```typescript
   export const PLAN_LABELS = {
     'free': 'Gratuito',
     'essential': 'Essencial',
     'therapeutic': 'Terapêutico',
     'therapeutic-plus': 'Terapêutico Plus'
   };

   export const PLAN_COLORS = {
     'free': '#94a3b8',
     'essential': '#3b82f6',
     'therapeutic': '#8b5cf6',
     'therapeutic-plus': '#ec4899'
   };
   ```

2. Importe em todos os 3 componentes

3. Delete duplicatas

**Entrega esperada:**
- `planConstants.ts` centralizado
- 3 componentes importando
- Teste visual confirmando cores/labels

---

### M3 - REFATORAR LÓGICA DE PLANO EM DiaryPage

**Problema:**
- `DiaryPage.tsx` calcula acesso a features localmente:
  ```typescript
  const isEssential = plan !== 'free';
  const isTherapeutic = ['therapeutic', 'therapeutic-plus'].includes(plan);
  ```
- Deveria usar `canAccessFeature()` de `permissions.ts`
- Inconsistência com sistema centralizado de permissões

**Tarefa:**
1. Refatore DiaryPage para usar `canAccessFeature()`:
   ```typescript
   const hasScores = canAccessFeature(plan, 'diary-emotional-scores');
   const hasAdvancedFields = canAccessFeature(plan, 'diary-advanced-fields');
   ```

2. Se features não existem em `officialPlans.ts`, adicione

3. Delete cálculos locais

**Entrega esperada:**
- `DiaryPage.tsx` refatorado
- Features adicionadas em `officialPlans.ts` se necessário
- Teste confirmando mesmo comportamento

---

### M4 - OTIMIZAR `loadData()` EM FILA DE PENDÊNCIAS

**Problema:**
- `AdminPersonalization.tsx` carrega sempre 500 profiles + 1000 deliveries
- Sem filtros: `limit(500)` sem WHERE
- Fica lento com crescimento
- Sem paginação

**Tarefa:**
1. Implemente paginação:
   ```typescript
   const loadPage = async (page: number = 1) => {
     const pageSize = 50;
     const offset = (page - 1) * pageSize;
     
     const { data } = await supabase
       .from('profiles')
       .select('*')
       .eq('plan', '!=', 'free') // Filtro: só quem pode ter tarefas
       .range(offset, offset + pageSize - 1);
   }
   ```

2. Adicione controles de paginação na UI

3. Implemente cache em-memória para evitar recarregar página já vista

**Entrega esperada:**
- Componente com paginação implementada
- Botões Anterior/Próximo ou número de páginas
- Teste de performance (tempo de carregamento antes/depois)

---

### M5 - DIFERENCIAR "VER SITE" E "SAIR DO ADMIN"

**Problema:**
- `AdminLayout.tsx` (linhas 70-82)
- Ambos os botões fazem `window.location.href = pathname`
- Confuso para admin

**Tarefa:**
1. "Sair do Admin" → Redireciona para `/` (homepage)
2. "Ver Site" → Abre nova aba com `/` OU mantém comportamento atual (clarificar)

**Entrega esperada:**
- Código com 2 handlers diferentes
- Comportamento clarificado no comentário
- Teste de navegação

---

## 🔵 BAIXOS — LIMPEZA (SEMANA 4)

### B1 - RESOLVER AVISOS DE LINT

**Problema:**
- 197 avisos de lint
- Principais: `any`, `exhaustive-deps`, etc

**Tarefa:**
1. Execute `npm run lint` e capture output
2. Para cada tipo de aviso:
   - Corrija se for legítimo
   - Adicione `// eslint-disable-next-line` com motivo se for exceção
3. Meta: Reduzir para <50 avisos

**Entrega esperada:**
- Lista de avisos corrigidos
- Justificativa para cada exceção

---

### B2 - REMOVER DUPLICATAS DE `DISCLAIMER`

**Problema:**
- Definido em: `aiContent.ts` E `AdminPersonalization.tsx`
- Mesma string de disclaimer de IA

**Tarefa:**
1. Mova para `src/lib/constants.ts` ou use context
2. Importe em ambos os lugares
3. Delete duplicata

---

### B3 - CENTRALIZAR CLASSE CSS `inputCls`

**Problema:**
- `inputCls` redefinida em múltiplos componentes admin

**Tarefa:**
1. Crie `src/lib/styleConstants.ts`:
   ```typescript
   export const inputCls = "w-full px-3 py-2 border border-gray-300 rounded...";
   ```
2. Importe em todos os componentes

---

---

## 📋 COMO USAR ESTE PROMPT

### Opção 1: Corrigir Tudo
Cole este prompt inteiro no Claude e peça:
> "Por favor, implemente todas as 13 correções. Comece pelos críticos (C1, C2, C3)."

### Opção 2: Corrigir por Prioridade
Cole a seção relevante:
```
Implemente as 3 correções críticas:
[Cole C1, C2, C3]
```

### Opção 3: Corrigir Uma por Uma
Cole uma seção por vez:
```
Implemente esta correção:
[Cole uma correção específica]
```

---

## ✅ CHECKLIST PÓS-IMPLEMENTAÇÃO

Para cada correção implementada:

- [ ] Código gerado está correto
- [ ] Antes/Depois está claro
- [ ] Passos estão detalhados
- [ ] Testes estão documentados
- [ ] Nenhuma dependência foi quebrada
- [ ] TypeScript valida (sem erros)
- [ ] Build passa (`npm run build`)
- [ ] Lint melhora (197 → <150 avisos)

---

## 🎯 FORMATO DE RESPOSTA ESPERADO

Para cada correção, o Claude deve retornar:

```markdown
## [NÚMERO] - [NOME]

### Resumo
[1 parágrafo]

### Código Antes
\`\`\`[linguagem]
[código com problema]
\`\`\`

### Código Depois
\`\`\`[linguagem]
[código corrigido]
\`\`\`

### Migration SQL (se aplicável)
\`\`\`sql
[migration completa]
\`\`\`

### Passos Implementação
1. [Passo 1]
2. [Passo 2]
...

### Como Testar
- [Teste 1]
- [Teste 2]

### Nota de Compatibilidade
[Se quebra algo, listar aqui]
```

---

## 🚀 PRÓXIMAS AÇÕES

1. **Copie este prompt inteiro**
2. **Cole no Claude**
3. **Peça para implementar primeira correção** (C1 — Price IDs)
4. **Revise o código gerado**
5. **Aplique ao repositório**
6. **Teste localmente** (`npm install && npm run dev`)
7. **Commite** (`git commit -m "fix: C1 - Remove hardcoded Stripe Price IDs"`)
8. **Repita para próxima correção**

---

## 📞 DÚVIDAS?

Se o Claude pedir esclarecimentos:
- Ref imagem/arquivo original
- Paste URL do arquivo no GitHub
- Descreva comportamento esperado

---

**Criado em:** 02/07/2026  
**Projeto:** A Vida Não Colabora Blog  
**Status:** Pronto para implementação
