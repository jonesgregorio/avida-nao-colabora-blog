import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('landing /ig tem proposta e CTA direto para cadastro', () => {
  const landing = read('src/components/InstagramLanding.tsx')
  assert.match(landing, /Como você está hoje\?/)
  assert.match(landing, /onNavigate\('auth-signup'\)/)
  assert.match(landing, /ig_landing_view/)
  assert.match(landing, /signup_click/)
})

test('prévia interativa da landing reutiliza o check-in real sem enviar respostas à análise', () => {
  const landing = read('src/components/InstagramLanding.tsx')
  const home = read('src/components/LoggedHome.tsx')
  const options = read('src/components/user/checkinOptions.ts')

  assert.match(landing, /E aí, a vida colaborou hoje\?/)
  assert.match(landing, /CHECKIN_SCORES\.map/)
  assert.match(landing, /FEATURED_CHECKIN_MOODS\.map/)
  assert.match(landing, /Registrar meu primeiro check-in grátis/)
  assert.match(landing, /Sua prévia não foi salva/)
  assert.match(landing, /ig_checkin_start/)
  assert.match(landing, /ig_checkin_complete/)
  assert.match(home, /CHECKIN_SCORES\.map/)
  assert.match(home, /FEATURED_CHECKIN_MOODS\.map/)
  assert.match(options, /Nem um pouco/)
  assert.doesNotMatch(landing, /metadata:\s*\{[^}]*previewScore/)
  assert.doesNotMatch(landing, /metadata:\s*\{[^}]*previewFeelings/)
})

test('check-in concluído mantém somente intenção temporária para retomar o Diário após autenticação', () => {
  const landing = read('src/components/InstagramLanding.tsx')
  const pending = read('src/lib/pendingAction.ts')
  const app = read('src/App.tsx')

  assert.match(landing, /setPendingAction\(\{ view: 'diary'/)
  assert.match(landing, /if \(previewComplete\)/)
  assert.match(landing, /DIARY_MOOD_ALIAS/)
  assert.match(pending, /sessionStorage\.setItem/)
  assert.match(app, /if \(pending\.mood\) setDiaryMood\(pending\.mood\)/)
  assert.match(app, /clearPendingAction\(\)/)
  assert.doesNotMatch(landing, /metadata:\s*\{[^}]*diaryMood/)
  assert.doesNotMatch(landing, /metadata:\s*\{[^}]*selectedMood/)
})

test('cadastro reduz atrito e mede as etapas principais', () => {
  const auth = read('src/components/Auth.tsx')
  assert.doesNotMatch(auth, /auth-name/)
  assert.doesNotMatch(auth, /auth-confirm-password/)
  for (const event of ['signup_view', 'signup_start', 'signup_submit', 'signup_success', 'signup_error', 'email_verification_required', 'email_verified']) {
    assert.match(auth, new RegExp(event))
  }
})

test('Vercel serve /ig como SPA e mantém variantes com aquisição identificada', () => {
  const config = JSON.parse(read('vercel.json')) as { redirects: Array<{ source: string; destination: string }> }
  assert.equal(config.redirects.some(({ source }) => source === '/ig'), false)
  assert.equal(config.redirects.find(({ source }) => source === '/ig-story')?.destination.startsWith('/ig?utm_source=instagram'), true)
})
