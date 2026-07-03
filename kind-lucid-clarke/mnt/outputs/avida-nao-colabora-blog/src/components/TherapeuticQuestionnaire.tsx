import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ClipboardList, CheckCircle } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const therapeuticQuestions = [
  { id: 'q1', text: 'Há quanto tempo você convive com dor crônica ou sintomas persistentes?', options: ['Menos de 6 meses', '6 meses a 2 anos', '2 a 5 anos', 'Mais de 5 anos'] },
  { id: 'q2', text: 'Como a dor ou os sintomas afetam sua rotina diária?', options: ['Pouco — consigo fazer a maioria das coisas', 'Moderadamente — algumas limitações', 'Muito — limita bastante meu dia', 'Extremamente — mal consigo sair da cama'] },
  { id: 'q3', text: 'Como está sua qualidade de sono?', options: ['Durmo bem na maioria das noites', 'Tenho dificuldade ocasional', 'Durmo mal com frequência', 'Insônia severa ou sono não reparador'] },
  { id: 'q4', text: 'Você identifica gatilhos para seus sintomas?', options: ['Sim, claramente (estresse, alimentos, clima...)', 'Às vezes consigo identificar', 'Raramente consigo identificar', 'Não consigo identificar padrão algum'] },
  { id: 'q5', text: 'Como está sua saúde emocional?', options: ['Estável e equilibrada', 'Com altos e baixos, mas consigo lidar', 'Com dificuldade frequente — ansiedade ou tristeza', 'Em crise — não consigo lidar sozinho(a)'] },
  { id: 'q6', text: 'Você tem apoio social (família, amigos, comunidade)?', options: ['Sim, forte rede de apoio', 'Apoio parcial', 'Pouquíssimo apoio', 'Me sinto completamente sozinho(a)'] },
  { id: 'q7', text: 'Como você lida com as emoções difíceis?', options: ['Consigo processar e expressar bem', 'Às vezes reprimo, às vezes expresso', 'Reprimo com frequência', 'Não sei como lidar com elas'] },
  { id: 'q8', text: 'Você pratica algum tipo de autocuidado regularmente?', options: ['Sim, rotina estabelecida', 'Às vezes', 'Raramente', 'Não pratico autocuidado'] },
  { id: 'q9', text: 'Como está sua alimentação?', options: ['Equilibrada e consciente', 'Com algumas dificuldades', 'Desregulada — compulsão ou restrição', 'Muito irregular e preocupante'] },
  { id: 'q10', text: 'Você já fez ou faz acompanhamento com profissional de saúde mental?', options: ['Sim, acompanhamento ativo', 'Fiz no passado', 'Nunca fiz, mas tenho interesse', 'Nunca fiz e não considero'] },
  { id: 'q11', text: 'O que você mais deseja melhorar em sua vida agora?', options: ['Reduzir o cansaço emocional', 'Melhorar o estado emocional', 'Ter mais energia e disposição', 'Ter mais qualidade nos relacionamentos'] },
  { id: 'q12', text: 'Como você descreveria sua relação com seu corpo?', options: ['Harmoniosa e respeitosa', 'Às vezes conflituosa', 'Frequentemente conflituosa', 'Muito difícil — sinto que meu corpo me trai'] },
]

function generatePlan(answers: Record<string, number>) {
  const avg = Object.values(answers).reduce((a, b) => a + b, 0) / Object.values(answers).length

  const focusAreas: string[] = []
  if (answers['q3'] >= 2) focusAreas.push('sono e descanso')
  if (answers['q2'] >= 2) focusAreas.push('manejo da dor e limitações')
  if (answers['q5'] >= 2) focusAreas.push('saúde emocional e regulação')
  if (answers['q6'] >= 2) focusAreas.push('conexão social e apoio')
  if (answers['q9'] >= 2) focusAreas.push('alimentação e relação com o corpo')
  if (answers['q7'] >= 2) focusAreas.push('processamento emocional')

  return {
    intensity: avg < 1.5 ? 'Leve' : avg < 2.5 ? 'Moderado' : 'Intensivo',
    focusAreas: focusAreas.length ? focusAreas : ['bem-estar geral', 'prevenção e manutenção'],
    dailyRoutine: [
      '⏰ Acordar e dormir no mesmo horário todos os dias',
      answers['q3'] >= 2 ? '🌙 Ritual noturno: desligar telas 1h antes de dormir' : '✅ Manter rotina de sono atual',
      answers['q2'] >= 2 ? '🩹 10 minutos de alongamento suave ao acordar' : '🏃 20 minutos de movimento ao longo do dia',
      answers['q7'] >= 2 ? '📝 5 minutos de escrita matinal (o que sinto agora?)' : '🙏 3 coisas pelas quais sou grato(a) ao acordar',
      answers['q9'] >= 2 ? '🥗 Refeições sem distração — comer com atenção plena' : '🥤 Hidratação adequada ao longo do dia',
    ],
    weeklyGoals: [
      '📚 Ler ou acompanhar um artigo do blog por semana',
      '🧘 Fazer ao menos 3 meditações guiadas da semana',
      '📓 Preencher o diário ao menos 4x na semana',
      focusAreas.includes('conexão social e apoio') ? '💬 Ter uma conversa significativa com alguém de confiança' : '🌿 Passar um tempo na natureza ou em silêncio',
    ],
    techniques: [
      answers['q4'] >= 2 ? 'Diário de sintomas para identificar padrões e gatilhos' : 'Monitoramento de humor no diário',
      answers['q5'] >= 2 ? 'Técnica 5-4-3-2-1 para ancoragem em momentos de ansiedade' : 'Mindfulness breve — 5 min de atenção plena',
      answers['q7'] >= 2 ? 'Escrita emocional — nomear e explorar as emoções no papel' : 'Respiração 4-7-8 antes de dormir',
      answers['q2'] >= 2 ? 'Técnicas de relaxamento muscular progressivo para dor' : 'Alongamentos suaves e respiração consciente',
    ],
    recommendation: avg < 1.5
      ? 'Seu estado geral é relativamente estável. Foque em manutenção e prevenção com práticas leves e consistentes.'
      : avg < 2.5
      ? 'Você enfrenta desafios moderados. Um plano estruturado com consistência diária fará grande diferença ao longo dos meses.'
      : 'Seus desafios são significativos. Além deste plano, recomendamos fortemente buscar apoio profissional de saúde mental. As sessões mensais com psicanalista incluídas no seu plano são um excelente ponto de partida.',
  }
}

interface TherapeuticQuestionnaireProps {
  user: User | null
  onBack: () => void
}

export default function TherapeuticQuestionnaire({ user, onBack }: TherapeuticQuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const allAnswered = therapeuticQuestions.every(q => answers[q.id] !== undefined)

  const handleSubmit = async () => {
    setSaving(true)
    const plan = generatePlan(answers)
    await supabase.from('questionnaire_responses').insert({
      user_id: user!.id,
      answers,
      score: Object.values(answers).reduce((a, b) => a + b, 0),
      category: `Aprofundado — ${plan.intensity}`,
    })
    setSubmitted(true)
    setSaving(false)
  }

  if (submitted) {
    const plan = generatePlan(answers)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="bg-white rounded-2xl border border-sand-100 shadow-sm p-8">
          <CheckCircle className="w-10 h-10 text-sage-500 mb-4" />
          <h2 className="font-serif text-3xl text-sage-800 mb-1">Seu Plano de Autocuidado</h2>
          <p className="text-sage-500 text-sm mb-6">Gerado com base nas suas respostas — intensidade: <strong>{plan.intensity}</strong></p>

          <div className="space-y-5">
            <div className="bg-sage-50 rounded-xl p-4">
              <h3 className="font-semibold text-sage-700 mb-2 text-sm">🎯 Áreas de foco</h3>
              <ul className="space-y-1">{plan.focusAreas.map((f, i) => <li key={i} className="text-sm text-sage-600 capitalize">• {f}</li>)}</ul>
            </div>
            <div className="bg-sand-50 rounded-xl p-4">
              <h3 className="font-semibold text-sage-700 mb-2 text-sm">☀️ Rotina diária sugerida</h3>
              <ul className="space-y-1.5">{plan.dailyRoutine.map((r, i) => <li key={i} className="text-sm text-sage-600">{r}</li>)}</ul>
            </div>
            <div className="bg-ocean-50 rounded-xl p-4">
              <h3 className="font-semibold text-sage-700 mb-2 text-sm">📅 Metas semanais</h3>
              <ul className="space-y-1.5">{plan.weeklyGoals.map((g, i) => <li key={i} className="text-sm text-sage-600">{g}</li>)}</ul>
            </div>
            <div className="bg-white border border-sand-200 rounded-xl p-4">
              <h3 className="font-semibold text-sage-700 mb-2 text-sm">🛠️ Técnicas recomendadas</h3>
              <ul className="space-y-1.5">{plan.techniques.map((t, i) => <li key={i} className="text-sm text-sage-600">• {t}</li>)}</ul>
            </div>
            <div className="bg-sage-600 text-white rounded-xl p-4">
              <p className="text-sm leading-relaxed">{plan.recommendation}</p>
            </div>
          </div>

          <p className="text-xs text-sage-400 mt-6">Este plano é orientativo e não substitui avaliação clínica profissional.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center mb-10">
        <ClipboardList className="w-7 h-7 text-ocean-400 mx-auto mb-3" />
        <h1 className="font-serif text-4xl text-sage-800 mb-2">Questionário Aprofundado</h1>
        <p className="text-sage-500 text-sm max-w-lg mx-auto">
          Este questionário irá gerar um plano de autocuidado personalizado para você.
        </p>
      </div>

      <div className="space-y-5">
        {therapeuticQuestions.map((q, idx) => (
          <div key={q.id} className="bg-white border border-sand-100 rounded-xl p-5 shadow-sm">
            <p className="text-sage-700 font-medium mb-4 text-sm leading-relaxed">
              <span className="text-sage-400 mr-2">{idx + 1}.</span> {q.text}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, val) => (
                <button
                  key={val}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                  className={`w-full text-left text-sm py-2.5 px-4 rounded-lg border transition-all ${
                    answers[q.id] === val
                      ? 'bg-ocean-600 text-white border-ocean-600'
                      : 'border-sand-200 text-sage-600 hover:bg-ocean-50 hover:border-ocean-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-sage-400 mb-4">{Object.keys(answers).length}/{therapeuticQuestions.length} respondidas</p>
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || saving}
          className="bg-ocean-600 hover:bg-ocean-700 text-white px-10 py-3.5 rounded-full font-medium text-sm transition-colors disabled:opacity-50 shadow-md"
        >
          {saving ? 'Gerando plano...' : 'Gerar meu plano de autocuidado'}
        </button>
      </div>
    </div>
  )
}
