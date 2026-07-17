# Marca — A Vida Não Colabora

Arquivos exportados a partir da **logo original do projeto**. Nada aqui foi
redesenhado: nenhuma fonte, cor, proporção ou elemento foi alterado.

## De onde a logo veio

A logo **não existia como arquivo de imagem**. Ela é um **componente React**:
[`src/components/Logo.tsx`](../../src/components/Logo.tsx), composto por

- **ícone SVG inline** (`LogoIcon`) — coração contornado com uma folha, em `currentColor`;
- **texto** "A Vida Não Colabora" com as classes `font-serif text-forest-900`.

O único arquivo de imagem do projeto era `public/favicon.svg` (preservado aqui
como `logo-original-favicon.svg`).

## Valores oficiais (medidos na logo renderizada em produção, não deduzidos)

| Item | Valor |
|---|---|
| Ícone (paths) | copiados de `Logo.tsx`, `stroke-width` 1.9 e 1.7 |
| Cor do ícone | `#123528` — `forest-800` |
| Cor do texto | `#1A4A3A` — `forest-900` |
| Fonte | **Playfair Display**, peso **400**, `letter-spacing: normal` |
| Tamanho do texto | 20px (`text-xl`), `line-height: 1` |
| Espaço ícone↔texto | 10px (`gap-2.5`) |
| Ícone no cabeçalho | 32px (`w-8 h-8`) |
| Proporção horizontal | 225 × 32 |

Fundo escuro (sidebar do app/admin): ícone `#FFFFFF`, texto branco a 90%.

## Arquivos

**Fontes vetoriais**
- `logo-horizontal.svg` — fundo claro (cabeçalho)
- `logo-horizontal-dark.svg` — fundo escuro (sidebar/admin)
- `logo-icon.svg` — só o ícone
- `logo-original-favicon.svg` — cópia byte a byte do `public/favicon.svg` original

**PNG (fundo transparente)**
- `logo-original.png` (1800px) · `logo-horizontal@2x.png` (900px) · `logo-horizontal.png` (450px)
- `logo-horizontal-dark.png` (900px)
- `logo-quadrada.png` (512px) · `logo-quadrada@2x.png` (1024px)
- `logo-admin.png` (128px) · `logo-menu.png` (64px)
- `favicon-16.png` · `favicon-32.png` · `favicon-48.png` · `apple-touch-icon-180.png` · `logo-favicon.png` (512px)

> ⚠️ Os SVGs horizontais usam `<text>` e dependem da fonte Playfair Display
> estar instalada em quem abrir o arquivo. **Para uso fora do site** (redes,
> e-mail, terceiros, impressão), use os **PNGs** — eles já vêm rasterizados com
> a fonte correta.

## Como usar

**No site (Header/Admin):** continue usando o componente `<Logo />` e
`<LogoIcon />`. Ele é a fonte da verdade, se adapta ao tema via `currentColor` e
não depende destes arquivos. Estes exports servem para **usos externos**.

**Favicon:** o `index.html` já aponta para `/favicon.svg` (SVG escala em qualquer
tamanho). Os PNGs existem para onde SVG não é aceito:

```html
<link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon-180.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
```

**Redes sociais / og:image:** use `logo-quadrada.png` ou `logo-original.png`.
Hoje o `index.html` usa `/favicon.svg` como `og:image` — a maioria das redes
**não aceita SVG**, então um PNG funciona melhor ali.

## Regerar

```bash
npm install --no-save @resvg/resvg-js @fontsource/playfair-display wawoff2
node scripts/export-brand.mjs
```

O script converte o woff2 real do Playfair Display para TTF e o entrega ao
rasterizador. Sem isso o texto **não desenha** (verificado: 0 pixels) e sairiam
PNGs só com o coração. O script falha com erro se o texto não aparecer.

## Instagram

- `instagram-perfil.png` — **1080×1080, fundo branco**. É o arquivo para subir.
- `instagram-perfil-320.png` — 320×320 (tamanho que o Instagram de fato armazena).
- `instagram-perfil.svg` — fonte vetorial.

Só o ícone, sem o nome: o Instagram corta a foto de perfil em **círculo** e a
exibe a ~110px — o texto ficaria ilegível e com as pontas cortadas.

Enquadramento verificado: o desenho tem raio de 371px contra os 540px do círculo,
então nada é cortado. Cantos em branco opaco (não transparente), como o
Instagram espera.

### Feed e Story

- `instagram-feed.png` — 1080×1080, fundo branco, **com o nome**.
- `instagram-story.png` — 1080×1920, fundo branco, **com o nome**.

Feed e Story não têm corte circular e são vistos grandes, então aqui o nome cabe
e fica legível. Mantido o **lockup horizontal original** (ícone à esquerda, nome
à direita) — empilhar em duas linhas mudaria o alinhamento da logo.

No Story, a logo fica na faixa central (y≈906–1014), longe das áreas que o
Instagram cobre com a interface (~250px no topo e ~250px embaixo).
