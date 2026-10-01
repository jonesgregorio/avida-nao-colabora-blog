import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NAME_PROMPT_MAX_ASKS, NAME_PROMPT_MAX_NAME, NAME_PROMPT_RETRY_AFTER_MS, cleanName, profileHasNoName, shouldAskName } from '../src/lib/namePrompt.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('só pergunta o nome quando o perfil não tem nenhum nome', () => {
  assert.equal(profileHasNoName(null), false) // perfil ainda carregando: nunca pergunta
  assert.equal(profileHasNoName({ full_name: '', display_name: undefined, preferred_name: undefined }), true)
  assert.equal(profileHasNoName({ full_name: null, display_name: '  ', preferred_name: '' }), true)
  assert.equal(profileHasNoName({ full_name: 'Marina', display_name: undefined, preferred_name: undefined }), false)
  assert.equal(profileHasNoName({ full_name: '', display_name: 'Mari', preferred_name: undefined }), false)
  assert.equal(profileHasNoName({ full_name: '', display_name: undefined, preferred_name: 'Mari' }), false)
})

test('pergunta de novo no máximo mais duas vezes, com intervalo de dias', () => {
  const now = Date.now()
  assert.equal(shouldAskName({ count: 0, last: 0 }, now), true) // primeiro acesso
  assert.equal(shouldAskName({ count: 1, last: now - 1000 }, now), false) // dispensou agora há pouco
  assert.equal(shouldAskName({ count: 1, last: now - NAME_PROMPT_RETRY_AFTER_MS - 1 }, now), true)
  assert.equal(shouldAskName({ count: NAME_PROMPT_MAX_ASKS - 1, last: now - NAME_PROMPT_RETRY_AFTER_MS - 1 }, now), true)
  assert.equal(shouldAskName({ count: NAME_PROMPT_MAX_ASKS, last: 0 }, now), false) // desistiu de perguntar
})

test('o nome digitado é limpo: espaços, caracteres de controle e tamanho', () => {
  assert.equal(cleanName('  Maria   da   Silva  '), 'Maria da Silva')
  assert.equal(cleanName('Ana\u0000\n\tLu'), 'AnaLu')
  assert.equal(cleanName('x'.repeat(200)).length, NAME_PROMPT_MAX_NAME)
  assert.equal(cleanName('   '), '')
})

test('o aviso salva pelo RPC seguro do perfil, grava o nome nos 3 campos e não bloqueia a tela', () => {
  const prompt = read('src/components/user/NamePrompt.tsx')
  assert.match(prompt, /supabase\.rpc\('update_my_profile', \{\s+p_full_name: clean,\s+p_display_name: clean,\s+p_preferred_name: clean,\s+\}\)/)
  assert.match(prompt, /role="dialog"/)
  assert.match(prompt, /Como você gostaria de ser chamado\(a\)\?/)
  assert.match(prompt, /Agora não/)
  assert.match(prompt, /currentView !== 'profile'/) // na tela de perfil a pessoa já edita o nome
  assert.match(prompt, /!profile\?\.must_change_password/)
  // destaque no centro da tela, mas sempre dispensável: X, "Agora não", Esc e clique fora
  assert.match(prompt, /fixed inset-0 z-50 grid place-items-center/)
  assert.match(prompt, /aria-modal="true"/)
  assert.match(prompt, /e\.key !== 'Escape'/)
  assert.match(prompt, /e\.target === e\.currentTarget\) dismiss\(\)/)
  assert.match(prompt, /aria-label="Agora não"/)
})

test('o aviso aparece em toda a área logada (UserLayout) e recarrega o perfil ao salvar', () => {
  const layout = read('src/components/user/UserLayout.tsx')
  assert.match(layout, /<NamePrompt userId=\{user\.id\} profile=\{profile\} currentView=\{currentView\} onSaved=\{onProfileRefresh\} \/>/)
  const app = read('src/App.tsx')
  assert.equal((app.match(/onProfileRefresh=\{refreshProfile\}/g) ?? []).length, 2)
})
