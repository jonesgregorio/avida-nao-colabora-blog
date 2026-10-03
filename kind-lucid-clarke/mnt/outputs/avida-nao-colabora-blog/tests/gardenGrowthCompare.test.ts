import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const garden = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')
const compare = readFileSync(new URL('../src/components/garden/GardenGrowthCompare.tsx', import.meta.url), 'utf8')

test('avisa quando o MESMO jardim avançou desde a última visita, mas não soma com a celebração de 100%', () => {
  assert.match(garden, /LAST_GARDEN_PROGRESS_KEY_PREFIX/)
  assert.match(garden, /const sameGarden=prev!=null&&!Number\.isNaN\(prev\)&&nextIndex===prev/)
  assert.match(garden, /else if\(sameGarden&&prevProgress!=null&&!Number\.isNaN\(prevProgress\)&&nextProgress>prevProgress\)/)
  assert.match(garden, /setGrowthChange\(\{theme:resolveGardenTheme\(next\.garden_slug,nextIndex\),from:prevProgress,to:nextProgress\}\)/)
})

test('área de comparação permanece visível durante toda a experiência Meu Jardim', () => {
  assert.doesNotMatch(garden, /\{growthChange&&<div className="mb-5 flex flex-col gap-3 rounded-\[22px\]/)
  assert.match(garden, /Veja como seu jardim está crescendo ao longo do tempo\./)
  assert.match(garden, /Seu jardim mudou desde sua última visita\./)
  assert.match(garden, /function openGrowthCompare\(\)/)
  assert.match(garden, /<button type="button" onClick=\{openGrowthCompare\}[^>]*>Comparar crescimento<\/button>/)
  assert.match(garden, /growthChange&&<button type="button" onClick=\{\(\)=>setGrowthChange\(null\)\}/)
  assert.match(garden, /<GardenGrowthCompare theme=\{growthChange\.theme\} from=\{growthChange\.from\} to=\{growthChange\.to\}/)
})

test('comparação sempre pode ser aberta mesmo sem mudança desde a última visita', () => {
  assert.match(garden, /const compareFrom=priorProgress!=null&&priorProgress!==\(state\.garden_progress\|\|0\)\?priorProgress:0/)
  assert.match(garden, /if\(!growthChange\)setGrowthChange\(\{theme,from:compareFrom,to:state\.garden_progress\|\|0\}\)/)
  assert.match(garden, /setCompareOpen\(true\)/)
})

test('comparação usa theme.stages e a mesma matemática de crossfade da cena viva', () => {
  assert.match(compare, /theme\.stages\.map/)
  assert.match(compare, /gardenVisualProgress\(progress, theme\.stages\.length === 6 \? 6 : 4\) \* last/)
  assert.doesNotMatch(compare, /'japones'|'nordico'|'deserto'|'cottage'/)
})

test('comparação fecha por Escape, clique fora, ou botão', () => {
  assert.match(compare, /label="Agora"/)
  assert.match(compare, /key === 'Escape'/)
  assert.match(compare, /onClick=\{onClose\}/)
  assert.match(compare, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/)
})

test('comparação permite alternar entre a última atualização e o jardim inicial', () => {
  assert.match(compare, /type CompareMode = 'last' \| 'initial'/)
  assert.match(compare, /setMode\('initial'\)/)
  assert.match(compare, /setMode\('last'\)/)
  assert.match(compare, />Desde o início<\/button>/)
  assert.match(compare, />Última atualização<\/button>/)
  assert.match(compare, /const comparisonFrom = mode === 'initial' \? 0 : lastUpdateProgress/)
  assert.match(compare, /label=\{firstLabel\}/)
  assert.match(compare, /Desde o início, seu jardim passou de/)
  assert.match(compare, /Desde a última atualização, seu jardim passou de/)
})

test('última atualização usa visita anterior real ou último marco visual como fallback', () => {
  assert.match(compare, /function previousVisualUpdate\(progress: number, stageCount: number\)/)
  assert.match(compare, /stageCount === 6 \? \[0, 3, 10, 18, 28, 39\] : \[0, 10, 28, 50\]/)
  assert.match(compare, /const realPrevious = from > 0 && from < to \? from : null/)
  assert.match(compare, /const lastUpdateProgress = realPrevious \?\? fallbackPrevious/)
  assert.match(compare, /const hasLastUpdateComparison = to > 0 && lastUpdateProgress < to/)
  assert.match(compare, /disabled=\{!hasLastUpdateComparison\}/)
})
