# SEO P4 — Qualidade editorial e confiança — 20/09/2026

## Objetivo
Resolver o backlog editorial deixado pela P2 sem criar revisão profissional fictícia, sem massificar conteúdo e sem alterar áreas privadas do produto.

## Entregas
- restaura a semântica histórica de `published_at`: artigos com status published e data ausente recebem `created_at`, conforme migrations antigas do próprio projeto;
- reescreve o artigo de crise de ansiedade para remover promessas de efeito imediato e apresentar respiração lenta como estratégia possível, não garantia;
- mantém orientação de avaliação profissional e de urgência diante de sintomas físicos intensos/novos ou risco de segurança;
- reescreve o artigo de telas e sono para distinguir tempo deslocado, conteúdo, notificações e luz, preservando as incertezas da evidência;
- reescreve o artigo sobre descanso/adiamento, removendo português quebrado, moralização e afirmações excessivas;
- preserva `reviewed_at = null`: nenhuma revisão profissional é declarada sem ter ocorrido;
- mantém slugs existentes para evitar quebra de URLs e perda de sinais acumulados.

## Evidência editorial
- WHO — Anxiety disorders, atualização de 15/09/2026;
- WHO mhGAP — stress management techniques: relaxamento/mindfulness como recomendação condicional, evidência de baixa certeza;
- NHS — Panic disorder: respiração lenta/profunda e orientação de cuidado;
- National Sleep Foundation / Sleep Health 2024, PMID 38806392: consenso parcial sobre telas e sono, com incerteza relevante em afirmações específicas sobre luz e adultos.

## Guardrails
Nenhuma alteração em Diário, Check-in, Jardim, planos, Stripe, permissões, RLS de usuários ou dados privados. Nenhum disparo de outreach. Nenhum `reviewed_at` artificial.
