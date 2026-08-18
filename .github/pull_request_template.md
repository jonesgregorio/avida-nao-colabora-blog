## Objetivo

Descreva a mudança e por que ela é necessária.

## Contratos preservados

- [ ] Não alterei Stripe/pagamentos fora do escopo solicitado.
- [ ] Gratuito / Essencial / Plus continuam respeitando a matriz oficial.
- [ ] `emotional_tags` continuam diferentes de `trigger_tags`.
- [ ] Não reintroduzi Trilhas, Caixa de Cuidado, Terapêutico ou Terapêutico Plus como nomes ativos.
- [ ] Li a `main` atual antes de alterar arquivos compartilhados por Claude/Codex/ChatGPT.

## Validação

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] Edge Functions/Deno check
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Migrations novas revisadas

## Risco / rollback

Explique os principais riscos e como desfazer a mudança se necessário.
