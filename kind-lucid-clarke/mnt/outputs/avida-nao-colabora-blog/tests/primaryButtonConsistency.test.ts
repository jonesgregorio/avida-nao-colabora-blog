import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// §19 (Design System): a área do usuário (fora do Admin, que tem paleta
// própria) padroniza CTAs primários em bg-forest-900/hover:bg-forest-800.
// 4 botões primários usavam emerald-600/emerald-700 — um segundo estilo
// coexistindo sem motivo, encontrado numa auditoria de consistência visual.
// Nota: a bolha de chat do próprio usuário em SupportTicketDetail.tsx
// continua emerald de propósito (cor de identidade da mensagem, não CTA) —
// só o botão de enviar (hover:bg-emerald-700) estava fora do padrão.
test('CTAs primários usam bg-forest-900/hover:bg-forest-800, não mais o segundo estilo emerald-600', () => {
  assert.doesNotMatch(read('src/components/MyEvolutionPage.tsx'), /bg-emerald-600 text-white text-sm px-5 py-2 rounded-lg/)
  assert.doesNotMatch(read('src/components/ForceChangePassword.tsx'), /bg-emerald-600/)
  assert.doesNotMatch(read('src/components/SupportTicketDetail.tsx'), /hover:bg-emerald-700 disabled:opacity-40/)
})
