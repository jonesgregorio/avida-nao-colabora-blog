import { useState } from 'react'
import {
  Sparkles, Loader2, Copy, CheckCircle, AlertCircle,
  RefreshCw, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { callAI, generateQuestionnaireDraft, type AITone, type AISize } from '../../lib/aiContent'

export type AIContentType =
  | 'article'
  | 'article_title'
  | 'article_summary'
  | 'article_seo'
  | 'article_diary_question'
  | 'article_cta'
  | 'questionnaire'
  | 'trail'
  | 'scheduled_content'
  | 'automated_content'
  | 'support_template'
  | 'notification'
  | 'seo'
  | 'social_proof'
  | 'meditation'
  | 'emotional_exercise'
  | 'self_care_plan'
  | 'professional_comment'
  | 'monthly_guidance'
  | 'plan_description'
  | 'improve'
  | 'rewrite'
  | 'summarize'
  | 'custom'

interface AIContentAssistantProps {
  contentType: AIContentType
  contextTitle?: string
  contextContent?: string
  contextCategory?: string
  defaultTheme?: string
  defaultTone?: AITone
  label?: string
  placeholder?: string
  onInsert: (result: string) => void
  onClose: () => void
}

const TONES: { value: AITone; label: string }[] = [
  { value: 'acolhedor', label: 'Acolhedor' },
  { value: 'simples', label: 'Simples' },
  { value: 'leve', label: 'Leve' },
  { value: 'educativo', label: 'Educativo' },
  { value: 'motivacional', label: 'Motivacional' },
  { value: 'profissional', label: 'Profissional' },
  { value: 'emocional', label: 'Emocional' },
  { value: 'direto', label: 'Direto' },
  { value: 'humor leve', label: 'Humor leve' },
]

const SIZES: { value: AISize; label: string }[] = [
  { value: 'curto', label: 'Curto (80–150 palavras)' },
  { value: 'médio', label: 'Médio (200–350 palavras)' },
  { value: 'longo', label: 'Longo (500–800 palavras)' },
  { value: 'extenso', label: 'Extenso (1500–3000 palavras)' },
]

const TYPE_LABELS: Record<AIContentType, string> = {
  article: 'Gerar artigo completo',
  article_title: 'Gerar opções de título',
  article_summary: 'Gerar resumo',
  article_seo: 'Gerar SEO completo',
  article_diary_question: 'Gerar pergunta para diário',
  article_cta: 'Gerar CTA',
  questionnaire: 'Gerar questionário',
  trail: 'Gerar trilha',
  scheduled_content: 'Gerar conteúdo programado',
  automated_content: 'Gerar conteúdo automático',
  support_template: 'Gerar template de suporte',
  notification: 'Gerar notificação',
  seo: 'Gerar metadados SEO',
  social_proof: 'Gerar texto de prova social',
  meditation: 'Gerar meditação em texto',
  emotional_exercise: 'Gerar exercício emocional',
  self_care_plan: 'Gerar plano de autocuidado',
  professional_comment: 'Gerar rascunho de comentário',
  monthly_guidance: 'Gerar orientação mensal',
  plan_description: 'Gerar descrição do plano',
  improve: 'Melhorar texto',
  rewrite: 'Reescrever com tom acolhedor',
  summarize: 'Gerar resumo',
  custom: 'Gerar conteúdo',
}

function buildPrompt(
  contentType: AIContentType,
  theme: string,
  extras: string,
  contextTitle?: string,
  contextContent?: string,
  contextCategory?: string
): string {
  const ctx = contextTitle ? `\nTítulo/contexto: "${contextTitle}"` : ''
  const preview = contextContent ? `\nTrecho do conteúdo: "${contextContent.slice(0, 600)}"` : ''
  const cat = contextCategory ? `\nCategoria: ${contextCategory}` : ''

  switch (contentType) {
    case 'article':
      return `Escreva um artigo APROFUNDADO e bem desenvolvido de blog sobre saúde emocional.
Tema: "${theme}"${ctx}${cat}
Estrutura: introdução acolhedora, explicação simples, exemplos da vida real, reflexão guiada, exercício prático, pergunta para diário, CTA, aviso de responsabilidade.
Cada seção com 2 a 4 parágrafos densos. Não seja raso.

FORMATAÇÃO (obrigatória, sintaxe deste blog — rica, mas natural):
- Divida em VÁRIAS seções, cada uma abrindo com um subtítulo "## " (ex.: "## Por que isso acontece").
- Use "### " para subtópicos quando fizer sentido.
- Destaque palavras-chave nos parágrafos com **negrito** e use *itálico* para nuances/ênfase leve.
- Use listas com "- " para ideias e listas numeradas "1. " para passos/sequências.
- Use "> " para a pergunta do diário e 1 ou 2 reflexões marcantes (citação).
- Separe blocos temáticos maiores com uma linha contendo apenas "---" (divisor), com moderação.
- Parágrafos normais em texto corrido, separados por uma linha em branco.
- NÃO use "#" de título nível 1 (o título já existe), nem HTML, nem tabelas.`

    case 'article_title':
      return `Sugira 5 títulos de artigo para o tema: "${theme}"${ctx}. Acolhedores, sem clickbait, sem prometer cura. Liste numerados.`

    case 'article_summary':
      return `Escreva um resumo de 2 a 3 frases para um artigo.${ctx}${preview}. O resumo será exibido na listagem do site.`

    case 'article_seo':
      return `Gere metadados SEO para um artigo.${ctx}${preview}${cat}
Retorne EXATAMENTE:
META TITLE: [máximo 60 caracteres]
META DESCRIPTION: [máximo 155 caracteres]
SLUG: [slug-kebab-case]
KEYWORDS: [palavra1, palavra2, palavra3, palavra4, palavra5]
ALT IMAGE: [descrição da imagem de capa]`

    case 'article_diary_question':
      return `Gere 3 perguntas reflexivas para o diário do usuário, relacionadas ao tema: "${theme}"${ctx}. Convide à reflexão pessoal, sem julgamento. Liste numeradas.`

    case 'article_cta':
      return `Escreva 3 opções de CTA para o final de um artigo sobre: "${theme}"${ctx}. Convide ao diário ou caixa de cuidado. Sem pressão. Liste numeradas.`

    case 'questionnaire':
      return `Crie um questionário de autoconhecimento emocional em português brasileiro.
Tema: "${theme}"${ctx}
IMPORTANTE: Retorne SOMENTE o JSON abaixo, sem texto antes nem depois, sem blocos markdown, sem explicações.
{
  "title": "Título do questionário",
  "short_description": "Uma frase descrevendo o questionário",
  "intro_text": "Texto acolhedor de boas-vindas (2 frases)",
  "completion_text": "Frase de encorajamento ao concluir",
  "estimated_time": 5,
  "questions": [
    {
      "text": "Texto da pergunta",
      "type": "single_choice",
      "options": [
        { "text": "Opção 1", "score": 1 },
        { "text": "Opção 2", "score": 2 },
        { "text": "Opção 3", "score": 3 }
      ]
    }
  ],
  "results": [
    { "min": 0, "max": 5, "label": "Nível leve", "description": "Descrição acolhedora do resultado", "color": "green" },
    { "min": 6, "max": 10, "label": "Nível moderado", "description": "Descrição acolhedora do resultado", "color": "yellow" },
    { "min": 11, "max": 15, "label": "Nível intenso", "description": "Descrição sem diagnóstico clínico", "color": "red" }
  ]
}
Gere exatamente 5 perguntas com 3 opções cada. Não use linguagem clínica nem diagnóstica. Responda APENAS com o JSON.`

    case 'trail':
      return `Crie uma trilha de bem-estar emocional.
Tema: "${theme}"
Retorne:
NOME: [nome]
DESCRIÇÃO: [2 frases]
OBJETIVO: [o que o usuário aprende]
DURAÇÃO: [ex: 2 semanas]
ETAPAS:
1. [nome] — [descrição]
2. [nome] — [descrição]
3. [nome] — [descrição]
4. [nome] — [descrição]
5. [nome] — [descrição]
EXERCÍCIO FINAL: [prática]
PERGUNTA PARA DIÁRIO: [1 pergunta]`

    case 'notification':
      return `Escreva uma notificação in-app.
Contexto: "${theme}"${ctx}
Retorne:
TÍTULO: [máximo 60 caracteres]
MENSAGEM: [máximo 120 caracteres]
CTA: [máximo 3 palavras]`

    case 'support_template':
      return `Escreva um template de resposta de suporte para: "${theme}".
Acolhedor, claro, com [NOME_DO_USUÁRIO] onde personalizar. Ofereça próximos passos. Despedida gentil.`

    case 'seo':
      return `Gere metadados SEO.${ctx}${preview}
META TITLE: [máximo 60 caracteres]
META DESCRIPTION: [máximo 155 caracteres]
SLUG: [slug]
KEYWORDS: [5 palavras-chave]`

    case 'social_proof':
      return `Escreva um texto de prova social para um app de bem-estar emocional.
Tipo: "${theme}". Seja honesto, sem números falsos. Máximo 3 frases.`

    case 'meditation':
      return `Escreva uma meditação guiada em texto sobre: "${theme}". Conduza o leitor por respiração, atenção ao corpo e reflexão. Sem prometer cura.`

    case 'emotional_exercise':
      return `Descreva um exercício emocional prático sobre: "${theme}". Passos simples, sem linguagem clínica. Inclua objetivo, passo a passo e reflexão final.`

    case 'self_care_plan':
      return `Crie um plano semanal de autocuidado sobre: "${theme}". Sugira 5 dias com uma prática simples cada. Sem promessas de resultado. Inclua uma pergunta de reflexão.`

    case 'professional_comment':
      return `Crie um rascunho de comentário profissional mensal.
Tópicos: "${theme}"${ctx}
3 a 5 frases: reconheça o esforço, ofereça reflexão, sugira prática. NÃO diagnostique. Será revisado antes de enviar.`

    case 'monthly_guidance':
      return `Escreva uma orientação mensal por mensagem para um usuário de app de bem-estar.
Contexto: "${theme}". Seja encorajador, prático e acolhedor. Não diagnostique.`

    case 'plan_description':
      return `Escreva uma descrição curta (1 frase) para o plano "${theme}" de um app de bem-estar emocional. Destaque o principal valor do plano.`

    case 'improve':
      return `Melhore o texto abaixo tornando-o mais claro e acolhedor, sem mudar o sentido:
"${contextContent || theme}"
Retorne apenas o texto melhorado.`

    case 'rewrite':
      return `Reescreva o texto abaixo com tom mais acolhedor e linguagem mais simples:
"${contextContent || theme}"
Retorne apenas o texto reescrito.`

    case 'summarize':
      return `Faça um resumo de 2 a 3 frases:
"${(contextContent || theme).slice(0, 2000)}"
Retorne apenas o resumo.`

    default:
      return `Gere conteúdo sobre: "${theme}"${ctx}. ${extras}`
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AIContentAssistant({
  contentType,
  contextTitle,
  contextContent,
  contextCategory,
  defaultTheme = '',
  defaultTone = 'acolhedor',
  label,
  placeholder,
  onInsert,
  onClose,
}: AIContentAssistantProps) {
  const [theme, setTheme] = useState(defaultTheme)
  const [tone, setTone] = useState<AITone>(defaultTone)
  // Artigo já nasce "Extenso" (o admin pode reduzir); os outros tipos, "médio".
  const [size, setSize] = useState<AISize>(contentType === 'article' ? 'extenso' : 'médio')
  const [extras, setExtras] = useState('')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const needsTheme = !['improve', 'rewrite', 'summarize'].includes(contentType)

  async function generate() {
    if (needsTheme && !theme.trim()) {
      setError('Informe o tema antes de gerar.')
      setStatus('error')
      return
    }
    setStatus('generating')
    setError('')
    setResult('')
    try {
      // Para questionários, chama diretamente sem instruções de tamanho/tom que corrompem o JSON
      let text: string
      if (contentType === 'questionnaire') {
        text = await generateQuestionnaireDraft(theme, 'autoavaliação')
      } else {
        const prompt = buildPrompt(contentType, theme, extras, contextTitle, contextContent, contextCategory)
        text = await callAI(prompt, { tone, size, extras })
      }
      setResult(text)
      setStatus('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido ao gerar.')
      setStatus('error')
    }
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-line">
          <div className="flex items-center gap-2 flex-1">
            <Sparkles className="w-5 h-5 text-forest-700" />
            <h2 className="font-semibold text-forest-900">{label || TYPE_LABELS[contentType]}</h2>
            <span className="text-[10px] bg-mint text-forest-800 px-2 py-0.5 rounded-full font-medium">
              Gratuito · Sem chave
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tema */}
          {needsTheme && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                {label ? label : 'Tema / assunto'}
              </label>
              <input
                value={theme}
                onChange={e => setTheme(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && generate()}
                placeholder={placeholder || 'Ex: ansiedade no trabalho, autoestima, luto...'}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          )}

          {/* Configurações rápidas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">Tom</label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as AITone)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">Tamanho</label>
              <select
                value={size}
                onChange={e => setSize(e.target.value as AISize)}
                className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Instruções extras (collapsível) */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Instruções extras
            </button>
            {showAdvanced && (
              <textarea
                value={extras}
                onChange={e => setExtras(e.target.value)}
                placeholder="Ex: incluir referência a sono, evitar mencionar remédios..."
                rows={2}
                className="mt-2 w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            )}
          </div>

          {/* Botão gerar */}
          <button
            onClick={generate}
            disabled={status === 'generating'}
            className="w-full flex items-center justify-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {status === 'generating' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {result ? 'Gerar novamente' : 'Gerar'}</>
            )}
          </button>

          {/* Resultado */}
          {status === 'error' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700 font-medium">Erro ao gerar</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                <button
                  onClick={generate}
                  className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium hover:text-red-800"
                >
                  <RefreshCw className="w-3 h-3" /> Tentar novamente
                </button>
              </div>
            </div>
          )}

          {status === 'done' && result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-forest-600" />
                <span className="text-xs text-forest-800 font-medium">Gerado com sucesso</span>
                <span className="text-xs text-stone-400 ml-auto">Revise antes de inserir</span>
              </div>
              <textarea
                value={result}
                onChange={e => setResult(e.target.value)}
                rows={10}
                className="w-full px-3 py-2.5 border border-forest-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-mint/30 font-mono text-xs leading-relaxed resize-y"
              />
            </div>
          )}
        </div>

        {/* Footer com ações */}
        <div className="p-4 border-t border-line flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-500 border border-line rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          {status === 'done' && result && (
            <>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 border border-line rounded-lg hover:bg-stone-50 transition-colors"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-forest-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                onClick={generate}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 border border-line rounded-lg hover:bg-stone-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Gerar novamente
              </button>
              <button
                onClick={() => { onInsert(result); onClose() }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-forest-700 text-white rounded-lg hover:bg-forest-800 transition-colors font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Inserir no formulário
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
