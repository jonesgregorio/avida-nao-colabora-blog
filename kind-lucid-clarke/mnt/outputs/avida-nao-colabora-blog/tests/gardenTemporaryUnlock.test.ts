import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// MyGardenPage.tsx importa ../lib/supabase (precisa de import.meta.env, só existe no Vite) —
// mesmo padrão do resto da suíte: validamos via leitura do código-fonte.
const page = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('get_my_garden_campaign() é buscada mesmo sem acesso pago (não depende de plano)', () => {
  // o efeito de campanha roda incondicionalmente (sem "if(!access)return" antes da chamada)
  const effectStart = page.indexOf("useEffect(()=>{\n    let alive=true\n    ;(async()=>{\n      const {data}=await supabase.rpc('get_my_garden_campaign')")
  assert.ok(effectStart >= 0, 'esperava um useEffect que busca a campanha sem gate de acesso antes da chamada RPC')
})

test('desbloqueio temporário só vale pra quem NÃO tem acesso pago (nunca reduz o que um assinante já tem)', () => {
  assert.match(page, /const tempUnlocked=!access&&Boolean\(campaign\?\.temporary_unlock\)/)
  assert.match(page, /const effectiveAccess=access\|\|tempUnlocked/)
})

test('paywall só aparece depois de checar se existe desbloqueio por campanha (evita flash de bloqueio pra quem seria liberado)', () => {
  assert.match(page, /if\(!effectiveAccess\)\{/)
  assert.match(page, /if\(!campaignChecked\)return/)
})

test('todas as buscas de dados do jardim passam a depender de effectiveAccess, não só do plano', () => {
  const guards = page.match(/if\(!effectiveAccess\)return/g) ?? []
  assert.ok(guards.length >= 3, `esperava pelo menos 3 guards usando effectiveAccess, achei ${guards.length}`)
  assert.doesNotMatch(page, /if\(!access\)return\s*\n\s*let alive=true/) // nenhum efeito de dados ainda trava só no "access" bruto
})

test('usuário desbloqueado por campanha vê um aviso claro de que é temporário, com CTA pra assinar', () => {
  assert.match(page, /Acesso liberado por tempo limitado/)
  assert.match(page, /Você está vendo o Meu Jardim de graça enquanto esta campanha estiver ativa/)
  assert.match(page, /\{tempUnlocked&&<div/)
  assert.match(page, /Garantir acesso permanente/)
})

test('o desbloqueio nunca é permanente: assim que a campanha deixa de bater (pausada, expirada ou fora do público), a próxima leitura já reflete isso', () => {
  // tempUnlocked é derivado do estado `campaign` a cada render, não gravado em nenhum lugar —
  // não há flag persistida tipo "usuário X foi desbloqueado", só o resultado ao vivo da RPC.
  assert.doesNotMatch(page, /localStorage\.setItem\([^)]*unlock/i)
  assert.doesNotMatch(page, /localStorage\.setItem\([^)]*tempUnlocked/i)
})
