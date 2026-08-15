// ─────────────────────────────────────────────────────────────────────────────
// Cores das tags do diário, por categoria. A cor é sempre DERIVADA aqui —
// nunca salva no banco (só a tag/categoria em si), pra manter consistência
// visual mesmo que a paleta mude no futuro.
//
// Estilo é um objeto (não classes Tailwind dinâmicas): o JIT do Tailwind só
// gera CSS para classes literais encontradas no código-fonte — uma classe
// tipo `bg-[${hex}]` construída em runtime nunca seria compilada.
// ─────────────────────────────────────────────────────────────────────────────

export type TagCategory =
  | 'anxiety' | 'sadness' | 'anger' | 'tiredness' | 'positive'
  | 'context' | 'need' | 'care_action' | 'advanced' | 'default'

export interface TagStyle {
  background: string
  color: string
  border: string
  selectedBackground: string
  selectedColor: string
  selectedBorder: string
}

const STYLES: Record<TagCategory, TagStyle> = {
  anxiety:     { background: '#FEF3C7', color: '#92400E', border: '#F59E0B', selectedBackground: '#F59E0B', selectedColor: '#ffffff', selectedBorder: '#F59E0B' },
  sadness:     { background: '#DBEAFE', color: '#1E3A8A', border: '#60A5FA', selectedBackground: '#60A5FA', selectedColor: '#ffffff', selectedBorder: '#60A5FA' },
  anger:       { background: '#FEE2E2', color: '#991B1B', border: '#F87171', selectedBackground: '#F87171', selectedColor: '#ffffff', selectedBorder: '#F87171' },
  tiredness:   { background: '#EDE9FE', color: '#5B21B6', border: '#A78BFA', selectedBackground: '#A78BFA', selectedColor: '#ffffff', selectedBorder: '#A78BFA' },
  positive:    { background: '#D1FAE5', color: '#065F46', border: '#34D399', selectedBackground: '#34D399', selectedColor: '#ffffff', selectedBorder: '#34D399' },
  context:     { background: '#FEF3C7', color: '#78350F', border: '#D6A85A', selectedBackground: '#D6A85A', selectedColor: '#ffffff', selectedBorder: '#D6A85A' },
  need:        { background: '#CCFBF1', color: '#134E4A', border: '#2DD4BF', selectedBackground: '#2DD4BF', selectedColor: '#ffffff', selectedBorder: '#2DD4BF' },
  care_action: { background: '#CFFAFE', color: '#155E75', border: '#22D3EE', selectedBackground: '#22D3EE', selectedColor: '#ffffff', selectedBorder: '#22D3EE' },
  advanced:    { background: '#F3E8FF', color: '#6B21A8', border: '#C084FC', selectedBackground: '#C084FC', selectedColor: '#ffffff', selectedBorder: '#C084FC' },
  default:     { background: '#F1F0EA', color: '#57534E', border: '#D6D3C9', selectedBackground: '#8a8579', selectedColor: '#ffffff', selectedBorder: '#8a8579' },
}

// Palavras-chave → categoria, para as tags EMOCIONAIS (as demais categorias
// de tag — contexto, necessidade, cuidado — já nascem com categoria fixa,
// não precisam de lookup por palavra).
const EMOTION_CATEGORY: Record<string, TagCategory> = {
  ansiedade: 'anxiety', preocupação: 'anxiety', medo: 'anxiety', insegurança: 'anxiety', tensão: 'anxiety', inquietação: 'anxiety',
  tristeza: 'sadness', desânimo: 'sadness', solidão: 'sadness', culpa: 'sadness', vazio: 'sadness', saudade: 'sadness',
  raiva: 'anger', irritação: 'anger', frustração: 'anger', impaciência: 'anger', injustiça: 'anger', explosão: 'anger',
  cansaço: 'tiredness', sobrecarga: 'tiredness', 'sem energia': 'tiredness', confusão: 'tiredness', esgotamento: 'tiredness', pressão: 'tiredness',
  calma: 'positive', esperança: 'positive', alívio: 'positive', gratidão: 'positive', alegria: 'positive', leveza: 'positive', orgulho: 'positive',
}

/** Categoria de uma tag emocional pela palavra (default se não reconhecida). */
export function getTagCategory(tag: string): TagCategory {
  return EMOTION_CATEGORY[tag.trim().toLowerCase()] ?? 'default'
}

export function getTagStyleByCategory(category: TagCategory): TagStyle {
  return STYLES[category] ?? STYLES.default
}

/** Estilo de uma tag: usa a categoria informada, ou deduz pela palavra (emocional). */
export function getDiaryTagStyle(tag: string, category?: TagCategory): TagStyle {
  return getTagStyleByCategory(category ?? getTagCategory(tag))
}
