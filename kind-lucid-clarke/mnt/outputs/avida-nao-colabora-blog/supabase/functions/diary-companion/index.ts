import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
]

const EMOTIONS = ['ansiedade','medo','preocupação','insegurança','tristeza','desânimo','solidão','culpa','irritação','raiva','frustração','cansaço','sobrecarga','confusão','calma','esperança','alegria','gratidão']
const CONTEXTS = ['trabalho','família','relacionamento','amizades','dinheiro','saúde','corpo','casa','estudos','redes sociais','solidão','rotina','futuro','autoimagem','sono','alimentação','responsabilidades']
const NEEDS = ['descanso','acolhimento','clareza','silêncio','conversa','limite','organização','ajuda','pausa','leveza','segurança','coragem','paciência','presença','menos cobrança']
const CARE = ['tomar banho','beber água','respirar','ouvir música','caminhar','dormir mais cedo','conversar com alguém','organizar uma tarefa','ficar em silêncio','escrever mais','ver um conteúdo guiado','reduzir redes sociais','fazer uma pausa','comer algo leve','pedir ajuda']
const TRIGGERS = ['cobrança','conflito','excesso de tarefas','crítica','rejeição','comparação','incerteza','falta de descanso','mudança de planos','sensação de fracasso','dificuldade financeira','conversa difícil','pressão familiar','exposição em redes sociais']

function cors(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[1],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
const text = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : ''
const list = (v: unknown, allow: string[], max = 5) => Array.isArray(v)
  ? [...new Set(v.map(String).map(s => s.trim().toLowerCase()).filter(s => allow.includes(s)))].slice(0, max)
  : []

const FORBIDDEN = /(diagn[oó]stic|voc[eê]\s+(tem|possui|sofre de)|transtorno\s+(de|do|da)|quadro\s+cl[ií]nico|prescrev|medicamento\s+indicado|tratamento\s+necess[aá]rio|cura\s+para)/i
function safeSentence(value: unknown, fallback: string, max = 360) {
  const out = text(value, max)
  return out && !FORBIDDEN.test(out) ? out : fallback
}

function normalizePlan(raw: unknown): 'free' | 'essential' | 'plus' {
  const p = String(raw || 'free')
  if (p === 'plus' || p === 'therapeutic' || p === 'therapeutic-plus' || p === 'therapeutic_plus') return 'plus'
  if (p === 'essential') return 'essential'
  return 'free'
}

function startFallback(mood: string) {
  const m = mood.toLowerCase()
  if (m.includes('ansied')) return 'Se sua cabeça está acelerada, comece por uma coisa só: o que está ocupando mais espaço em você agora?'
  if (m.includes('cansa') || m.includes('energia')) return 'Sem precisar organizar tudo: o que mais consumiu sua energia hoje?'
  if (m.includes('trist') || m.includes('desân')) return 'Você não precisa explicar tudo. O que mais pesou no seu dia, mesmo que pareça pequeno?'
  if (m.includes('sobrec')) return 'Se você pudesse tirar uma única coisa da sua cabeça agora, qual seria?'
  if (m.includes('bem') || m.includes('tranq')) return 'O que aconteceu hoje que você gostaria de lembrar quando reler este dia?'
  return 'Complete sem pensar muito: “Se eu pudesse colocar uma coisa para fora agora, seria…”'
}

function mirrorFallback(body: { mood: string; content: string; plan: 'free' | 'essential' | 'plus' }) {
  const snippet = body.content.replace(/\s+/g, ' ').trim().slice(0, 170)
  const mood = body.mood || 'seu momento'
  return {
    title: snippet ? (snippet.split(/[.!?]/)[0] || 'Meu registro de hoje').slice(0, 72) : 'Meu registro de hoje',
    weight: `Seu registro colocou em palavras algo relacionado a ${mood.toLowerCase()}.`,
    observation: snippet ? `Uma parte que ganhou espaço no texto foi: “${snippet}${body.content.length > 170 ? '…' : ''}”` : 'Você reservou um momento para perceber como estava.',
    strength: 'O próprio ato de registrar já ajuda a deixar o momento mais visível, sem precisar resolvê-lo agora.',
    question: 'O que você gostaria de levar deste registro para amanhã?',
    pattern: body.plan === 'plus' ? 'Ainda não há recorrência suficiente para destacar um padrão com segurança.' : '',
    suggested_tags: { emotions: [], contexts: [], needs: [], care_actions: [], triggers: [] },
  }
}

async function generate(promptText: string): Promise<{ raw: string; model: string } | null> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const configured = (Deno.env.get('GEMINI_MODEL') || '').split(',').map(v => v.trim()).filter(Boolean)
  const models = configured.length ? configured : ['gemini-3.6-flash']
  if (geminiKey) {
    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 900, temperature: 0.45 } }),
        })
        if (res.ok) {
          const data = await res.json(); const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (raw) return { raw: String(raw), model }
        }
      } catch { /* próximo provedor */ }
    }
  }
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'openai/gpt-oss-120b', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: promptText }], max_completion_tokens: 900, temperature: 0.45 }),
      })
      if (res.ok) {
        const data = await res.json(); const raw = data?.choices?.[0]?.message?.content
        if (raw) return { raw: String(raw), model: 'groq:openai/gpt-oss-120b' }
      }
    } catch { /* próximo provedor */ }
  }
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: promptText }], max_tokens: 900, temperature: 0.45 }),
      })
      if (res.ok) {
        const data = await res.json(); const raw = data?.choices?.[0]?.message?.content
        if (raw) return { raw: String(raw), model: 'openai:gpt-4o-mini' }
      }
    } catch { /* fallback */ }
  }
  return null
}

function parse(raw: string) {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const value = JSON.parse(match?.[0] || raw)
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch { return null }
}

function summarizeRecent(rows: Record<string, unknown>[]) {
  const counts = (key: string) => {
    const map = new Map<string, number>()
    for (const row of rows) for (const item of Array.isArray(row[key]) ? row[key] as unknown[] : []) {
      const value = String(item).trim().toLowerCase(); if (value) map.set(value, (map.get(value) || 0) + 1)
    }
    return [...map.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, count]) => ({ label, count }))
  }
  return {
    recurring_emotions: counts('emotional_tags'), recurring_contexts: counts('context_tags'), recurring_needs: counts('need_tags'), recurring_triggers: counts('trigger_tags'),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { ok: false, message: 'Método não permitido.' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json(req, { ok: false, message: 'Faça login para usar este recurso.' }, 401)
  const url = Deno.env.get('SUPABASE_URL') || ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !anon || !service) return json(req, { ok: false, message: 'Serviço temporariamente indisponível.' }, 503)

  const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: authData, error: authError } = await authClient.auth.getUser()
  const user = authData.user
  if (authError || !user) return json(req, { ok: false, message: 'Sua sessão expirou. Entre novamente.' }, 401)
  const admin = createClient(url, service, { auth: { persistSession: false } })

  let plan: 'free' | 'essential' | 'plus' = 'free'
  const { data: effectivePlan } = await admin.rpc('effective_plan_for_user', { p_user_id: user.id })
  if (effectivePlan) plan = normalizePlan(effectivePlan)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(req, { ok: false, message: 'Dados inválidos.' }, 400) }
  const action = String(body.action || '')
  const mood = text(body.mood, 80)
  const content = text(body.text, 6000)

  let recent: Record<string, unknown>[] = []
  if (plan !== 'free') {
    const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const { data } = await admin.from('diary_entries')
      .select('date,mood,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags,energy,anxiety_level')
      .eq('user_id', user.id).gte('date', since).order('date', { ascending: false }).limit(30)
    recent = (data || []) as Record<string, unknown>[]
  }
  const recentSummary = summarizeRecent(recent)

  if (action === 'start') {
    const fallback = startFallback(mood)
    const prompt = `Você ajuda uma pessoa a COMEÇAR um diário emocional no app A Vida Não Colabora. Escreva UMA pergunta curta, humana e convidativa em português brasileiro. Não diagnostique, não interprete clinicamente, não dê conselho médico e não presuma causa. O objetivo é reduzir a barreira para escrever. Humor informado: ${mood || 'não informado'}. Hora local aproximada: ${Number(body.hour) || 'não informada'}. ${plan === 'plus' ? `Recorrências estruturadas dos últimos 14 dias (sem textos livres): ${JSON.stringify(recentSummary)}. Só use uma recorrência se count >= 2 e apresente como algo a observar, nunca como causa.` : ''} Retorne JSON: {"prompt":"..."}`
    const ai = await generate(prompt)
    const parsed = ai ? parse(ai.raw) : null
    return json(req, { ok: true, action, prompt: safeSentence(parsed?.prompt, fallback, 260), ai_used: !!parsed, model: ai?.model })
  }

  if (action === 'organize') {
    if (plan === 'free') return json(req, { ok: false, message: 'Organizar a escrita com IA está disponível nos planos Essencial e Plus.' }, 403)
    if (content.length < 10) return json(req, { ok: false, message: 'Escreva um pouco mais antes de organizar o texto.' }, 400)
    const prompt = `Organize o texto de diário abaixo para ficar mais fácil de reler, mantendo a PRIMEIRA PESSOA, o sentido, os fatos e o tom da pessoa. Não acrescente interpretações, diagnósticos, conselhos, explicações ou acontecimentos. Não deixe o texto artificial. Retorne apenas JSON {"organized_text":"..."}. TEXTO: ${JSON.stringify(content)}`
    const ai = await generate(prompt); const parsed = ai ? parse(ai.raw) : null
    const organized = safeSentence(parsed?.organized_text, content, 6000)
    return json(req, { ok: true, action, organized_text: organized, ai_used: !!parsed, model: ai?.model })
  }

  if (action === 'continue') {
    if (plan === 'free') return json(req, { ok: false, message: 'Perguntas personalizadas de continuidade estão disponíveis nos planos Essencial e Plus.' }, 403)
    if (content.length < 10) return json(req, { ok: false, message: 'Ainda há pouco texto para aprofundar.' }, 400)
    const prompt = `Leia este registro como um espelho de autopercepção. Faça UMA pergunta de continuidade que ajude a pessoa a explorar o que ela mesma escreveu. Não diagnostique, não presuma causa, não diga o que ela deve fazer. ${plan === 'plus' ? `Recorrências estruturadas recentes: ${JSON.stringify(recentSummary)}. Só mencione recorrência se count >= 2.` : ''} Retorne JSON {"prompt":"..."}. REGISTRO: ${JSON.stringify(content)}`
    const ai = await generate(prompt); const parsed = ai ? parse(ai.raw) : null
    return json(req, { ok: true, action, prompt: safeSentence(parsed?.prompt, 'O que neste registro você sente que ainda ficou sem palavras?', 260), ai_used: !!parsed, model: ai?.model })
  }

  if (action === 'mirror') {
    if (content.length < 5) return json(req, { ok: false, message: 'Ainda há pouco texto para gerar uma leitura.' }, 400)
    const fallback = mirrorFallback({ mood, content, plan })
    const tagInstruction = plan === 'free'
      ? 'Não sugira tags: retorne todos os arrays vazios.'
      : `Sugira somente itens EXATAMENTE destas listas, sem criar palavras novas. emoções=${JSON.stringify(EMOTIONS)}; contextos=${JSON.stringify(CONTEXTS)}; necessidades=${JSON.stringify(NEEDS)}; cuidados=${JSON.stringify(CARE)}; ${plan === 'plus' ? `gatilhos=${JSON.stringify(TRIGGERS)}` : 'gatilhos=[]'}.`
    const planInstruction = plan === 'plus'
      ? `Você pode incluir "pattern" SOMENTE se houver recorrência real com count >= 2 nestes dados estruturados recentes: ${JSON.stringify(recentSummary)}. Se não houver, deixe pattern vazio.`
      : 'Deixe pattern vazio.'
    const prompt = `Você cria uma devolutiva curta de autopercepção após a pessoa escrever no diário do app A Vida Não Colabora. Use SOMENTE o texto atual e os dados estruturados explicitamente fornecidos. Não diagnostique, não prescreva, não prometa cura, não determine causas, não use linguagem clínica. Prefira "você falou bastante sobre", "parece ter ganhado espaço no seu registro", "vale observar". Aponte também algo de agência, cuidado ou pequena conquista apenas se estiver sustentado pelo texto; se não estiver, reconheça apenas o ato de escrever. ${tagInstruction} ${planInstruction} Retorne EXCLUSIVAMENTE JSON: {"title":"título privado curto","weight":"o que parece ter pesado ou ocupado espaço","observation":"algo que vale observar","strength":"algo de agência/cuidado sustentado pelo texto ou o valor de ter registrado","question":"uma pergunta leve para levar consigo","pattern":"recorrência opcional","suggested_tags":{"emotions":[],"contexts":[],"needs":[],"care_actions":[],"triggers":[]}}. HUMOR: ${JSON.stringify(mood)}. TEXTO ATUAL: ${JSON.stringify(content)}`
    const ai = await generate(prompt); const parsed = ai ? parse(ai.raw) : null
    const tags = parsed?.suggested_tags && typeof parsed.suggested_tags === 'object' ? parsed.suggested_tags as Record<string, unknown> : {}
    const mirror = {
      title: safeSentence(parsed?.title, fallback.title, 80),
      weight: safeSentence(parsed?.weight, fallback.weight, 360),
      observation: safeSentence(parsed?.observation, fallback.observation, 360),
      strength: safeSentence(parsed?.strength, fallback.strength, 360),
      question: safeSentence(parsed?.question, fallback.question, 240),
      pattern: plan === 'plus' ? safeSentence(parsed?.pattern, fallback.pattern || '', 300) : '',
      suggested_tags: plan === 'free' ? fallback.suggested_tags : {
        emotions: list(tags.emotions, EMOTIONS), contexts: list(tags.contexts, CONTEXTS), needs: list(tags.needs, NEEDS), care_actions: list(tags.care_actions, CARE), triggers: plan === 'plus' ? list(tags.triggers, TRIGGERS) : [],
      },
      ai_used: !!parsed,
      model: ai?.model,
    }
    return json(req, { ok: true, action, mirror, ai_used: !!parsed, model: ai?.model })
  }

  return json(req, { ok: false, message: 'Ação desconhecida.' }, 400)
})
