// Guarda a intenção do visitante quando ele tenta uma ação protegida sem estar
// logado. Depois do login, App consome isso e leva de volta à ação original,
// preservando o contexto (ex.: pergunta de um artigo para responder no diário).

const KEY = 'avida_pending_action'

export interface DiaryPromptContext {
  prompt: string
  articleTitle: string
  articleSlug: string
  category: string
}

export interface PendingAction {
  view: string
  diaryContext?: DiaryPromptContext
}

export function setPendingAction(action: PendingAction) {
  try { sessionStorage.setItem(KEY, JSON.stringify(action)) } catch { /* noop */ }
}

export function getPendingAction(): PendingAction | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingAction) : null
  } catch {
    return null
  }
}

export function clearPendingAction() {
  try { sessionStorage.removeItem(KEY) } catch { /* noop */ }
}
