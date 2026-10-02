const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bFazer upgrade\b/g, 'Mudar de plano'],
  [/\bFazer downgrade\b/g, 'Mudar de plano'],
  [/\bConfirmar upgrade\b/g, 'Confirmar mudança de plano'],
  [/\bConfirmar downgrade de plano\b/g, 'Confirmar mudança de plano'],
  [/\bConfirmar downgrade\b/g, 'Confirmar mudança'],
  [/\bDesfazer downgrade\b/g, 'Desfazer mudança de plano'],
  [/\bUpgrade para ([^.]+) em processamento\./g, 'Mudança para $1 em processamento.'],
  [/\bDowngrade para ([^.]+) agendado\./g, 'Mudança para $1 agendada.'],
  [/\bDowngrade agendado\b/g, 'Mudança de plano agendada'],
  [/\bDowngrade solicitado\b/g, 'Mudança de plano solicitada'],
  [/\bDowngrade efetivado\b/g, 'Mudança de plano concluída'],
  [/\bUpgrade realizado\b/g, 'Mudança de plano concluída'],
  [/\breverter o downgrade\b/gi, 'desfazer a mudança de plano'],
  [/\beste downgrade agendado\b/gi, 'esta mudança agendada'],
]

export function toPlainPlanLanguage(value: string): string {
  let output = value
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    output = output.replace(pattern, replacement)
  }

  output = output
    .replace(/\bUpgrade\b/g, 'Mudança de plano')
    .replace(/\bupgrade\b/g, 'mudança de plano')
    .replace(/\bDowngrade\b/g, 'Mudança de plano')
    .replace(/\bdowngrade\b/g, 'mudança de plano')

  return output
}

function translateElementAttributes(element: Element): void {
  for (const attribute of ['aria-label', 'title']) {
    const current = element.getAttribute(attribute)
    if (!current) continue
    const translated = toPlainPlanLanguage(current)
    if (translated !== current) element.setAttribute(attribute, translated)
  }
}

/**
 * Mantém nomes técnicos como upgrade/downgrade apenas na lógica interna.
 * Tudo que é apresentado dentro de Meu Plano usa linguagem simples para que
 * a troca de plano seja compreensível sem depender de termos em inglês.
 */
export function applyPlainPlanLanguage(root: HTMLElement): void {
  translateElementAttributes(root)
  root.querySelectorAll('*').forEach(translateElementAttributes)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const current = node.textContent ?? ''
    const translated = toPlainPlanLanguage(current)
    if (translated !== current) node.textContent = translated
    node = walker.nextNode()
  }
}
