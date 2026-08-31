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

test('prompt de imagem inclui ideia, artigo, objetivo e paleta da marca', () => {
  const p = buildImagePromptRequest(brief)
  assert.match(p, /não precisar dar conta de tudo/)
  assert.match(p, /Quando descansar vira culpa/)
  assert.match(p, /salvarem o post/)
  assert.match(p, /#FBFAF7/)
  assert.match(p, /TEMPLATE da marca/)
  assert.match(p, /SOMENTE um JSON/)
})

test('prompt de imagem muda a instrução conforme o estilo escolhido', () => {
  assert.match(buildImagePromptRequest({ ...brief, estilo: 'ia' }), /gerada inteiramente por IA/)
  assert.match(buildImagePromptRequest({ ...brief, estilo: 'hibrido' }), /Fundo gerado por IA \+ tipografia/)
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
