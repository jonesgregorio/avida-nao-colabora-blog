# Fase 22.10 — Sistema visual global

A Fase 22.10 fecha a reorganização da experiência com acabamento visual compartilhado, sem reconstruir as telas nem alterar a arquitetura principal.

## Princípios

1. **Acabamento, não reconstrução.** A fase atua sobre ritmo, superfícies, foco, tipografia e estados secundários. Não muda rotas, menu, banco, planos ou persistência.
2. **Largura respeita a intenção da tela.** A maioria das páginas de leitura e cuidado permanece em `max-w-4xl`. A página Hoje e experiências analíticas detalhadas podem continuar mais largas quando a composição exigir.
3. **Uma linguagem de superfície.** Cards principais usam raio amplo, borda leve, fundo da paleta oficial e sombra discreta. Hover nunca deve parecer gamificação ou recompensa.
4. **Tipografia editorial coerente.** Títulos continuam em Playfair Display e textos em Inter; títulos podem quebrar de forma balanceada e textos longos mantêm uma medida confortável.
5. **Foco visível e consistente.** Controles interativos devem manter foco perceptível por teclado sem depender da cor de fundo do componente.
6. **Estados vazios são calmos.** Estados sem dados podem usar borda tracejada e fundo suave, sem transformar ausência em erro, atraso ou perda de progresso.
7. **Hierarquia preservada.** O sistema visual não pode trazer de volta vários CTAs concorrentes, streak, ranking, barra de progresso ou pressão de completude.
8. **Mobile continua primeiro.** O acabamento não reduz áreas de toque nem modifica a navegação inferior já aprovada.

## Implementação central

Os tokens e seletores globais vivem em `src/index.css` para aproveitar as primitivas Tailwind que as telas da Fase 22 já compartilham. Isso permite alinhar superfícies, foco, tipografia e estados vazios sem editar dezenas de componentes e sem criar uma segunda arquitetura visual.

A regra de largura não força um único tamanho: apenas garante que wrappers `max-w-4xl`, `max-w-5xl` e `max-w-6xl` ocupem a largura disponível até o próprio limite. Assim, Hoje pode permanecer mais ampla e as páginas de leitura continuam mais concentradas.
