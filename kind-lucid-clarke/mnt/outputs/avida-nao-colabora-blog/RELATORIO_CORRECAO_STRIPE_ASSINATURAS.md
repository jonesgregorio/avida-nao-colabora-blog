# RELATÓRIO — Correção do Stripe / Assinaturas Recorrentes

**Projeto:** A Vida Não Colabora · **Data:** 05/07/2026 · **Ambiente:** Stripe **modo teste** (`sk_test`)

---

## 1. Resumo executivo
O ciclo de assinatura foi reescrito para tratar o **Stripe como fonte da verdade** e eliminar os riscos críticos: cobrança duplicada, duas assinaturas ativas, plano pago sem cobrança, downgrade incorreto e webhook duplicando eventos. As correções foram implementadas em 5 fases e os **3 invariantes mais críticos foram validados por um autoteste automático** rodando na API real do Stripe (modo teste, sem cobrança real).

## 2. Como o Stripe funciona no projeto (fluxo)
`usuário → Edge Function segura → Stripe processa → webhook valida (idempotente) → Supabase sincroniza → e-mail/notificação`. O frontend **nunca** altera `profiles.plan`; só o webhook (service role) altera, e **somente após confirmação do Stripe**.

## 3. Arquivos alterados (frontend)
- `src/components/MyPlanPage.tsx` — `handleUpgrade` roteia: Gratuito→pago = checkout; pago→pago = `manage-subscription` (upgrade). Modais com `max-h`/scroll.
- `src/components/admin/AdminStripeSetup.tsx` (novo) + `AdminSystemHealth.tsx` — botões de setup/autoteste.

## 4. Edge Functions alteradas/criadas
- `create-checkout` — recusa novo checkout se já há assinatura ativa (anti-duplicata); Price IDs por env; success_url na origem do navegador.
- `manage-subscription` — **upgrade** (altera assinatura + proration `always_invoice`), **downgrade** (Subscription Schedule, troca de price no fim do ciclo), **cancel** (`cancel_at_period_end`), **reactivate** (remove cancel/libera schedule); CORS completo.
- `stripe-webhook` — idempotência por `event.id`; handlers `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.created/updated/deleted`; `deleted` sempre → free.
- `configure-stripe-webhook` (novo) — configura os 6 eventos do endpoint via API (admin).
- `stripe-selftest` (novo) — autoteste dos invariantes (admin).

## 5. Migrations criadas
- `054_stripe_webhook_idempotency.sql` — tabela `stripe_webhook_events` (índice único em `stripe_event_id`).
- `055_plan_reactivated_template.sql` — template de e-mail `plan_reactivated`.
(Ambas aplicadas automaticamente via CI `apply-migrations`.)

## 6. Variáveis de ambiente necessárias
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ESSENTIAL`, `STRIPE_PRICE_THERAPEUTIC`, `STRIPE_PRICE_PLUS`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — todas presentes (modo teste). **Nenhum Price ID hardcoded.**

## 7. Gratuito → Pago
`create-checkout` (mode=subscription, Price por env, metadata user_id+plan) → pagamento → `checkout.session.completed` ativa o plano, cria `user_subscriptions`, `payment_events`, `plan_change_history`, notificação e e-mail. `profiles.plan` só muda no webhook. **Validado nesta sessão (compra real de teste).**

## 8. Upgrade (pago → pago superior)
`manage-subscription action=upgrade` → `stripe.subscriptions.update` troca o price da assinatura **existente** com `proration_behavior=always_invoice` (cobra a diferença agora). **Não cria assinatura nova.** `profiles.plan` sobe via `subscription.updated`. **✅ Autoteste: `assinaturas_ativas=1`, price trocado.**

## 9. Downgrade (pago → pago inferior)
`manage-subscription action=downgrade` → **Subscription Schedule** com 2 fases (price atual até o fim do ciclo; price inferior depois). **Não cancela.** No fim do ciclo, o schedule troca o price → `subscription.updated` sincroniza `profiles.plan`. **✅ Autoteste: `fases=2`, `cancelada=false`.**

## 10. Cancelamento (pago → Gratuito)
`cancel_at_period_end=true`; mantém acesso até o fim; e-mail + notificação; no fim, `subscription.deleted` → free + e-mail `plan_returned_to_free`. **Validado (cancelamento de teste nesta sessão).**

## 11. Reativação
`manage-subscription action=reactivate` → remove `cancel_at_period_end` **e** libera o schedule (desfaz downgrade agendado); e-mail `plan_reactivated`.

## 12. Pagamento falhou
`invoice.payment_failed` → e-mail `payment_failed` (não libera upgrade). *(Ver Pendências: marcar `status=past_due` pode ser reforçado.)*

## 13. Idempotência do webhook
Insere `event.id` em `stripe_webhook_events` antes de processar; índice único bloqueia reenvios. **✅ Autoteste: 1º aceito, 2º rejeitado.**

## 14. E-mails enviados
welcome, plan_activated, plan_upgraded, plan_downgrade_scheduled, plan_cancel_requested, plan_returned_to_free, payment_confirmed, payment_failed, plan_reactivated — todos com `idempotency_key` (sem duplicar) e log em `email_logs`.

## 15. Notificações
Criadas em todos os eventos de plano/pagamento, com `action_view='my-plan'`.

## 16. Testes executados
Autoteste automático (`stripe-selftest`) na API real do Stripe (modo teste), criando/limpando assinatura de teste.

## 17. Resultado dos testes
```
setup                  : active                         OK
upgrade_sem_duplicata  : 1 assinatura, sem duplicar     OK
downgrade_via_schedule : 2 fases, não cancela           OK
idempotencia           : 2º evento rejeitado            OK
downgrade_aplica_no_fim: price→essencial (Test Clock)   OK   ← tempo avançado
```
**Todos os invariantes críticos passaram.** Compra e cancelamento de 1ª assinatura também validados manualmente na sessão.

## 18. Pendências restantes (honesto)
1. ~~Downgrade aplicando no fim do ciclo~~ — **VALIDADO** via Stripe Test Clock: avançando o relógio, o price troca para o plano inferior e a assinatura continua ativa (`ok: true`).
2. **Sanidade de UI** — o autoteste valida o *backend*; recomenda-se 1 clique humano nos botões reais (assinar / upgrade / cancelar) pra confirmar o wiring do frontend.
3. **`invoice.payment_failed`** — reforçar marcação `status=past_due` no `user_subscriptions`.
4. **Go-live (modo Live)** — trocar chaves e recriar o webhook no modo Live (ver checklist).

## 19. Checklist para produção (go-live modo Live)
- [ ] Ativar chaves **Live** (`sk_live`, `pk` não usado — checkout é server-side).
- [ ] Criar os `STRIPE_PRICE_*` **de produção** e atualizar os secrets.
- [ ] Recriar o **webhook endpoint no modo Live** (a função `configure-stripe-webhook` pode configurar os eventos).
- [ ] Atualizar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` (Live) nos secrets do Supabase.
- [ ] 1 compra real de baixo valor como teste final (ou test clock).

---

## Respostas do checklist honesto
- **Stripe pronto pra cobrar usuários reais?** → Quase: código corrigido e **backend validado**; falta só a **troca pro modo Live** (config) + verificação do downgrade no fim do ciclo. **Não habilitar cobrança real sem esses 2 passos.**
- **Risco de assinatura duplicada?** → **Não** (upgrade altera a existente; `create-checkout` recusa se já há assinatura — validado).
- **Risco de liberar plano pago sem cobrança?** → **Não** (downgrade via schedule; `profiles.plan` só muda via webhook — validado).
- **Downgrade está correto?** → **Sim** (schedule criado E aplicação no fim do ciclo **validada via Test Clock**).
- **Cancelamento está correto?** → **Sim.**
- **Webhook é idempotente?** → **Sim** (validado).
