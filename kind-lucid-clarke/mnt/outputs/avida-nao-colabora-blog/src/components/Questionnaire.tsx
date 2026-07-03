import { useState } from 'react'
import { ClipboardList, BookOpen, DollarSign, BookMarked, ChevronRight, RotateCcw } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface Question {
  id: string
  text: string
  options: string[]
}

const questions: Question[] = [
  {
    id: 'q1',
    text: 'Como você tem se sentido na maior parte dos dias?',
    options: ['Tranquilo(a)', 'Ansioso(a)', 'Cansado(a)', 'Desanimado(a)', 'Irritado(a)', 'Sobrecarregado(a)', 'Não sei dizer'],
  },
  {
    id: 'q2',
    text: 'O que mais tem pesado para você ultimamente?',
    options: ['Trabalho ou estudos', 'Família', 'Relacionamentos', 'Autoestima', 'Rotina', 'Dinheiro', 'Solidão', 'Excesso de pensamentos', 'Outro'],
  },
  {
    id: 'q3',
    text: 'Como está sua energia nos últimos dias?',
    options: ['Boa', 'Normal', 'Baixa', 'Muito baixa', 'Oscilando bastante'],
  },
  {
    id: 'q4',
    text: 'Como está seu sono?',
    options: ['Bom', 'Irregular', 'Durmo pouco', 'Durmo muito', 'Acordo cansado(a)', 'Prefiro não responder'],
  },
  {
    id: 'q5',
    text: 'Você tem conseguido fazer pequenas coisas por você?',
    options: ['Sim, com frequência', 'Às vezes', 'Raramente', 'Não tenho conseguido'],
  },
  {
    id: 'q6',
    text: 'Quando algo te incomoda, você costuma:',
    options: ['Conversar com alguém', 'Guardar para si', 'Escrever sobre isso', 'Tentar se distrair', 'Explodir ou se irritar', 'Não sei'],
  },
  {
    id: 'q7',
    text: 'Qual tipo de apoio você gostaria de receber?',
    options: ['Textos reflexivos', 'Exercícios práticos', 'Perguntas para diário', 'Meditações em texto', 'Desafios leves', 'Organização emocional'],
  },
  {
    id: 'q8',
    text: 'Você gostaria de acompanhar sua evolução emocional?',
    options: ['Sim', 'Talvez', 'Não sei', 'Não neste momento'],
  },
  {
    id: 'q9',
    text: 'Qual tema mais combina com você agora?',
    options: ['Ansiedade', 'Autoestima', 'Cansaço emocional', 'Rotina', 'Limites', 'Relacionamentos', 'Autoconhecimento', 'Compulsões e hábitos', 'Outro'],
  },
  {
    id: 'q10',
    text: 'Como você gostaria de começar?',
    options: ['Escrevendo no diário', 'Lendo um conteúdo', 'Fazendo um desafio', 'Recebendo uma sugestão personalizada'],
  },
]

function buildResult(answers: Record<string, string>): string {
  const q1 = answers['q1'] || ''
  const q3 = answers['q3'] || ''
  const q9 = answers['q9'] || ''

  const isOverloaded = ['Sobrecarregado(a)', 'Ansioso(a)', 'Cansado(a)'].includes(q1)
  const lowEnergy = ['Baixa', 'Muito baixa'].includes(q3)

  if (isOverloaded && lowEnergy) {
    return `Pelas suas respostas, parece que você está em um momento de maior sobrecarga emocional e cansaço. Você pode começar com conteúdos sobre descanso, organização da rotina e registro de pensamentos. Pequenos passos fazem diferença.`
  }
  if (q1 === 'Ansioso(a)') {
    return `Suas respostas mostram que a ansiedade tem estado presente no seu dia a dia. Conteúdos sobre respiração, organização emocional e registro de sentimentos podem ser um bom ponto de partida.`
  }
  if (q1 === 'Desanimado(a)') {
    return `Parece que você está passando por um momento de desânimo. Você não precisa resolver tudo de uma vez — começar com pequenas ações de autocuidado pode ajudar a retomar o movimento.`
  }
  if (q9) {
    return `Baseando-se nas suas respostas, o tema "${q9}" parece ser relevante para você agora. Você pode explorar conteúdos nessa área e registrar suas reflexões no diário para acompanhar seu caminho.`
  }
  return `Obrigado(a) por compartilhar como você está se sentindo. Aqui você encontrará recursos para organizar suas emoções, criar hábitos de autocuidado e acompanhar sua evolução com gentileza.`
}

interface QuestionnaireProps {
  user: User | null
  onNavigateDiary: () => void
  onNavigatePricing?: () => void
  onNavigateArticles?: () => void
}

export default function Questionnaire({ user: _user, onNavigateDiary, onNavigatePricing, onNavigateArticles }: QuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const current = questions[currentStep]
  const isLast = currentStep === questions.length - 1
  const progress = ((currentStep) / questions.length) * 100

  const handleAnswer = (option: string) => {
    const newAnswers = { ...answers, [current.id]: option }
    setAnswers(newAnswers)

    if (isLast) {
      setSubmitted(true)
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleReset = () => {
    setAnswers({})
    setCurrentStep(0)
    setSubmitted(false)
  }

  if (submitted) {
    const resultText = buildResult(answers)
    return (
      <section id="questionnaire" className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌱</span>
            </div>
            <h2 className="font-serif text-2xl text-sage-800 mb-2">Obrigado(a) por compartilhar</h2>
            <p className="text-sm text-sage-500">Aqui está uma reflexão baseada nas suas respostas:</p>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 mb-6">
            <p className="text-sage-700 leading-relaxed text-sm">{resultText}</p>
          </div>

          <p className="text-xs text-sage-400 text-center mb-6 leading-relaxed">
            Este não é um diagnóstico — é apenas uma reflexão acolhedora com base no que você compartilhou. Se você estiver passando por um momento difícil, considere buscar apoio profissional.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <button
              onClick={onNavigateDiary}
              className="flex flex-col items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white px-4 py-4 rounded-xl text-sm font-medium transition-colors text-center"
            >
              <BookOpen className="w-5 h-5" />
              <span>Registrar como estou hoje</span>
            </button>
            {onNavigatePricing && (
              <button
                onClick={onNavigatePricing}
                className="flex flex-col items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-4 rounded-xl text-sm font-medium transition-colors text-center"
              >
                <DollarSign className="w-5 h-5" />
                <span>Ver planos</span>
              </button>
            )}
            {onNavigateArticles && (
              <button
                onClick={onNavigateArticles}
                className="flex flex-col items-center gap-2 bg-sand-100 hover:bg-sand-200 text-sage-700 px-4 py-4 rounded-xl text-sm font-medium transition-colors text-center"
              >
                <BookMarked className="w-5 h-5" />
                <span>Ler artigos</span>
              </button>
            )}
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sage-500 hover:text-sage-700 text-sm mx-auto transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Refazer questionário
          </button>
        </div>
      </section>
    )
  }

  return (
    <section id="questionnaire" className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <ClipboardList className="w-5 h-5 text-purple-400" />
          <p className="text-purple-400 text-sm uppercase tracking-widest">Autoavaliação</p>
        </div>
        <h2 className="font-serif text-3xl md:text-4xl text-sage-800 mb-3">Como você está?</h2>
        <p className="text-sage-500 max-w-md mx-auto text-sm leading-relaxed">
          Responda com honestidade. Não há respostas certas ou erradas — apenas o que é verdadeiro para você agora.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-sand-100 p-6 md:p-8">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-sage-400 mb-2">
            <span>Pergunta {currentStep + 1} de {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-sand-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <p className="text-sage-700 font-medium text-base md:text-lg leading-relaxed mb-6">
          {current.text}
        </p>

        {/* Options */}
        <div className="space-y-2">
          {current.options.map((option) => (
            <button
              key={option}
              onClick={() => handleAnswer(option)}
              className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-sand-200 text-sage-700 text-sm hover:border-purple-300 hover:bg-purple-50 transition-all group"
            >
              <span>{option}</span>
              <ChevronRight className="w-4 h-4 text-sage-300 group-hover:text-purple-400 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Back button */}
        {currentStep > 0 && (
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="mt-5 text-xs text-sage-400 hover:text-sage-600 transition-colors"
          >
            ← Voltar para a pergunta anterior
          </button>
        )}
      </div>
    </section>
  )
}
