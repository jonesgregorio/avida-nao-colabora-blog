# SEO P3 — Medição, otimização e crescimento orientado por dados

Data de início: 20/09/2026

## Objetivo
Transformar a base técnica e editorial construída nas P0–P2 em um ciclo contínuo de medição, aprendizado e otimização. A P3 não busca volume artificial de páginas: busca identificar o que o Google descobre, indexa, exibe e recebe cliques, e então priorizar melhorias com evidência.

## Pré-condição verificada
O merge da P2 (commit 3e38ea30e32ef6a393fc94271c819d84d305ec07) está em produção na Vercel com estado READY.

## Frentes

### 1. Observabilidade de SEO
- acompanhar descoberta, indexação, impressões, cliques, CTR e posição por página e consulta;
- separar páginas novas, páginas com impressão sem clique e páginas sem descoberta;
- registrar anomalias de canonical/indexação;
- não interpretar ausência de dados recentes como falha técnica sem evidência.

### 2. Oportunidades de CTR
Uma página só entra na fila de reescrita de title/description quando houver impressões suficientes para justificar a hipótese. Evitar clickbait e preservar a intenção real.

### 3. Consolidação de conteúdo
- detectar canibalização e conteúdos muito próximos;
- fortalecer a página principal quando duas URLs disputarem a mesma intenção;
- manter redirects/canonicals apenas quando houver equivalência real;
- evitar novas páginas para sinônimos de assuntos já cobertos.

### 4. Qualidade e confiança
- revisão humana dos conteúdos sensíveis priorizados na P2;
- reviewed_at somente após revisão real;
- reforçar fontes e linguagem proporcional à evidência;
- preservar caráter educativo e limites de responsabilidade.

### 5. Autoridade externa
- executar outreach somente após aprovação humana;
- medir menções e backlinks conquistados;
- rejeitar compra/troca massiva de links e PBN;
- priorizar referências editoriais relevantes.

### 6. Cadência
Semanal: Search Console, indexação, anomalias e páginas emergentes.
Quinzenal: oportunidades de CTR e interlinking.
Mensal: clusters, autoridade, páginas estagnadas e backlog editorial.

## Métricas de decisão
- cliques orgânicos;
- impressões orgânicas;
- CTR;
- posição média por consulta/página;
- páginas públicas descobertas/indexadas;
- páginas com impressões e zero clique;
- menções/backlinks editoriais relevantes;
- crescimento por cluster, não apenas total do domínio.

## Guardrails
Não alterar Diário, Check-in, Jardim, planos, Stripe, permissões, RLS ou dados privados como parte da P3. Não publicar conteúdo sensível automaticamente. Não declarar revisão profissional inexistente.

## Dependência atual
O GSC Wizard está bloqueado por assinatura/trial inativo. Enquanto isso, a P3 mantém a arquitetura e o processo prontos, mas análises novas de Search Console por essa integração dependem da reativação. A integração própria do projeto pode ser auditada separadamente sem alterar dados.
