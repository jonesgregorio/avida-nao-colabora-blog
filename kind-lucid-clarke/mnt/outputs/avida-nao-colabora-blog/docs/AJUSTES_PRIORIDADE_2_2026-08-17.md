# Ajustes — Prioridade 2 — 2026-08-17

Esta rodada continua o trabalho conjunto Claude + Codex + ChatGPT, preservando a Prioridade 1.

## Concluído

1. Relatório mensal aprofundado exige uma base de dados maior: 8 dias ativos e 12 registros para confiança média. Abaixo disso, continua disponível com aviso explícito de baixa confiança. O semanal mantém 3 dias/5 registros.
2. Legados de Trilhas, Caixa de Cuidado e Meditações foram retirados das áreas e prompts ativos. Aliases/mapeamentos antigos podem permanecer apenas para compatibilidade com dados e URLs históricos.
3. O Resumo mensal simples do Essencial foi movido da área `reports` para `resumo` (Mapa emocional), evitando confusão com o relatório mensal aprofundado do Plus.
4. Consultas do Mapa emocional à coluna `date` passaram a usar limites `YYYY-MM-DD`, sem conversão UTC por `toISOString()`.
5. A Orientação Mensal no Admin ganhou editor por seções e continua salvando `final_response_json`, mantendo fallbacks antigos.

## Contratos preservados

- Essencial: relatório semanal.
- Plus: relatório semanal + mensal aprofundado + plano + orientação.
- `emotional_tags` são marcadores; `trigger_tags` são gatilhos reais.
- Stripe/pagamentos não foram alterados.
- `saved_items` permanece como infraestrutura de itens salvos, sem a marca legada “Caixa de Cuidado”.
