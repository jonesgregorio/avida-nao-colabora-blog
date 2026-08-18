# Implementação — E-mails transacionais

**Projeto:** A Vida Não Colabora · **Data:** 03/07/2026

---

## 1. Resumo executivo

Sistema de e-mails transacionais com **templates reutilizáveis**, **logs de envio**, **idempotência** (sem duplicar) e **privacidade** (nada sensível no assunto; conteúdo completo fica dentro da conta). Envio central via Edge Function `send-transactional-email`, disparado server-side (webhook Stripe) e client-side (helper tipado). Rodapé de responsabilidade automático em e-mails sensíveis.

**Estado:** fundação completa e validada (build/tsc/lint/audit ✓). Gatilhos de **pagamento/plano** (6 eventos) e **boas-vindas** já conectados. Demais gatilhos têm helper pronto e ponto de integração documentado (seção 11).

## 2. Provider usado

**Resend** (`https://api.resend.com/emails`) — já era o padrão do projeto (`send-automated-emails`). A função aceita `RESEND_API_KEY` **ou** `EMAIL_API_KEY`. Trocar de provider = alterar só a chamada `fetch` na Edge Function.

## 3. Como configurar `contato@avidanaocolabora.com`

Variáveis (Supabase → Edge Functions → Secrets):
```
RESEND_API_KEY   = re_...            (ou EMAIL_API_KEY)
EMAIL_FROM       = contato@avidanaocolabora.com
EMAIL_FROM_NAME  = A Vida Não Colabora
SITE_URL         = https://avidanaocolabora.com.br   (usado nos links dos e-mails do webhook)
```
Remetente final: `A Vida Não Colabora <contato@avidanaocolabora.com>`.

**Autenticação de domínio (obrigatória para não cair em spam)** — no painel do Resend, adicione o domínio `avidanaocolabora.com` e configure no DNS:
- **SPF** (registro TXT que autoriza o Resend a enviar)
- **DKIM** (chaves fornecidas pelo Resend)
- **DMARC** (política, ex.: `v=DMARC1; p=none; rua=mailto:contato@avidanaocolabora.com`)
- **Validar o domínio** no Resend antes do primeiro envio real.

> ⚠️ Hoje o `send-automated-emails` usa `noreply@avidanaocolabora.com.br`. O novo sistema usa `contato@avidanaocolabora.com` (**.com**, conforme especificado). Confirme qual domínio está validado no Resend.

## 4. Tabelas criadas / alteradas (migration 049)

- **`email_templates`** (nova): `template_key` (único), `subject`, `preheader`, `body_text`, `body_html` (vazio = HTML gerado da marca), `category`, `is_active`. RLS: só admin gerencia.
- **`email_logs`** (estendida — já existia na migration 004): +`to_email`, `template_key`, `provider`, `provider_message_id`, `error_message`, `related_entity_type/id`, `idempotency_key`, `metadata`, `updated_at`. FK antigo de `user_id`→profiles removido (aceita id de auth.users). **Índice único** `idempotency_key WHERE not null` (anti-duplicidade). RLS: usuário vê os próprios; admin vê tudo.

## 5. Templates criados (21)

`welcome`, `email_confirmation`, `plan_activated`, `plan_upgraded`, `plan_downgrade_scheduled`, `plan_cancel_requested`, `plan_returned_to_free`, `payment_confirmed`, `payment_failed`, `support_reply`, `guidance_answered`, `session_requested`, `session_scheduled`, `session_rescheduled`, `session_cancelled`, `monthly_report_available`, `professional_comment_available`, `self_care_plan_available`, `personalized_content_available`, `diary_limit_warning`, `diary_limit_reached`.

Assuntos **sempre neutros**; categoria `clinical` recebe o rodapé de responsabilidade automaticamente. Seed com `ON CONFLICT DO NOTHING` (não sobrescreve edições do admin).

## 6. Gatilhos implementados

**Server-side (webhook Stripe — `stripe-webhook`), seguros e idempotentes:**
- `checkout.session.completed` → `payment_confirmed` + (`plan_activated` se vinha do free | `plan_upgraded` caso contrário)
- `invoice.payment_succeeded` → `payment_confirmed` (renovação)
- `invoice.payment_failed` → `payment_failed` (handler novo)
- `customer.subscription.deleted` (→ free) → `plan_returned_to_free`

**Client-side (admin/usuário), com idempotência:**
- Cadastro (`Auth.tsx`) → `welcome` (best-effort, não bloqueia o signup)
- Suporte respondido (`AdminSupport.tsx`) → `support_reply`
- Orientação respondida (`AdminGuidanceRequests.tsx`) → `guidance_answered`
- Sessão agendada/remarcada/cancelada (`AdminEvolutionSessions.tsx`) → `session_scheduled` / `session_rescheduled` / `session_cancelled`
- Comentário profissional (`AdminProfessionalComments.tsx`) → `professional_comment_available`
- Plano de autocuidado (`AdminSelfCarePlans.tsx`) → `self_care_plan_available`
- Conteúdo personalizado enviado (`AdminPersonalization.tsx`) → `personalized_content_available`
- Limite do diário — Gratuito, 4ª entrada/mês → `diary_limit_warning`; 5ª+ → `diary_limit_reached` (`DiaryPage.tsx`)

Todos os envios do webhook são embrulhados: **falha de e-mail nunca quebra o pagamento**. Os client-side usam `void` (fire-and-forget) e nunca bloqueiam a ação.

## 7. Arquivos alterados/criados

| Arquivo | O quê |
|---------|-------|
| `supabase/migrations/049_transactional_emails.sql` | tabelas + 21 templates |
| `supabase/functions/send-transactional-email/index.ts` | função central de envio |
| `supabase/config.toml` | `verify_jwt=false` para a nova função |
| `supabase/functions/stripe-webhook/index.ts` | helpers + 6 e-mails de pagamento/plano |
| `src/lib/emailTriggers.ts` | helper tipado por evento |
| `src/components/Auth.tsx` | gatilho `welcome` no cadastro |
| `src/components/admin/AdminEmails.tsx` | painel de logs/templates/reenvio |
| `src/components/admin/AdminAreaComunicacao.tsx` | aba "E-mails" |

## 8. Migrations criadas

`049_transactional_emails.sql` — idempotente. **Aplicar no SQL Editor** do Supabase.

## 9. Testes realizados

| Teste | Resultado |
|-------|-----------|
| `npm run build` | ✅ |
| `npx tsc --noEmit` | ✅ |
| `npm run lint` (`--max-warnings 0`) | ✅ |
| `npm audit --omit=dev` | ✅ 0 vulnerabilidades |

Testes funcionais (envio real) dependem da ativação (secrets + domínio) — ver seção 11.

## 10. Limitações

- A chave do Resend/`EMAIL_FROM` e a validação de domínio **são configuração sua** (não manipulo secrets).
- `welcome` é best-effort: se a confirmação de e-mail estiver **ativa**, o usuário não tem sessão logo após o signup e o envio via cliente pode não autenticar. Para 100% de garantia, disparar via **DB trigger/Auth Hook** (ver seção 11).
- Segurança da Edge Function: aceita service role (server), admin (JWT) ou self-service (`welcome`/`email_confirmation`/`session_requested` para o próprio e-mail).

## 11. Pendências

Os gatilhos de suporte, orientação, sessão (agendar/remarcar/cancelar), comentário, autocuidado, conteúdo personalizado e limite do diário **já estão conectados** (seção 6). Restam apenas itens opcionais:

| Item | Situação | Observação |
|------|----------|-----------|
| `email_confirmation` | Opcional | O Supabase Auth já envia confirmação nativa. Para usar o template custom, sobrescrever o e-mail de confirmação nas configurações de Auth (ou desligar a confirmação nativa e disparar via este sistema). |
| `session_requested` | Não conectado | Wrapper `emailSessionRequested` pronto; falta identificar o fluxo em que o **usuário** solicita a sessão para plugar. |
| `monthly_report_available` | Opcional | O relatório é gerado pelo próprio usuário (`MyEvolutionPage`), então o e-mail seria redundante. Conectar só se passar a ser gerado por admin/sistema (`emailMonthlyReportForUser` pronto). |
| `welcome` garantido | Melhoria | Hoje é best-effort no cliente. Para 100% (mesmo com confirmação de e-mail ativa), disparar via DB trigger/Auth Hook. |

**Ativação (passos seus):**
1. Aplicar a migration `049` no SQL Editor.
2. Setar `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SITE_URL` nos secrets das Edge Functions.
3. Validar o domínio `avidanaocolabora.com` no Resend (SPF/DKIM/DMARC).
4. Deploy das funções (o GitHub Action já faz isso no push).
5. Testar: um cadastro real deve gerar log `welcome`; uma compra teste deve gerar `payment_confirmed` + `plan_activated`.
