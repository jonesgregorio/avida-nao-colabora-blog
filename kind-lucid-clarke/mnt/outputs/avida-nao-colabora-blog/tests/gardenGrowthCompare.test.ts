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

test('banner de mudança aparece na página, com botão de comparar e botão de dispensar', () => {
  assert.match(garden, /\{growthChange&&<div/)
  assert.match(garden, /Seu jardim mudou desde sua última visita\./)
  assert.match(garden, /onClick=\{\(\)=>setCompareOpen\(true\)\}/)
  assert.match(garden, /Comparar crescimento/)
  assert.match(garden, /onClick=\{\(\)=>setGrowthChange\(null\)\}/)
  assert.match(garden, /<GardenGrowthCompare theme=\{growthChange\.theme\} from=\{growthChange\.from\} to=\{growthChange\.to\}/)
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

test('botão de comparar é FIXO no card Jardim atual', () => {
  assert.match(garden, /const \[priorProgress,setPriorProgress\]=useState<number\|null>\(null\)/)
  assert.match(garden, /if\(sameGarden&&prevProgress!=null&&!Number\.isNaN\(prevProgress\)\)setPriorProgress\(prevProgress\)/)
  assert.match(garden, /\{\(state\.garden_progress\|\|0\)>0&&<button/)
  assert.match(garden, /Comparar crescimento com a última visita/)
})

test('botão de comparar aparece já na primeira visita sem histórico salvo', () => {
  assert.match(garden, /const compareFrom=priorProgress!=null&&priorProgress!==\(state\.garden_progress\|\|0\)\?priorProgress:0/)
  assert.match(garden, /const compareLabel=compareFrom!==0\?'Comparar crescimento com a última visita':'Comparar crescimento desde o início'/)
  assert.match(garden, /from:compareFrom,to:state\.garden_progress\|\|0/)
  assert.match(garden, /Comparar crescimento desde o início/)
})
