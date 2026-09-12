import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const garden = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')
const compare = readFileSync(new URL('../src/components/garden/GardenGrowthCompare.tsx', import.meta.url), 'utf8')

// Notificação + comparação de crescimento: "cada vez que o jardim tiver alguma alteração",
// com um botão que compara o antes/depois — precisa funcionar pros 8 jardins, não só um.

test('avisa quando o MESMO jardim avançou desde a última visita, mas não soma com a celebração de 100%', () => {
  assert.match(garden, /LAST_GARDEN_PROGRESS_KEY_PREFIX/)
  assert.match(garden, /const sameGarden=prev!=null&&!Number\.isNaN\(prev\)&&nextIndex===prev/)
  assert.match(garden, /else if\(sameGarden&&prevProgress!=null&&!Number\.isNaN\(prevProgress\)&&nextProgress>prevProgress\)/)
  assert.match(garden, /setGrowthChange\(\{theme:resolveGardenTheme\(next\.garden_slug,nextIndex\),from:prevProgress,to:nextProgress\}\)/)
})

test('banner de mudança aparece na página, com botão de comparar e botão de dispensar', () => {
  assert.match(garden, /\{growthChange&&<div/)
  assert.match(garden, /Seu jardim mudou desde sua última visita\./)
  assert.match(garden, /onClick=\{\(\)=>setCompareOpen\(true\)\}/)
  assert.match(garden, /Comparar crescimento/)
  assert.match(garden, /onClick=\{\(\)=>setGrowthChange\(null\)\}/)
  assert.match(garden, /<GardenGrowthCompare theme=\{growthChange\.theme\} from=\{growthChange\.from\} to=\{growthChange\.to\}/)
})

test('comparação usa theme.stages e a mesma matemática de crossfade da cena viva — funciona pra qualquer um dos 8 jardins, não hardcoded', () => {
  assert.match(compare, /theme\.stages\.map/) // genérico: qualquer GardenTheme, não um slug fixo
  assert.match(compare, /gardenVisualProgress\(progress\) \* 3/) // mesma fórmula de applyProgress() no motor
  assert.doesNotMatch(compare, /'japones'|'nordico'|'deserto'|'cottage'/) // nenhum jardim específico hardcoded
})

test('comparação mostra Antes/Agora e fecha por Escape, clique fora, ou botão', () => {
  assert.match(compare, /label="Antes"/)
  assert.match(compare, /label="Agora"/)
  assert.match(compare, /key === 'Escape'/)
  assert.match(compare, /onClick=\{onClose\}/)
  assert.match(compare, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/) // clique dentro do card não fecha
})

test('botão de comparar é FIXO no card "Jardim atual" (não só dentro do aviso temporário que pode passar despercebido)', () => {
  assert.match(garden, /const \[priorProgress,setPriorProgress\]=useState<number\|null>\(null\)/)
  assert.match(garden, /if\(sameGarden&&prevProgress!=null&&!Number\.isNaN\(prevProgress\)\)setPriorProgress\(prevProgress\)/)
  assert.match(garden, /\{priorProgress!=null&&priorProgress!==\(state\.garden_progress\|\|0\)&&<button/)
  assert.match(garden, /Comparar crescimento com a última visita/)
})
