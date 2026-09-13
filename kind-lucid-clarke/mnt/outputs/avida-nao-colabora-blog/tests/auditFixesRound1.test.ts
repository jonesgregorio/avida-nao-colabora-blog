import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Componentes com cadeia de import que chega em ../lib/supabase (precisa de import.meta.env,
// só existe no Vite) — validamos via leitura do código-fonte, padrão já usado no resto da suíte.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const report = read('src/components/MyReportPageContent.tsx')
const adminUsers = read('src/components/admin/AdminUsersImpl.tsx')
const analyticsSettings = read('src/components/admin/AdminAnalyticsSettings.tsx')
const redirects = read('src/components/admin/AdminRedirects.tsx')
const articles = read('src/components/admin/AdminArticles.tsx')

// Item 1 — auditoria: exportar PDF do relatório falhava em silêncio (catch vazio, sem
// feedback nenhum ao usuário).
test('exportar PDF avisa o usuário quando falha, em vez de engolir o erro em silêncio', () => {
  assert.match(report, /const \[pdfError, setPdfError\] = useState\(false\)/)
  assert.doesNotMatch(report, /catch \{ \/\* noop \*\/ \}/)
  assert.match(report, /console\.error\('exportReportPdf falhou:', error\)/)
  assert.match(report, /setPdfError\(true\)/)
  assert.match(report, /Não foi possível gerar o PDF agora\. Tente novamente em instantes\./)
  // o toast aparece nos dois layouts (Plus e Essencial-only) do componente
  const toastUses = report.match(/\{pdfErrorToast\}/g) ?? []
  assert.equal(toastUses.length, 2, 'esperava o toast de erro presente nos dois retornos do componente')
})

// Item 2 — auditoria: trocar plano manualmente no Admin gravava profiles.plan (checado) e
// mais 3 tabelas relacionadas SEM checar erro — o admin via "sucesso" mesmo com gravação
// parcial (histórico de plano dessincronizado).
test('ajuste manual de plano checa erro nas 3 gravações secundárias e avisa o admin se alguma falhar', () => {
  assert.match(adminUsers, /const subRes = await supabase\.from\('user_subscriptions'\)\.upsert/)
  assert.match(adminUsers, /if \(subRes\.error\) secondaryErrors\.push\('assinatura interna \(user_subscriptions\): ' \+ subRes\.error\.message\)/)
  assert.match(adminUsers, /const changeHistRes = await supabase\.from\('plan_change_history'\)\.insert/)
  assert.match(adminUsers, /if \(changeHistRes\.error\) secondaryErrors\.push/)
  assert.match(adminUsers, /const planHistRes = await supabase\.from\('user_plan_history'\)\.insert/)
  assert.match(adminUsers, /if \(planHistRes\.error\) secondaryErrors\.push/)
  assert.match(adminUsers, /if \(secondaryErrors\.length > 0\) \{/)
  assert.match(adminUsers, /houve falha ao gravar: \$\{secondaryErrors\.join\('; '\)\}/)
  // só mostra "sucesso limpo" quando as 3 gravações realmente deram certo
  assert.match(adminUsers, /\} else \{\s*\n\s*setAdminSubMsg\(\{ type: 'ok', text: `Plano ajustado para/)
})

// Item 3 — auditoria: dois deletes no Admin disparavam sem nenhuma confirmação.
test('excluir evento personalizado de Analytics pede confirmação e mostra erro se falhar', () => {
  assert.match(analyticsSettings, /async function delCE\(c: CustomEvent\) \{/)
  assert.match(analyticsSettings, /if \(!window\.confirm\(`Excluir o evento personalizado "\$\{c\.name\}"\? Essa ação não pode ser desfeita\.`\)\) return/)
  assert.match(analyticsSettings, /if \(error\) \{ window\.alert\('Erro ao excluir: ' \+ error\.message\); return \}/)
})

test('excluir redirecionamento pede confirmação e mostra erro se falhar', () => {
  assert.match(redirects, /async function del\(r: Redirect\) \{/)
  assert.match(redirects, /if \(!window\.confirm\(`Excluir o redirecionamento de "\$\{r\.from_path\}" para "\$\{r\.to_path\}"\? Essa ação não pode ser desfeita\.`\)\) return/)
  assert.match(redirects, /if \(error\) \{ window\.alert\('Erro ao excluir: ' \+ error\.message\); return \}/)
})

// Item 4 — auditoria: tabela de Artigos usava overflow-hidden no wrapper, cortando colunas
// em telas estreitas em vez de permitir rolagem lateral.
test('tabela de Artigos rola horizontalmente no mobile em vez de cortar colunas', () => {
  assert.match(articles, /<div className="bg-white rounded-xl border border-line overflow-hidden">\s*\n\s*<div className="overflow-x-auto">\s*\n\s*<table className="w-full text-sm min-w-\[720px\]">/)
})
