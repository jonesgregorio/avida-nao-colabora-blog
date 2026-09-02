import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')

test('Fase 22.3 apresenta Descobertas em linguagem simples e progressiva', () => {
  assert.match(page, /Aparecendo agora/)
  assert.match(page, /Talvez valha observar/)
  assert.match(page, /Minha coleção/)
  assert.match(page, /Coisas que já fizeram sentido para mim/)
  assert.match(page, /Entender melhor/)
})

test('Fase 22.3 preserva coleção, feedback, mapa e histórico sem expor a arquitetura interna', () => {
  assert.match(page, /feedback\[d\.stableKey\] === 'made_sense'/)
  assert.match(page, /feedback\[d\.stableKey\] !== 'made_sense'/)
  assert.match(page, /Reconhecida por você/)
  assert.match(page, /DiscoveryMemoryArchive/)
  assert.match(page, /Ver no Mapa Emocional/)
  assert.doesNotMatch(page, />Em formação</)
  assert.doesNotMatch(page, />Para observar</)
})

test('Fase 22.3 mantém privacidade explícita e sem gamificação de pressão', () => {
  assert.match(page, /Nenhum trecho do texto livre do seu diário é usado nesta área/)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|pontos conquistados|faltam\s+\d+|\d+%/i)
  assert.doesNotMatch(page, /progress|aria-valuenow/i)
})
