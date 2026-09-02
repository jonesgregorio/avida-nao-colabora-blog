import { ChevronDown, ChevronUp, CircleDot, Heart, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useModalA11y } from '../hooks/useModalA11y'
import { SliderField, TagGroup } from './DiaryFormFields'

const emotionalTags = ['ansiedade','medo','preocupação','insegurança','tristeza','desânimo','solidão','culpa','irritação','raiva','frustração','cansaço','sobrecarga','confusão','calma','esperança','alegria','gratidão']
const freeEmotionalTags = ['ansiedade','tristeza','cansaço','sobrecarga','calma','gratidão']
const contextTags = ['trabalho','família','relacionamento','amizades','dinheiro','saúde','corpo','casa','estudos','redes sociais','solidão','rotina','futuro','autoimagem','sono','alimentação','responsabilidades']
const needTags = ['descanso','acolhimento','clareza','silêncio','conversa','limite','organização','ajuda','pausa','leveza','segurança','coragem','paciência','presença','menos cobrança']
const careTags = ['tomar banho','beber água','respirar','ouvir música','caminhar','dormir mais cedo','conversar com alguém','organizar uma tarefa','ficar em silêncio','escrever mais','ver um conteúdo guiado','reduzir redes sociais','fazer uma pausa','comer algo leve','pedir ajuda']
const triggerTags = ['cobrança','conflito','excesso de tarefas','crítica','rejeição','comparação','incerteza','falta de descanso','mudança de planos','sensação de fracasso','dificuldade financeira','conversa difícil','pressão familiar','exposição em redes sociais']

type ScaleName = 'moodScore' | 'energy' | 'anxiety' | 'sleep' | 'stress' | 'selfEsteem' | 'irritability' | 'overload'

interface DiaryDetailsDrawerProps {
  isEssential: boolean
  isPlus: boolean
  isFree: boolean
  fieldOn: (key: string) => boolean
  touched: Set<string>
  values: Record<ScaleName, number>
  onScaleChange: (name: ScaleName, value: number) => void
  onScaleClear: (name: ScaleName) => void
  emotions: string[]
  contexts: string[]
  needs: string[]
  careActions: string[]
  triggers: string[]
  onToggleEmotion: (tag: string) => void
  onToggleContext: (tag: string) => void
  onToggleNeed: (tag: string) => void
  onToggleCareAction: (tag: string) => void
  onToggleTrigger: (tag: string) => void
  plusDetailsOpen: boolean
  onTogglePlusDetails: () => void
  onClose: () => void
}

type DisclosureProps = {
  title: string
  description: string
  open: boolean
  count?: number
  onToggle: () => void
  children: React.ReactNode
}

function Disclosure({ title, description, open, count = 0, onToggle, children }: DisclosureProps) {
  return (
    <section className="rounded-2xl border border-line bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-mint/20 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-forest-900">{title}</p>
            {count > 0 && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-medium text-forest-700">{count} marcado{count === 1 ? '' : 's'}</span>}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-forest-600" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-forest-600" />}
      </button>
      {open && <div className="border-t border-line/70 bg-paper-soft/50 p-4">{children}</div>}
    </section>
  )
}

function SummaryPill({ label }: { label: string }) {
  return <span className="rounded-full border border-forest-100 bg-white px-2.5 py-1 text-[11px] text-forest-700">{label}</span>
}

export default function DiaryDetailsDrawer({
  isEssential, isPlus, isFree, fieldOn, touched, values,
  onScaleChange, onScaleClear, emotions, contexts, needs, careActions, triggers,
  onToggleEmotion, onToggleContext, onToggleNeed, onToggleCareAction, onToggleTrigger,
  plusDetailsOpen, onTogglePlusDetails, onClose,
}: DiaryDetailsDrawerProps) {
  const dialogRef = useModalA11y(onClose)
  const [signalsOpen, setSignalsOpen] = useState(false)
  const [feelingsOpen, setFeelingsOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [careOpen, setCareOpen] = useState(false)

  const selected = useMemo(() => [
    ...emotions.map(item => `Sentimento · ${item}`),
    ...contexts.map(item => `Contexto · ${item}`),
    ...needs.map(item => `Necessidade · ${item}`),
    ...careActions.map(item => `Cuidado · ${item}`),
    ...triggers.map(item => `Gatilho · ${item}`),
  ], [emotions, contexts, needs, careActions, triggers])

  const signalCount = ['energy', 'sleep'].filter(key => touched.has(key)).length

  return (
    <>
      <button type="button" aria-label="Fechar detalhes opcionais" className="fixed inset-0 z-40 cursor-default bg-forest-950/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diary-details-title"
        className="fixed inset-x-3 bottom-3 z-50 max-h-[88vh] overflow-y-auto rounded-[2rem] border border-line bg-paper-soft shadow-2xl outline-none md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:w-[min(760px,calc(100vw-3rem))] md:max-h-[88vh] md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <div className="sticky top-0 z-10 border-b border-line bg-paper-soft/95 px-5 py-5 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-forest-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Informações opcionais</p>
              <h2 id="diary-details-title" className="mt-1 font-serif text-2xl sm:text-3xl text-forest-900">Informações do registro</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">Seu texto continua sendo a parte principal. Abra somente os grupos que realmente ajudam a dar contexto ao que você escreveu. Nada aqui é obrigatório.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl border border-line bg-white p-2 text-ink-soft hover:text-forest-900"><X className="h-4 w-4" /></button>
          </div>

          {selected.length > 0 && (
            <div className="mt-4 rounded-2xl border border-forest-100 bg-mint/30 p-3.5">
              <div className="flex items-center gap-2 text-xs font-medium text-forest-800"><CircleDot className="h-3.5 w-3.5" /> Já adicionado ao registro</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.slice(0, 8).map(item => <SummaryPill key={item} label={item} />)}
                {selected.length > 8 && <SummaryPill label={`+${selected.length - 8} outros`} />}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          {isEssential && (fieldOn('energy') || fieldOn('sleep_quality')) && (
            <Disclosure
              title="Como esse momento apareceu em você?"
              description="Energia e sono ficam recolhidos até você decidir registrar esses sinais."
              open={signalsOpen}
              count={signalCount}
              onToggle={() => setSignalsOpen(value => !value)}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldOn('energy') && <SliderField label="Energia" value={values.energy} touched={touched.has('energy')} onChange={value => onScaleChange('energy', value)} onClear={() => onScaleClear('energy')} />}
                {fieldOn('sleep_quality') && <SliderField label="Sono" value={values.sleep} touched={touched.has('sleep')} onChange={value => onScaleChange('sleep', value)} onClear={() => onScaleClear('sleep')} />}
              </div>
            </Disclosure>
          )}

          <Disclosure
            title="Sentimentos"
            description="Só abra se quiser nomear algo que apareceu neste momento."
            open={feelingsOpen}
            count={emotions.length}
            onToggle={() => setFeelingsOpen(value => !value)}
          >
            <TagGroup title="Quais sentimentos apareceram?" description="Só marque se fizer sentido." options={isFree ? freeEmotionalTags : emotionalTags} selected={emotions} onToggle={onToggleEmotion} />
          </Disclosure>

          {isEssential && (
            <Disclosure
              title="Quer acrescentar contexto?"
              description="Onde isso apareceu e o que pode estar fazendo falta agora."
              open={contextOpen}
              count={contexts.length + needs.length}
              onToggle={() => setContextOpen(value => !value)}
            >
              <div className="space-y-4">
                <TagGroup title="Onde isso apareceu?" options={contextTags} selected={contexts} onToggle={onToggleContext} category="context" />
                <TagGroup title="O que você sente que precisa agora?" options={needTags} selected={needs} onToggle={onToggleNeed} category="need" />
              </div>
            </Disclosure>
          )}

          {isEssential && (
            <Disclosure
              title="O que pode ajudar um pouco?"
              description="Possibilidades de cuidado, não uma lista de tarefas."
              open={careOpen}
              count={careActions.length}
              onToggle={() => setCareOpen(value => !value)}
            >
              <TagGroup title="Possibilidades para este momento" description="Escolha somente se alguma delas fizer sentido." options={careTags} selected={careActions} onToggle={onToggleCareAction} category="care_action" />
            </Disclosure>
          )}

          {isPlus && (
            <section className="rounded-2xl border border-forest-100 bg-linen/35 overflow-hidden">
              <button type="button" aria-label="Sinais mais específicos — quero refletir mais sobre este registro" onClick={onTogglePlusDetails} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left" aria-expanded={plusDetailsOpen}>
                <div>
                  <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-forest-600" /><p className="text-sm font-semibold text-forest-900">Sinais mais específicos</p>{triggers.length > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-forest-700">{triggers.length} gatilho{triggers.length === 1 ? '' : 's'}</span>}</div>
                  <p className="mt-0.5 text-xs text-ink-soft">Aprofundamento opcional do Plus, mantido fora da leitura principal.</p>
                </div>
                {plusDetailsOpen ? <ChevronUp className="h-4 w-4 text-forest-600" /> : <ChevronDown className="h-4 w-4 text-forest-600" />}
              </button>
              {plusDetailsOpen && (
                <div className="border-t border-forest-100 bg-white/70 p-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SliderField label="Estresse" value={values.stress} touched={touched.has('stress')} onChange={value => onScaleChange('stress', value)} onClear={() => onScaleClear('stress')} />
                    <SliderField label="Autoestima" value={values.selfEsteem} touched={touched.has('selfEsteem')} onChange={value => onScaleChange('selfEsteem', value)} onClear={() => onScaleClear('selfEsteem')} />
                    <SliderField label="Irritabilidade" value={values.irritability} touched={touched.has('irritability')} onChange={value => onScaleChange('irritability', value)} onClear={() => onScaleClear('irritability')} />
                    <SliderField label="Sobrecarga" value={values.overload} touched={touched.has('overload')} onChange={value => onScaleChange('overload', value)} onClear={() => onScaleClear('overload')} />
                  </div>
                  <TagGroup title="Gatilhos que você reconhece" options={triggerTags} selected={triggers} onToggle={onToggleTrigger} category="advanced" />
                </div>
              )}
            </section>
          )}

          <div className="rounded-2xl border border-line bg-white px-4 py-3 flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-mint text-forest-600"><Heart className="h-4 w-4" /></span>
            <p className="text-xs leading-relaxed text-ink-soft">Você não precisa preencher tudo para que o registro tenha valor. Estes campos existem apenas para complementar a escrita quando fizer sentido.</p>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-line bg-paper-soft/95 px-5 py-4 backdrop-blur sm:px-6">
          <button type="button" onClick={onClose} className="w-full rounded-2xl bg-forest-900 px-4 py-3 text-sm font-medium text-white hover:bg-forest-800 transition-colors">Voltar ao meu registro</button>
        </div>
      </div>
    </>
  )
}
