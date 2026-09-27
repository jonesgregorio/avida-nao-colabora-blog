import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const privacy = readFileSync(new URL('../src/components/PrivacyPage.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260916165000_sync_concise_privacy_policy.sql', import.meta.url), 'utf8')

test('política pública mantém a mensagem curta de privacidade aprovada', () => {
  for (const source of [privacy, migration]) {
    assert.match(source, /administradores do A Vida Não Colabora não têm acesso ao conteúdo desses registros/i)
    assert.match(source, /somente as informações que você decidir fornecer especificamente naquela solicitação/i)
    assert.match(source, /profissional não recebe acesso ao seu Diário/i)
    assert.doesNotMatch(source, /Supabase Auth|Google Gemini|Groq|OpenAI|Resend|Vercel/)
  }
})
