# Relatório — Correção Visual e Fidelidade aos Prints

Projeto: **A Vida Não Colabora** · Foco: fidelidade visual aos prints de referência (Desktop.pdf + Mobile.pdf) e limpeza estrutural do legado.

---

## 1. Resumo executivo

O projeto foi reaproximado dos prints de referência tratando as imagens como **especificação obrigatória**, não como inspiração. Foram corrigidos: tipografia da marca (Playfair Display), paleta exata do guia, header (desktop mais alto + mobile com logo/Entrar/hambúrguer), hero (still-life + check-in com estado selecionado), card Recursos Plus, seção Três caminhos, criação da seção **Tudo em um fluxo simples de cuidado**, seção **Planos que crescem com você**, seção **Um apoio, não um diagnóstico**, **footer claro** com newsletter, e a página **/planos** (ícones, botão Plus contornado, tabela em card). Também foi removido o legado voltado ao usuário (Terapêutico/Terapêutico Plus/Sessão Plus/R$ 79,90) da home, do perfil, do Mapa emocional, do suporte (FAQ) e das notificações.

Validação técnica final: `build` ✓, `tsc --noEmit` ✓, `eslint` ✓ (max-warnings 0), `npm audit --omit=dev` ✓ (0 vulnerabilidades).

**Limitação:** a renderização por Chromium está bloqueada neste ambiente (`net::ERR_BLOCKED_BY_ADMINISTRATOR`, o mesmo erro relatado pela auditoria). Não foi possível capturar screenshots; a verificação foi feita por DOM (`getComputedStyle`, estrutura, textos, ordem das seções) + build/tsc/lint.

## 2. Prints usados como referência

Extraídos dos PDFs anexados (JPEGs embutidos):
- **Desktop.pdf** (7 imagens): cards de planos, página /planos ("Planos que crescem com você"), hero desktop com still-life, e capturas do estado anterior (para comparação).
- **Mobile.pdf** (3 imagens): cards de planos mobile, home mobile completa, e a **home desktop completa** (print mestre com a ordem canônica das seções e o footer claro).

## 3. Diferenças encontradas (vs. ZIP auditado)

Fonte serifada errada (Cormorant); paleta aproximada; header baixo e logo somindo no mobile; hero sem imagem decorativa; check-in sem estado selecionado; card Recursos Plus sem divisórias; Três caminhos em linha compacta; seção escura "Cinco formas" + "Como funciona" no lugar do fluxo de 5 passos; planos em posição errada; ausência da seção "Um apoio, não um diagnóstico"; **footer escuro**; blocos antigos embutidos na home; e referências ao produto antigo (Terapêutico/Sessão Plus/R$ 79,90).

## 4. Correções na fonte

- Trocado **Cormorant Garamond → Playfair Display** para títulos e logo; Inter mantida para corpo/UI.
- Arquivos: `index.html` (Google Fonts), `src/index.css` (h1–h6), `tailwind.config.js` (`fontFamily.serif`).
- Verificado: `h1` computa `font-family: "Playfair Display"`.

## 5. Correções na paleta

Tokens ajustados para os valores exatos do guia da marca:
- principal `#1A4A3A` (forest-900), fundo `#FBFAF7` (paper), texto `#0F2F25` (ink), secundário `#5F6661` (ink-soft), borda `#E6E1D8` (line), verde `#E8F0EB` (mint), azul `#E4EEF7` (sky), coral `#F7D8CE`, lilás `#E9E1F3`, coral forte do Plus `#E8664D` (token `plus`).
- Verificado: `body` bg `rgb(251,250,247)`, `h1` cor `rgb(26,74,58)`.

## 6. Correções no header desktop

- Altura de `h-16` → **`h-20`** (mais alto/espaçado, como no print).
- Logo com ícone maior (`w-8 h-8`) e texto maior.
- Menu: Blog · Diário · Mapa emocional · Conteúdos · Planos, com sublinhado verde no item ativo. Botão **Entrar** contornado.

## 7. Correções no header mobile

- Corrigido o `hidden sm:inline` que **escondia o nome da marca** — agora "A Vida Não Colabora" fica sempre visível (menor no mobile).
- Adicionado **botão "Entrar" visível** para visitante, ao lado do hambúrguer.
- Verificado no viewport 375–386px: nome visível + Entrar + hambúrguer, sem overflow horizontal.

## 8. Correções na logo/favicon

- `Logo`/`LogoIcon` (coração contornado + folha) mantidos; proporção do ícone ajustada e nome sempre visível.
- Favicon SVG e `theme-color`/`mask-icon` atualizados para `#1A4A3A`.

## 9. Correções na hero

- Estrutura de 3 colunas confirmada: texto+CTAs / check-in / Recursos Plus.
- Título, subtítulo e "Seus dados são privados e protegidos." conforme print.
- CTAs: **"Começar grátis"** (preenchido) + **"Fazer check-in"** como link leve com seta (não mais botão pesado).

## 10. Correções na imagem da hero

- Criado o asset **`src/components/HeroArt.tsx`** — ilustração vetorial (SVG) na paleta da marca: planta de folhas verdes atrás de uma pilha de dois livros creme (com marcador), xícara de cerâmica creme com vapor, sobre mesa clara, **sangrando pela esquerda**.
- Optou-se por SVG (e não foto) por controle total, aderência à paleta e por evitar dependência de foto externa (que havia sido rejeitada). Pode ser trocado por foto real se desejado.

## 11. Correções no check-in

- Implementado **estado selecionado real**: clicar em uma emoção seleciona (anel verde + fundo suave) e revela o CTA **"Continuar para o diário"** — **não navega mais instantaneamente** (atende ao item 7.4 da spec).
- Ícones customizados de "Ansioso" (novelo) e "Sobrecarregado" (pedras) mantidos; ícones coloridos direto no card (raio menor), sem círculo de fundo.
- Verificado: ao selecionar, `ring-2` aplicado, CTA aparece, rodapé de escudo é substituído.

## 12. Correções no card Recursos Plus

- 4 itens (Plano de autocuidado, Comentário profissional, Relatório mensal, Orientação por mensagem) com **divisórias suaves** entre eles (verificado: 3 divisórias).
- Subtítulo "Apoio extra para transformar percepção em próximos passos." + link "Saiba mais sobre o Plus →".

## 13. Correções na seção Três caminhos

- Cards **verticais** (ícone em círculo no topo) com fundo levemente tintado (mint/sky/coral).
- Textos e CTAs do print: "Explorar conteúdos", "Ir para meu diário", "Ver meu mapa".

## 14. Correções na seção Fluxo simples

- **Removidas** as seções escura "Cinco formas de cuidar de você" e "Como funciona" (4 cards).
- Criada a seção clara **"Tudo em um fluxo simples de cuidado"** com **5 passos** (Faça seu check-in → Escreva no diário → Descubra padrões → Receba sugestões → Dê pequenos passos), ícones em círculos suaves e **setas** entre os passos no desktop; empilhado no mobile.

## 15. Correções nos planos (home)

- Seção **"Planos que crescem com você"** (após o fluxo simples) com 3 cards completos: Gratuito/Essencial/Plus, Essencial destacado com borda verde + selo "Mais escolhido", botões coerentes (Começar agora / Assinar Essencial preenchido / Assinar Plus contornado coral). Preços R$ 0 / R$ 19,90 / R$ 39,90.
- **Removida** a seção compacta "Escolha seu plano" que estava fora de posição.

## 16. Correções na página /planos

- Título "Planos que crescem com você" / "Comece grátis. Evolua quando fizer sentido.".
- Ícones alinhados ao print canônico (desktop_2): **Gratuito = broto, Essencial = gráfico (line-chart), Plus = estrela**.
- Botão do **Plus contornado coral** (fundo transparente, borda `#e8664d`, texto `#c8502f`) — verificado por `getComputedStyle`.

## 17. Correções na tabela comparativa

- Envolvida em **card arredondado com borda** (`rounded-3xl` + borda), com scroll horizontal interno no mobile.
- Cabeçalho com **ícones dos planos** (broto/gráfico/estrela) e linhas bem delimitadas; coluna Essencial destacada.
- Conteúdo: Diário (Básico/Ilimitado/Ilimitado), Mapa (Básico/Completo/Completo), Conteúdos (Limitados/Todos/Todos), Plano de autocuidado (—/—/Incluído), Orientação profissional (—/—/Incluída).
- **Decisão de produto:** Plano de autocuidado e Orientação profissional são exclusivos do **Plus** (—/—/Incluído), seguindo a regra oficial mesmo o print mostrando "Incluído" no Essencial (item 13.3 da spec).

## 18. Correções na seção de segurança

- Substituída "Seu espaço é privado" pela seção **"Um apoio, não um diagnóstico"** com 3 cards: Privacidade em primeiro lugar / Autoconhecimento com respeito / Você no centro, mais o aviso clínico ("não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência").

## 19. Correções no footer

- **Footer claro** (`bg-paper` `#FBFAF7`, borda superior suave) — verificado por `getComputedStyle`.
- Estrutura: logo + descrição + redes; colunas Navegação / Recursos / Empresa; newsletter "Receba conteúdos que acolhem" / "Junte-se a quem escolhe se cuidar." + campo "Seu e-mail" + botão "Quero receber"; rodapé "© {ano} … Todos os direitos reservados." + "Feito com cuidado no Brasil".
- **CVV/emergência saiu do footer** — o aviso de segurança agora vive na seção "Um apoio, não um diagnóstico".

## 20. Correções no mobile

- Header mobile corrigido (seção 7).
- Moods do check-in em linha; sem overflow horizontal (verificado 375–386px).
- Still-life e seções empilham; footer claro responsivo.

## 21. Remoção de blocos antigos da home

Removidos de `App.tsx` (home): `DailyContentWidget`, o **bloco de atalhos antigos** (Mini-Desafios, Trilhas de Autocuidado, Caixa de Cuidado, Meditações Guiadas, Questionário Aprofundado, Orientação Mensal, Comentários do Profissional, Meu Relatório), e os componentes embutidos `Articles`, `DiaryCard`, `Questionnaire`. Home agora: Header → Hero → HomeContent → Footer.

## 22. Limpeza de referências antigas

- **Profile.tsx**: removidos Terapêutico (R$ 39,90) e Terapêutico Plus (**R$ 79,90**); mapa de planos só Gratuito/Essencial/Plus, com normalização de perfis legados.
- **MyEvolutionPage.tsx**: **removida a aba "Sessão Plus"**; abas de Plus gated para `plus`; bloco "Recursos Terapêutico Plus" → "Recursos Plus".
- **AdminSupport.tsx**: FAQ reescrito (3 planos); removidos "Plano Terapêutico Plus (R$ 79,90)" e "Sessão mensal Plus".
- **AdminNotifications.tsx**: destinos relabelados; "Sessão Plus" removido.
- **personalizedContentLabels.ts / personalizationTasks.ts**: labels atualizados (Minha Evolução → Mapa emocional, etc.); removida a task `monthly_session`.
- Termos legados permanecem apenas em normalização/compat e em painéis internos do admin (ver Pendências).

## 23. Arquivos alterados

- `index.html`, `src/index.css`, `tailwind.config.js`
- `src/App.tsx`
- `src/components/Header.tsx`, `Logo.tsx`
- `src/components/Hero.tsx`, `HeroArt.tsx` (novo), `HomeContent.tsx`, `Footer.tsx`
- `src/components/Pricing.tsx`
- `src/components/Profile.tsx`, `MyEvolutionPage.tsx`
- `src/components/admin/AdminSupport.tsx`, `AdminNotifications.tsx`
- `src/lib/personalizedContentLabels.ts`, `src/lib/personalizationTasks.ts`

## 24. Assets criados/adicionados

- **`src/components/HeroArt.tsx`** — ilustração SVG do still-life da hero (planta + xícara + livros + mesa). Sem assets binários novos (evita dependência/404).

## 25. Testes executados

| Comando | Resultado |
|---|---|
| `vite build` | ✓ 1628 módulos, built in ~4.8s |
| `tsc --noEmit` | ✓ sem erros |
| `eslint . --max-warnings 0` | ✓ sem avisos |
| `npm audit --omit=dev` | ✓ 0 vulnerabilidades |

## 26. Resultado dos testes

Todos passaram. Nenhum erro de tipo, lint ou vulnerabilidade. Verificação visual por DOM confirmou: fonte Playfair, paleta exata, ordem das seções da home, footer claro, header mobile, still-life presente, check-in com estado selecionado, /planos com ícones e botão Plus contornado, e ausência de overflow horizontal no mobile.

## 27. Pendências restantes / o que ainda não ficou idêntico e por quê

1. **Screenshots** não disponíveis (Chromium bloqueado). Fidelidade pixel-a-pixel de espaçamentos finos não pôde ser conferida visualmente — recomenda-se uma passada visual no deploy.
2. **Still-life** é uma **ilustração SVG**, não a foto realista do print. Foi decisão consciente (controle + paleta + sem 404). Se preferir foto, é troca de 1 componente.
3. **Ícones dos planos divergem entre os próprios prints** (broto/estrela/coração vs broto/gráfico/estrela vs broto/estrela/coroa). Padronizou-se por página conforme o print daquela tela; pode-se unificar se desejado.
4. **Home logada**: a home agora é limpa para todos; o dashboard logado com as 5 funcionalidades e bloqueios por plano ainda será construído (build maior).
5. **Legado profundo no admin** (não visível ao público): `AdminEvolutionSessions` ("Sessões Plus"), `AdminAreaAtendimento` (aba `sessoes`), e métricas "Sessões Plus" em `systemHealth.ts` / `aiContent.ts` / `AdminUsers.tsx` — entram na reestruturação do menu do admin (Fase Admin).
6. **Rota `mapa-emocional`**: o rótulo visível já é "Mapa emocional"; falta criar o alias de rota interno mantendo `my-evolution` como legado.
