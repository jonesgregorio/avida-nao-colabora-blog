import { supabase } from './supabase'

// ─── Camada central de IA para geração de conteúdo ───────────────────────────
// Providers com failover: Pollinations (grátis, sem chave) + Gemini + Groq.
// O provider ativo é persistido em ai_settings (migration 048) e pode ser
// trocado pelo botão "Corrigir" na Saúde do Sistema. Se o ativo falhar, o
// generateWithFailover cai automaticamente para o próximo disponível.

// Aviso obrigatório de responsabilidade (append automático quando relevante)
export const DISCLAIMER =
  'Este conteúdo é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

// Regras de linguagem obrigatórias injetadas em todo prompt
const LANGUAGE_RULES = `
Regras de linguagem obrigatórias:
- Escreva em português brasileiro, tom ${''/* será substituído por parâmetro */}acolhedor e humano
- Não prometa cura, não dê diagnóstico, não substitua profissional de saúde
- Não afirme que o leitor tem transtorno ou condição clínica
- Não use linguagem alarmista ou frases que romantizem sofrimento
- Use termos como autoconhecimento, organização emocional, apoio, reflexão, cuidado possível
- Nunca use markdown em excesso; prefira texto corrido e legível
`.trim()

export type AITone =
  | 'acolhedor'
  | 'simples'
  | 'leve'
  | 'educativo'
  | 'motivacional'
  | 'profissional'
  | 'emocional'
  | 'direto'
  | 'humor leve'

export type AISize = 'curto' | 'médio' | 'longo'

const SIZE_WORDS: Record<AISize, string> = {
  curto: '80 a 150 palavras',
  médio: '200 a 350 palavras',
  longo: '500 a 800 palavras',
}

export interface AICallOptions {
  tone?: AITone
  size?: AISize
  extras?: string
}

// ─── Providers de IA + failover ──────────────────────────────────────────────
// Prioridade: tenta o provider ATIVO; se falhar (limite/erro), cai para o
// próximo disponível automaticamente. O admin também pode trocar manualmente
// pelo botão "Corrigir" na Saúde do Sistema.

export type AIProvider = 'pollinations' | 'gemini' | 'groq'

export const PROVIDER_ORDER: AIProvider[] = ['pollinations', 'gemini', 'groq']

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  pollinations: 'Pollinations (grátis)',
  gemini: 'Google Gemini',
  groq: 'Groq (Llama)',
}

const AI_PROVIDER_KEY = 'avida_ai_provider'

// As chaves de IA vivem SÓ no servidor (Edge Function generate-content). O
// cliente não conhece chave nenhuma; assume o provider disponível e o servidor
// faz o failover / devolve erro claro se faltar chave.
export function providerConfigured(p: AIProvider): boolean {
  return PROVIDER_ORDER.includes(p)
}

export function availableProviders(): AIProvider[] {
  return PROVIDER_ORDER.filter(providerConfigured)
}

let activeProviderCache: AIProvider | null = null

export function getActiveProvider(): AIProvider {
  if (activeProviderCache) return activeProviderCache
  try {
    const saved = localStorage.getItem(AI_PROVIDER_KEY) as AIProvider | null
    if (saved && PROVIDER_ORDER.includes(saved)) { activeProviderCache = saved; return saved }
  } catch { /* noop */ }
  activeProviderCache = 'pollinations'
  return 'pollinations'
}

export function setActiveProviderLocal(p: AIProvider): void {
  activeProviderCache = p
  try { localStorage.setItem(AI_PROVIDER_KEY, p) } catch { /* noop */ }
}

// Geração via Edge Function segura (chaves só no servidor). Envia o provider
// ativo como preferência; o servidor tenta ele primeiro e faz failover para os
// demais. Se um provider de fallback responder, ele é promovido a ativo.
export async function generateWithFailover(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: { prompt, provider: getActiveProvider() },
  })
  const out = data as { text?: string; provider?: AIProvider; error?: string } | null
  if (error) throw new Error(out?.error || error.message || 'Falha ao gerar com IA')
  if (!out?.text || !out.text.trim()) throw new Error(out?.error || 'IA indisponível ou resposta vazia')
  if (out.provider && out.provider !== getActiveProvider()) setActiveProviderLocal(out.provider)
  return out.text.trim()
}

// Testa um provider específico (health check), sem failover — via servidor.
export async function testProvider(p: AIProvider): Promise<{ ok: boolean; error?: string; ms: number }> {
  const t0 = Date.now()
  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { prompt: 'Responda apenas com o texto: OK', provider: p, test: true, contentType: 'health_check' },
    })
    const out = data as { text?: string; error?: string } | null
    if (error) return { ok: false, error: out?.error || error.message, ms: Date.now() - t0 }
    return { ok: !!out?.text && !!out.text.trim(), error: out?.text ? undefined : out?.error, ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }
  }
}

// Sincroniza o provider ativo a partir do banco (ai_settings).
export async function loadActiveProviderFromDB(): Promise<AIProvider> {
  try {
    const { data } = await supabase.from('ai_settings').select('active_provider').eq('id', 1).maybeSingle()
    const p = (data as { active_provider?: string } | null)?.active_provider as AIProvider | undefined
    if (p && PROVIDER_ORDER.includes(p)) { setActiveProviderLocal(p); return p }
  } catch { /* noop */ }
  return getActiveProvider()
}

// Persiste o provider ativo (admin) via RPC + cache local.
export async function persistActiveProvider(p: AIProvider): Promise<void> {
  setActiveProviderLocal(p)
  try { await supabase.rpc('admin_set_ai_provider', { p_provider: p }) } catch { /* noop */ }
}

// ─── Chamada base (monta o prompt e usa o failover) ──────────────────────────

export async function callAI(prompt: string, options: AICallOptions = {}): Promise<string> {
  const { tone = 'acolhedor', size = 'médio', extras = '' } = options

  const fullPrompt = `${prompt}

Tom de voz: ${tone}.
Tamanho: ${SIZE_WORDS[size]}.
${extras ? `Instruções extras: ${extras}` : ''}

${LANGUAGE_RULES.replace('${' + "''/* será substituído por parâmetro */" + '}', tone)}

Retorne APENAS o texto final solicitado, sem comentários adicionais.`.trim()

  return generateWithFailover(fullPrompt)
}

// ─── Funções específicas por tipo de conteúdo ────────────────────────────────

export async function generateArticleDraft(
  title: string,
  category: string,
  opts: AICallOptions = {}
): Promise<string> {
  return callAI(
    `Escreva um artigo completo de blog sobre saúde emocional com o título: "${title}".
Categoria: ${category || 'saúde emocional'}.
Estrutura obrigatória:
1. Introdução acolhedora (2 parágrafos)
2. Explicação simples do tema
3. Exemplos da vida real (sem nomes, mantendo privacidade)
4. Reflexão guiada
5. Exercício prático simples
6. Pergunta para o diário (1 pergunta)
7. CTA para o diário ou caixa de cuidado
8. Aviso de responsabilidade (1 linha ao final)`,
    { size: 'longo', ...opts }
  )
}

export async function generateArticleTitle(theme: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Gere 5 opções de título para um artigo de blog sobre saúde emocional com o tema: "${theme}".
Os títulos devem ser acolhedores, simples, sem clickbait exagerado e sem prometer cura.
Formate como uma lista numerada simples.`,
    { size: 'curto', ...opts }
  )
}

export async function generateArticleSummary(title: string, content: string, opts: AICallOptions = {}): Promise<string> {
  const preview = content.slice(0, 500)
  return callAI(
    `Escreva um resumo de 2 a 3 frases para este artigo de blog:
Título: "${title}"
Trecho: "${preview}"
O resumo será exibido na listagem do site. Deve ser direto e convidativo.`,
    { size: 'curto', ...opts }
  )
}

export async function generateSEO(title: string, content: string, opts: AICallOptions = {}): Promise<string> {
  const preview = content.slice(0, 800)
  return callAI(
    `Gere metadados SEO para este artigo:
Título: "${title}"
Trecho: "${preview}"

Retorne EXATAMENTE neste formato (sem nada mais):
META TITLE: [máximo 60 caracteres]
META DESCRIPTION: [máximo 155 caracteres]
SLUG: [slug-em-kebab-case]
KEYWORDS: [palavra1, palavra2, palavra3, palavra4, palavra5]
ALT IMAGE: [descrição da imagem de capa]`,
    { size: 'curto', ...opts }
  )
}

export async function generateDiaryQuestion(title: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Gere 3 opções de pergunta reflexiva para o diário pessoal do usuário, relacionada ao tema do artigo: "${title}".
As perguntas devem convidar à reflexão pessoal, sem julgamento.
Formate como lista numerada simples.`,
    { size: 'curto', ...opts }
  )
}

export async function generateCTA(title: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Escreva 3 opções de CTA (chamada para ação) para o final de um artigo sobre: "${title}".
O CTA deve convidar o usuário a escrever no diário, acessar a caixa de cuidado ou explorar mais conteúdo.
Seja gentil, nunca pressione. Formate como lista numerada.`,
    { size: 'curto', ...opts }
  )
}

export async function generateQuestionnaireDraft(
  topic: string,
  type: string,
): Promise<string> {
  const prompt = `Crie um questionário de autoconhecimento emocional em português brasileiro sobre: "${topic}". Tipo: ${type}.
RETORNE APENAS O JSON ABAIXO. SEM texto antes, SEM texto depois, SEM blocos de código markdown.
{"title":"Título do questionário","short_description":"Descrição curta (1 frase)","intro_text":"Texto de boas-vindas acolhedor (2 frases)","completion_text":"Frase de encorajamento ao concluir","estimated_time":5,"questions":[{"text":"Texto da pergunta","type":"single_choice","options":[{"text":"Opção 1","score":1},{"text":"Opção 2","score":2},{"text":"Opção 3","score":3}]}],"results":[{"min":0,"max":5,"label":"Nível leve","description":"Descrição acolhedora","color":"green"},{"min":6,"max":10,"label":"Nível moderado","description":"Descrição acolhedora","color":"yellow"},{"min":11,"max":15,"label":"Nível intenso","description":"Sem diagnóstico clínico","color":"red"}]}
Gere exatamente 5 perguntas com 3 opções cada, pontuação de 1 a 3. Não use linguagem clínica. Responda SOMENTE com JSON válido.`

  return generateWithFailover(prompt)
}

export async function generateTrailDraft(title: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Crie uma trilha de autoconhecimento e bem-estar emocional com o tema: "${title}".
Retorne no formato:
NOME DA TRILHA: [nome]
DESCRIÇÃO: [2 a 3 frases descrevendo o que o usuário vai explorar]
OBJETIVO: [o que o usuário vai ganhar ao completar]
DURAÇÃO SUGERIDA: [ex: 2 semanas]
ETAPAS:
1. [nome da etapa] — [descrição curta]
2. [nome da etapa] — [descrição curta]
3. [nome da etapa] — [descrição curta]
4. [nome da etapa] — [descrição curta]
5. [nome da etapa] — [descrição curta]
EXERCÍCIO FINAL: [sugestão de prática ao concluir]
PERGUNTA PARA DIÁRIO: [1 pergunta reflexiva]`,
    { size: 'médio', ...opts }
  )
}

export async function generateNotification(
  type: string,
  context: string,
  opts: AICallOptions = {}
): Promise<string> {
  return callAI(
    `Escreva uma notificação in-app para usuários de um aplicativo de saúde emocional.
Tipo: ${type}.
Contexto: ${context}.
Retorne EXATAMENTE neste formato:
TÍTULO: [máximo 60 caracteres, sem ponto final]
MENSAGEM: [máximo 120 caracteres, acolhedora e clara]
CTA: [texto do botão, máximo 3 palavras]`,
    { size: 'curto', tone: 'simples', ...opts }
  )
}

export async function generateSupportTemplate(topic: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Escreva um template de resposta de suporte ao cliente para um aplicativo de saúde emocional.
Assunto: "${topic}".
O template deve:
- Ser acolhedor e humano, nunca robótico
- Responder à dúvida de forma clara
- Oferecer próximos passos quando relevante
- Ter uma despedida gentil
- Incluir [NOME_DO_USUÁRIO] onde deve ser personalizado
Escreva o template completo pronto para uso.`,
    { size: 'médio', ...opts }
  )
}

export async function generateSocialProofText(type: 'testimonial' | 'metric' | 'institutional', opts: AICallOptions = {}): Promise<string> {
  const prompts = {
    testimonial: `Escreva um depoimento demonstrativo (fictício, apenas para exemplo visual) de um usuário satisfeito com um aplicativo de bem-estar emocional. Deve ser genuíno, específico e sem prometer resultados clínicos. Máximo 3 frases. Marque claramente como "Depoimento demonstrativo".`,
    metric: `Escreva 3 frases institucionais sobre o impacto de um aplicativo de apoio emocional, sem usar números específicos falsos. Ex: "Centenas de pessoas já registraram seus primeiros passos aqui." Seja honesto e acolhedor.`,
    institutional: `Escreva um texto institucional curto (2 a 3 frases) sobre a missão de um aplicativo de saúde emocional. Foque em apoio, autoconhecimento e organização emocional, sem prometer cura ou tratamento.`,
  }
  return callAI(prompts[type], { size: 'curto', ...opts })
}

export async function generatePlanDescription(planName: string, benefits: string[], opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Escreva uma descrição curta e atrativa para o plano "${planName}" de um app de bem-estar emocional.
Benefícios incluídos: ${benefits.join(', ')}.
A descrição deve ter 1 frase que resume o valor do plano. Seja direto e acolhedor.`,
    { size: 'curto', ...opts }
  )
}

export async function generateProfessionalCommentDraft(
  topics: string,
  opts: AICallOptions = {}
): Promise<string> {
  return callAI(
    `Crie um rascunho de comentário profissional mensal para um usuário de aplicativo de bem-estar emocional.
Tópicos a abordar: "${topics}".
O comentário deve:
- Ser acolhedor e encorajador
- Reconhecer o esforço do usuário
- Oferecer uma reflexão ou sugestão prática
- NÃO diagnosticar, NÃO dar prescrição, NÃO substituir consulta clínica
- Ter 3 a 5 frases no máximo
Este é um rascunho para revisão do profissional antes de enviar.`,
    { size: 'curto', tone: 'profissional', ...opts }
  )
}

export async function improveText(text: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Melhore o texto abaixo mantendo o mesmo sentido e intenção, mas tornando-o mais claro, fluido e acolhedor:

"${text}"

Retorne apenas o texto melhorado, sem comentários.`,
    { size: 'médio', ...opts }
  )
}

export async function rewriteText(text: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Reescreva o texto abaixo com tom mais acolhedor e linguagem mais simples, sem mudar o significado:

"${text}"

Retorne apenas o texto reescrito, sem comentários.`,
    { tone: 'acolhedor', ...opts }
  )
}

export async function summarizeText(text: string, opts: AICallOptions = {}): Promise<string> {
  return callAI(
    `Faça um resumo claro e conciso do texto abaixo em 2 a 3 frases:

"${text.slice(0, 2000)}"

Retorne apenas o resumo, sem comentários.`,
    { size: 'curto', ...opts }
  )
}

export async function generateScheduledContent(
  type: string,
  title: string,
  opts: AICallOptions = {}
): Promise<string> {
  return callAI(
    `Crie o conteúdo de um item programado do tipo "${type}" para um app de bem-estar emocional.
Tema/título: "${title}".
Escreva o conteúdo completo pronto para ser entregue ao usuário, de forma acolhedora e prática.`,
    { size: 'médio', ...opts }
  )
}

export interface UserProfileData {
  plan: string
  planLabel: string
  memberSince: string
  diaryCount: number
  questionnaireCount: number
  savedCount: number
  ticketCount: number
  guidanceCount: number
  guidancePending: number
  sessionsCount: number
  commentsCount: number
  reportsCount: number
  topTags: string[]
  avgMood?: number
  recentActivity: string[]
  adminTags?: string[]
}

export async function generateUserProfileSummary(data: UserProfileData): Promise<string> {
  const prompt = `Você é um assistente administrativo do projeto A Vida Não Colabora.
Sua tarefa é resumir dados de uso de um usuário para ajudar o admin a entender melhor como ele utiliza a plataforma.

REGRAS OBRIGATÓRIAS:
- Não faça diagnóstico
- Não diga que o usuário tem transtorno ou condição clínica
- Não use linguagem clínica afirmativa
- Não prometa cura
- Use linguagem cuidadosa, neutra e baseada em registros
- Use expressões como "o usuário registrou", "aparece com frequência", "pode ser útil sugerir", "sem caráter clínico"

DADOS DO USUÁRIO (agregados, sem identificação pessoal):
- Plano: ${data.planLabel}
- Membro desde: ${data.memberSince}
- Registros no diário: ${data.diaryCount}
- Questionários respondidos: ${data.questionnaireCount}
- Itens salvos na Caixa de Cuidado: ${data.savedCount}
- Tickets de suporte: ${data.ticketCount}
- Orientações enviadas: ${data.guidanceCount} (${data.guidancePending} aguardando resposta)
- Sessões realizadas (legado): ${data.sessionsCount}
- Comentários profissionais recebidos: ${data.commentsCount}
- Relatórios gerados: ${data.reportsCount}
${data.topTags.length > 0 ? `- Marcadores mais frequentes: ${data.topTags.join(', ')}` : ''}
${data.avgMood ? `- Humor médio registrado: ${data.avgMood.toFixed(1)}/5` : ''}
${data.recentActivity.length > 0 ? `- Atividade recente: ${data.recentActivity.join('; ')}` : ''}
${data.adminTags && data.adminTags.length > 0 ? `- Tags administrativas: ${data.adminTags.join(', ')}` : ''}

Organize o resumo em:
1. Visão geral (1-2 frases)
2. Uso da plataforma (bullet points)
3. Temas mais recorrentes (se houver marcadores)
4. Pontos de atenção (baseado no uso)
5. Sugestões administrativas (próximas ações possíveis)

Escreva em português brasileiro, de forma clara e objetiva. Este resumo é apenas para uso administrativo interno.`

  return callAI(prompt, { tone: 'profissional', size: 'médio' })
}
