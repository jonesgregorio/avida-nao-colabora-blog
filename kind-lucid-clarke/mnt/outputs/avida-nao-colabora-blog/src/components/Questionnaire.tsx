import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ClipboardList, CheckCircle, BookOpen } from 'lucide-react'

const questions = [
  { id: 'q1', text: 'Com que frequência você se sente nervoso(a), ansioso(a) ou tenso(a)?', scale: true },
  { id: 'q2', text: 'Com que frequência você se sentiu triste, deprimido(a) ou sem esperança?', scale: true },
  { id: 'q3', text: 'Você tem dificuldade em dormir, dormir demais ou dormir muito pouco?', scale: true },
  { id: 'q4', text: 'Você se sente com pouca energia ou muito cansado(a) sem motivo aparente?', scale: true },
  { id: 'q5', text: 'Você tem dificuldade em se concentrar em atividades do dia a dia?', scale: true },
  { id: 'q6', text: 'Você se sente irritado(a) ou facilmente aborrecido(a)?', scale: true },
  { id: 'q7', text: 'Você evita situações sociais por medo ou ansiedade?', scale: true },
  { id: 'q8', text: 'Você sente dores físicas sem causa médica clara (cabeça, costas, estômago)?', scale: true },
  { id: 'q9', text: 'Você sente que perdeu o interesse por coisas que antes gostava?', scale: true },
  { id: 'q10', text: 'Você tem pensamentos negativos repetitivos sobre você mesmo(a) ou o futuro?', scale: true },
]

const scaleLabels = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Quase sempre']

function getCategory(score: number): { label: string; color: string; description: string; recommendations: string[] } {
  if (score <= 15) return {
    label: 'Bem-estar positivo',
    color: 'text-sage-600',
    description: 'Seu estado emocional está equilibrado. Continue cuidando de si mesmo(a) com práticas regulares de autocuidado.',
    recommendations: ['Mantenha sua rotina de sono', 'Continue com atividades prazerosas', 'Cultive conexões sociais'],
  }
  if (score <= 25) return {
    label: 'Sinais leves',
    color: 'text-ocean-600',
    description: 'Você apresenta alguns sinais que merecem atenção. Pequenas mudanças de rotina podem fazer grande diferença.',
    recommendations: ['Pratique técnicas de relaxamento', 'Reduza cafeína e telas antes de dormir', 'Tente registrar seus sentimentos no diário'],
  }
  if (score <= 35) return {
    label: 'Sinais moderados',
    color: 'text-sand-600',
    description: 'Seus sintomas estão afetando sua qualidade de vida. Considere buscar apoio profissional.',
    recommendations: ['Considere buscar um psicólogo', 'Fale com pessoas de confiança', 'Estabeleça uma rotina de autocuidado'],
  }
  return {
    label: 'Sinais significativos',
    color: 'text-red-600',
    description: 'Você apresenta sinais importantes de sofrimento emocional. Recomendamos fortemente buscar apoio profissional.',
    recommendations: ['Busque um psicólogo ou psiquiatra', 'Se estiver em crise, ligue para o CVV: 188', 'Não enfrente isso sozinho(a)'],
  }
}

interface QuestionnaireProps {
  user: any
  onNavigateDiary: () => void
}

export default function Questionnaire({ user, onNavigateDiary }: QuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)

  const handleAnswer = (id: string, value: number) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const allAnswered = questions.every(q => answers[q.id] !== undefined)

  const handleSubmit = async () => {
    if (!allAnswered) return
    setSaving(true)
    const total = Object.values(answers).reduce((a, b) => a + b, 0)
    const cat = getCategory(total)

    // Save questionnaire response
    await supabase.from('questionnaire_responses').insert({
      user_id: user?.id || null,
      answers,
      score: total,
      category: cat.label,
    })

    // Save to diary if logged in
    if (user) {
      await supabase.from('diary_entries').insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        mood: total <= 15 ? 'ótimo' : total <= 25 ? 'bem' : total <= 35 ? 'neutro' : 'difícil',
        mood_score: Math.max(1, 10 - Math.round(total / 5)),
        text: `Questionário respondido. Categoria: ${cat.label}. Pontuação: ${total}/40.`,
        entry_type: 'questionnaire',
        questionnaire_score: total,
        questionnaire_category: cat.label,
      })
    }

    setScore(total)
    setSubmitted(true)
    setSaving(false)
  }

  const result = getCategory(score)

  if (submitted) {
    return (
      <section id="questionnaire" className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-sand-100 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-sage-500 mx-auto mb-4" />
          <h2 className="font-serif text-3xl text-sage-800 mb-2">Resultado</h2>
          <p className={`text-xl font-semibold mb-3 ${result.color}`}>{result.label}</p>
          <p className="text-sm text-sage-500 mb-2">Pontuação: {score}/40</p>
          <p className="text-sage-600 leading-relaxed mb-6 max-w-lg mx-auto">{result.description}</p>

          <div className="bg-sand-50 rounded-xl p-5 text-left mb-6">
            <h3 className="font-semibold text-sage-700 mb-3 text-sm">Recomendações:</h3>
            <ul className="space-y-2">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-sage-600">
                  <span className="text-sage-400 mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>

          {user && (
            <button
              onClick={onNavigateDiary}
              className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-700 text-white px-6 py-3 rounded-lg text-sm font-medium mx-auto transition-colors"
            >
              <BookOpen className="w-4 h-4" /> Ver no diário
            </button>
          )}

          <button
            onClick={() => { setAnswers({}); setSubmitted(false) }}
            className="mt-4 text-sm text-sage-500 hover:text-sage-700 block mx-auto"
          >
            Refazer questionário
          </button>

          <p className="text-xs text-sage-400 mt-6">
            Este questionário é apenas informativo e não substitui avaliação clínica profissional.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="questionnaire" className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <ClipboardList className="w-6 h-6 text-sage-500" />
          <p className="text-sage-500 text-sm uppercase tracking-widest">Autoavaliação</p>
        </div>
        <h2 className="font-serif text-4xl text-sage-800 mb-3">Como você está?</h2>
        <p className="text-sage-500 max-w-lg mx-auto text-sm leading-relaxed">
          Responda com honestidade. Não há respostas certas ou erradas — apenas o que é verdadeiro para você agora.
        </p>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl border border-sand-100 shadow-sm p-5">
            <p className="text-sage-700 font-medium mb-4 text-sm leading-relaxed">
              <span className="text-sage-400 mr-2">{idx + 1}.</span> {q.text}
            </p>
            <div className="flex gap-2 flex-wrap">
              {scaleLabels.map((label, val) => (
                <button
                  key={val}
                  onClick={() => handleAnswer(q.id, val)}
                  className={`flex-1 min-w-[80px] text-xs py-2 px-2 rounded-lg border transition-all ${
                    answers[q.id] === val
                      ? 'bg-sage-600 text-white border-sage-600'
                      : 'border-sand-200 text-sage-600 hover:border-sage-300 hover:bg-sage-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <div className="text-sm text-sage-400 mb-4">
          {Object.keys(answers).length}/{questions.length} perguntas respondidas
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || saving}
          className="bg-sage-600 hover:bg-sage-700 text-white px-10 py-3.5 rounded-full font-medium text-sm transition-colors disabled:opacity-50 shadow-md"
        >
          {saving ? 'Salvando...' : 'Ver meu resultado'}
        </button>
      </div>
    </section>
  )
}
