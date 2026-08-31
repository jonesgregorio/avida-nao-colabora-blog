import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildImagePromptRequest, buildCaptionRequest } from '../src/lib/estudioPrompts.ts'

const brief = {
  ideia: 'não precisar dar conta de tudo ao mesmo tempo',
  objetivos: ['salvar', 'compartilhar'],
  estilo: 'template' as const,
  artigoTitulo: 'Quando descansar vira culpa',
}

test('prompt de imagem exige FOTOGRAFIA realista, nunca desenho/ilustração', () => {
  const p = buildImagePromptRequest(brief)
  assert.match(p, /não precisar dar conta de tudo/)
  assert.match(p, /Quando descansar vira culpa/)
  assert.match(p, /salvarem o post/)
  assert.match(p, /IDENTIDADE VISUAL OBRIGATÓRIA/)
  assert.match(p, /SEMPRE fotografia realista/)
  assert.match(p, /NUNCA ilustração, desenho, cartoon/)
  assert.match(p, /Comece o prompt SEMPRE com "Fotografia realista/)
  assert.match(p, /ilustração, desenho, cartoon, anime, 3D render/) // negativos
  assert.match(p, /SOMENTE um JSON/)
})

test('tipo "pessoa" pede uma PESSOA REAL adulta num momento cotidiano, não olhando fixo pra câmera', () => {
  const pessoa = buildImagePromptRequest({ ...brief, tipoArte: 'pessoa', formato: 'feed-45' })
  assert.match(pessoa, /TEMPLATE "com pessoa"/)
  assert.match(pessoa, /UMA PESSOA REAL adulta \(foto, fotorrealista\)/)
  assert.match(pessoa, /recorte circular/)
  assert.match(pessoa, /NÃO olha fixo para a câmera/)
  assert.match(pessoa, /tom terroso/)
})

test('tipo "frase" também pode ser foto de pessoa, e mantém uma zona limpa para o título', () => {
  const frase = buildImagePromptRequest({ ...brief, tipoArte: 'frase', formato: 'story' })
  assert.match(frase, /TEMPLATE "com frase"/)
  assert.match(frase, /pode ser uma pessoa real/i)
  assert.match(frase, /mais limpa/)
})

test('prompt de legenda pede 3 variações rotuladas e hashtags no 1º comentário', () => {
  const p = buildCaptionRequest(brief)
  assert.match(p, /"rotulo": "acolhedora"/)
  assert.match(p, /"rotulo": "direta"/)
  assert.match(p, /"rotulo": "pergunta"/)
  assert.match(p, /hashtags vão no primeiro comentário/)
  assert.match(p, /nicho médio/)
})

test('nenhum prompt do Estúdio menciona Diário, humor ou marcadores emocionais como fonte', () => {
  const src = readFileSync(new URL('../src/lib/estudioPrompts.ts', import.meta.url), 'utf8')
  assert.match(src, /NUNCA inclui trecho do Diário/)
  const p = buildCaptionRequest(brief) + buildImagePromptRequest(brief)
  assert.doesNotMatch(p, /diário|humor médio|marcador emocional/i)
})

test('estudioAi reusa generate-content e não expõe chave no front', () => {
  const src = readFileSync(new URL('../src/lib/estudioAi.ts', import.meta.url), 'utf8')
  assert.match(src, /functions\.invoke\('generate-content'/)
  assert.doesNotMatch(src, /API_KEY|apiKey|Bearer /)
})
