import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// §20 (acessibilidade): nenhum modal do app fechava com Esc nem movia o foco
// pra dentro do diálogo ao abrir — o foco ficava preso atrás do overlay.
test('useModalA11y liga Esc e move o foco pro diálogo ao montar', () => {
  const hook = read('src/hooks/useModalA11y.ts')
  assert.match(hook, /e\.key === 'Escape'/)
  assert.match(hook, /dialogRef\.current\?\.focus\(\)/)
})

test('modais reais usam useModalA11y ou o mesmo padrão (role/aria-modal/foco/Esc)', () => {
  const reportModal = read('src/components/MyReportPageContent.tsx')
  assert.match(reportModal, /useModalA11y\(onClose\)/)
  assert.match(reportModal, /role="dialog" aria-modal="true"/)

  // Troca forçada de senha não tem Esc de propósito (não há como cancelar sem
  // completar a troca) — mas precisa ter role/aria-modal/foco mesmo assim.
  const forceChange = read('src/components/ForceChangePassword.tsx')
  assert.match(forceChange, /role="dialog" aria-modal="true"/)
  assert.match(forceChange, /dialogRef\.current\?\.focus\(\)/)

  // O modal de exclusão de conta vive dentro do mesmo componente (não
  // desmonta/monta um filho) — o efeito de Esc/foco depende de showDelete.
  const privacy = read('src/components/AccountPrivacyControls.tsx')
  assert.match(privacy, /useEffect\(\(\) => \{\s*\n\s*if \(!showDelete \|\| isAdmin\) return/)
  assert.match(privacy, /e\.key === 'Escape' && !deleting/)
})

// §20: labels de formulário precisam de associação programática (htmlFor+id
// ou aria-label), não só placeholder — leitores de tela não anunciam
// placeholder de forma confiável quando o campo está vazio e ganha foco.
test('SupportPage associa label e campo via htmlFor/id (não só placeholder)', () => {
  const support = read('src/components/SupportPage.tsx')
  assert.match(support, /htmlFor="support-subject"/)
  assert.match(support, /id="support-subject"/)
  assert.match(support, /htmlFor="support-message"/)
  assert.match(support, /id="support-message"/)
})

// §20: os sliders já mostravam um rótulo textual da escala (ex. "razoável"),
// mas só visualmente — o leitor de tela lia só o número bruto do range.
test('Sliders do Diário expõem o valor com significado via aria-valuetext', () => {
  // SliderField/QuickScaleField saíram de DiaryExperience.tsx pra
  // DiaryFormFields.tsx numa componentização posterior (Parte 17) — mesmo
  // comportamento, arquivo diferente.
  const fields = read('src/components/DiaryFormFields.tsx')
  const sliderFn = fields.match(/export function SliderField\([\s\S]*?\n\}/)?.[0] ?? ''
  const quickScaleFn = fields.match(/export function QuickScaleField\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(sliderFn, /aria-valuetext=/)
  assert.match(quickScaleFn, /aria-valuetext=\{`\$\{label\}: \$\{currentLabel\}`\}/)
})
