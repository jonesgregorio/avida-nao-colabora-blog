import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')

test('Fase 22.3 apresenta Descobertas em linguagem simples, progressiva e organizada', () => {
  assert.match(page, /Visão geral/)
  assert.match(page, /Em destaque agora/)
  assert.match(page, /Agora/)
  assert.match(page, /Padrões/)
  assert.match(page, /Conexões/)
  assert.match(page, /Guardadas/)
  assert.match(page, /Ocultas/)
  assert.match(page, /Ver detalhes/)
})

test('Fase 22.3 preserva coleção, feedback, mapa e histórico sem expor a arquitetura interna', () => {
  assert.match(page, /feedback\[discovery\.stableKey\] === 'made_sense'/)
  assert.match(page, /feedback\[discovery\.stableKey\] !== 'made_sense'/)
  assert.match(page, /DiscoveryMemoryArchive/)
  assert.match(page, /Ver no Mapa Emocional/)
  assert.match(page, /Isso fez sentido para você\?/)
  assert.doesNotMatch(page, />Em formação</)
})

test('Fase 22.3 mantém privacidade explícita e sem gamificação de pressão', () => {
  assert.match(page, /Nenhum trecho do texto livre do seu diário é usado nesta área/)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|pontos conquistados|faltam\s+\d+|\d+%/i)
  assert.doesNotMatch(page, /progress|aria-valuenow/i)
})
