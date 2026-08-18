# Arquitetura atual — A Vida Não Colabora

## Fonte de verdade

1. `main` atual;
2. testes automatizados;
3. `README.md`;
4. este documento.

Documentos em `docs/archive` são históricos.

## Planos e entitlement

- `free` → Gratuito.
- `essential` → Essencial.
- `plus` → Plus.
- aliases antigos (`therapeutic*`) são normalizados para Plus apenas por compatibilidade.
- `unlimited_access` ativo cria entitlement efetivo Plus sem alterar o plano comercial/Stripe.

## Fluxo emocional

```text
Check-in / Diário
  ↓
Mapa Emocional (cálculo direto)
  ↓
Relatório semanal (Essencial + Plus)
  ↓
Relatório mensal aprofundado (Plus)
  ↓
Plano de autocuidado (Plus, IA → pending_review → Admin → sent)
  ↓
Orientação mensal (Plus, solicitação → IA draft → revisão humana → final_response_json)
```

Categorias de dados não são intercambiáveis:

- `emotional_tags`: marcadores emocionais;
- `context_tags`: contextos;
- `need_tags`: necessidades;
- `care_action_tags`: ações de cuidado;
- `trigger_tags`: gatilhos reais, Plus.

## IA emocional

- Cálculos/contagens são determinísticos.
- IA produz narrativa, nunca inventa números.
- Failover: Gemini → Groq → OpenAI → fallback determinístico.
- versões/regras compartilhadas: `supabase/functions/_shared/emotionalPromptContracts.ts`.

## Conteúdo editorial

`run-automations` possui quatro execuções distintas:

| Tipo | Saída |
|---|---|
| `generate_daily` | 1 artigo |
| `generate_weekly_package` | 2–4 artigos |
| `generate_pauta` | ideias para 2 semanas |
| `monthly_pauta` | planejamento do próximo mês |

Pautas ficam em `editorial_calendar`; não criam artigos. Artigos automáticos passam por validação editorial antes de publicação.

## Saúde e observabilidade

- `get_emotional_automation_health()`;
- `get_editorial_automation_health()`;
- Admin → Saúde do Sistema.

As RPCs expõem estado operacional, nunca secrets.

## Segurança

- RLS continua sendo a barreira principal de dados de usuário.
- helpers de plano efetivo impedem consulta direta de entitlement de outro usuário autenticado.
- service role e chaves de IA nunca vão para o frontend.
- Stripe permanece server-side.

## CI

Pull Requests devem passar por:

```text
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
deno check (Edge Functions)
npm run lint
npm run build
```

A proteção efetiva da `main` deve exigir esse CI nas configurações do GitHub.
