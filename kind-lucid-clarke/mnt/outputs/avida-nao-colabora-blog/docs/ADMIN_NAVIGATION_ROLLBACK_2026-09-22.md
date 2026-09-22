# Rollback — navegação simplificada do Admin

## Baseline preservado
- Estado anterior da main: `253e11fcacc600b1f6f014caefa2678d3bf95f1f`
- PR da reorganização: #511
- Branch: `feat/admin-simplified-navigation-20260920`

## Escopo
A mudança reorganiza somente a experiência e a navegação do Admin. Não inclui migrations, alteração de dados, RLS, planos, Stripe ou mudança funcional do Diário.

## Como voltar
Após o merge, se a nova organização não for aprovada, reverta o merge commit do PR #511. Como não há migration nem transformação de dados neste PR, o rollback é de código e restaura a arquitetura anterior preservada no baseline acima.

## Validação antes do merge
- CI
- TypeScript
- ESLint
- build
- migrations guard
- Browser E2E
- Vercel preview
