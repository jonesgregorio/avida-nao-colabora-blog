# SEO P3 — Relatório final de implementação — 20/09/2026

## Resultado
A P3 transforma o SEO Control Center em uma camada de decisão orientada pelos dados próprios do Search Console do AVNC.

## Implementado
- priorização de oportunidades por evidência (impressões, CTR e posição);
- classificação em alta, média e acompanhar;
- deduplicação de oportunidades;
- comparação dos últimos 28 dias com os 28 dias anteriores;
- tendências Crescendo, Estável, Caindo e Dados insuficientes;
- proteção contra conclusões com volume muito baixo;
- coleta de dimensão consulta+página para evidência de sobreposição;
- detecção de possível canibalização somente quando duas páginas recebem impressões para a mesma consulta;
- nova aba Sobreposição no Admin, sem consolidação/redirecionamento automático;
- manutenção da decisão editorial humana;
- correção do fallback SSR do guia Relações para o slug canônico;
- documentação operacional alinhada aos seis guias oficiais;
- testes de regressão específicos da P3.

## Banco
A dimensão `query_page` foi adicionada ao histórico server-only `seo_search_performance_daily`. RLS e o modelo de acesso existente foram preservados. Nenhuma tabela de usuário, plano, Diário, Check-in ou Jardim foi alterada.

## Segurança editorial
- nenhuma publicação automática foi adicionada;
- nenhuma revisão profissional fictícia é criada;
- sobreposição é tratada como sinal de investigação, não como ordem de excluir/redirecionar;
- pouco volume é classificado como dados insuficientes;
- conteúdo sensível permanece dependente de revisão humana apropriada.

## Dependências externas
O GSC Wizard externo permanece indisponível por assinatura/trial, mas a P3 não depende dele: usa a integração própria do AVNC com Google Search Console.

## Fora de escopo preservado
Diário, Check-in, Jardim, planos, Stripe, permissões, dados privados e regras de acesso não foram modificados.

## Gate
Merge somente após CI, Browser E2E e Vercel Preview concluírem com sucesso.
