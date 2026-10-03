import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const globalCompletion = readFileSync(new URL('../src/lib/globalGardenCompletion.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('observador global é inicializado junto com o site', () => {
  assert.match(main, /import \{ initGlobalGardenCompletion \} from '\.\/lib\/globalGardenCompletion'/)
  assert.match(main, /initGlobalGardenCompletion\(\)/)
})

test('conclusão do jardim é verificada fora da página Meu Jardim', () => {
  assert.match(globalCompletion, /supabase\.rpc\('get_my_garden_state'\)/)
  assert.match(globalCompletion, /CHECK_INTERVAL_MS = 20_000/)
  assert.match(globalCompletion, /window\.addEventListener\('focus', recheck\)/)
  assert.match(globalCompletion, /document\.addEventListener\('visibilitychange'/)
  assert.doesNotMatch(globalCompletion, /window\.location\.pathname === '\/meu-jardim'.*return[\s\S]*checkGardenCompletion/)
})

test('virada é exibida uma única vez e não duplica a celebração local do Meu Jardim', () => {
  assert.match(globalCompletion, /GLOBAL_SEEN_CYCLE_PREFIX/)
  assert.match(globalCompletion, /LAST_GARDEN_CYCLE_KEY_PREFIX/)
  assert.match(globalCompletion, /previousPageCycle != null && previousPageCycle >= currentCycle/)
  assert.match(globalCompletion, /writeNumber\(pageCycleKey, currentCycle\)/)
  assert.match(globalCompletion, /writeNumber\(pageIndexKey, currentIndex\)/)
})

test('modal global usa a mensagem aprovada e oferece os dois destinos', () => {
  assert.match(globalCompletion, /Seu jardim floresceu por completo\./)
  assert.match(globalCompletion, /Os pequenos momentos de cuidado que você registrou ao longo do caminho transformaram este espaço\./)
  assert.match(globalCompletion, /Este jardim agora fica guardado na sua história — e um novo começa a crescer no seu ritmo\./)
  assert.match(globalCompletion, /Que bom ter você por aqui\. 🌿/)
  assert.match(globalCompletion, /Ver meu jardim concluído/)
  assert.match(globalCompletion, /Conhecer o novo jardim/)
  assert.doesNotMatch(globalCompletion, /Você chegou aos 100%/)
})

test('ação de ver o concluído abre Meu Jardim e rola até Memórias', () => {
  assert.match(globalCompletion, /SCROLL_MEMORIES_FLAG/)
  assert.match(globalCompletion, /window\.location\.assign\('\/meu-jardim'\)/)
  assert.match(globalCompletion, /node\.textContent\?\.includes\('Memórias do Jardim'\)/)
  assert.match(globalCompletion, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/)
})
