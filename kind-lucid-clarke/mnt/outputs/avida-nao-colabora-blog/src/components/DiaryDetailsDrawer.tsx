import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
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

export default function DiaryDetailsDrawer({
  isEssential, isPlus, isFree, fieldOn, touched, values,
  onScaleChange, onScaleClear, emotions, contexts, needs, careActions, triggers,
  onToggleEmotion, onToggleContext, onToggleNeed, onToggleCareAction, onToggleTrigger,
  plusDetailsOpen, onTogglePlusDetails, onClose,
}: DiaryDetailsDrawerProps) {
  const dialogRef = useModalA11y(onClose)
  const [contextOpen, setContextOpen] = useState(false)
  const [careOpen, setCareOpen] = useState(false)

  return (
    <>
      <button type="button" aria-label="Fechar detalhes opcionais" className="fixed inset-0 z-40 cursor-default bg-forest-950/20 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diary-details-title"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[84vh] overflow-y-auto rounded-t-[2rem] border border-line bg-white p-5 shadow-2xl outline-none sm:p-6 md:inset-y-0 md:left-auto md:right-0 md:w-[min(520px,92vw)] md:max-h-none md:rounded-none md:rounded-l-[2rem]"
      >
        <div className="sticky top-0 z-10 -mx-1 mb-5 flex items-start justify-between gap-4 bg-white/95 px-1 pb-3 backdrop-blur">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-forest-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Opcional</p>
            <h2 id="diary-details-title" className="mt-1 font-serif text-2xl text-forest-900">Detalhes do seu registro</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">Preencha apenas o que ajudar. Nada aqui é obrigatório e seu texto continua sendo a parte principal.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl border border-line p-2 text-ink-soft hover:text-forest-900"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 pb-3">
          {isEssential && (fieldOn('energy') || fieldOn('sleep_quality')) && (
            <section className="rounded-2xl border border-line/70 bg-linen/15 p-4">
              <h3 className="text-sm font-semibold text-forest-900">Como esse momento apareceu em você?</h3>
              <p className="mt-1 text-xs text-ink-soft">Se for útil, você pode registrar estes sinais.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {fieldOn('energy') && <SliderField label="Energia" value={values.energy} touched={touched.has('energy')} onChange={value => onScaleChange('energy', value)} onClear={() => onScaleClear('energy')} />}
                {fieldOn('sleep_quality') && <SliderField label="Sono" value={values.sleep} touched={touched.has('sleep')} onChange={value => onScaleChange('sleep', value)} onClear={() => onScaleClear('sleep')} />}
              </div>
            </section>
          )}

          <TagGroup title="Quais sentimentos apareceram?" description="Só marque se fizer sentido." options={isFree ? freeEmotionalTags : emotionalTags} selected={emotions} onToggle={onToggleEmotion} />

          {isEssential && (
            <section className="rounded-2xl border border-line bg-white p-4">
              <button type="button" onClick={() => setContextOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={contextOpen}>
                <div>
                  <p className="text-sm font-semibold text-forest-900">Quer acrescentar contexto?</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Onde isso apareceu e o que pode estar fazendo falta agora.</p>
                </div>
                {contextOpen ? <ChevronUp className="h-4 w-4 text-forest-600" /> : <ChevronDown className="h-4 w-4 text-forest-600" />}
              </button>
              {contextOpen && <div className="mt-4 space-y-3"><TagGroup title="Onde isso apareceu?" options={contextTags} selected={contexts} onToggle={onToggleContext} category="context" /><TagGroup title="O que você sente que precisa agora?" options={needTags} selected={needs} onToggle={onToggleNeed} category="need" /></div>}
            </section>
          )}

          {isEssential && (
            <section className="rounded-2xl border border-line bg-white p-4">
              <button type="button" onClick={() => setCareOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={careOpen}>
                <div>
                  <p className="text-sm font-semibold text-forest-900">O que pode ajudar um pouco?</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Possibilidades de cuidado, não uma lista de tarefas.</p>
                </div>
                {careOpen ? <ChevronUp className="h-4 w-4 text-forest-600" /> : <ChevronDown className="h-4 w-4 text-forest-600" />}
              </button>
              {careOpen && <div className="mt-4"><TagGroup title="Possibilidades para este momento" description="Escolha somente se alguma delas fizer sentido." options={careTags} selected={careActions} onToggle={onToggleCareAction} category="care_action" /></div>}
            </section>
          )}

          {isPlus && (
            <div className="rounded-2xl border border-forest-100 bg-linen/40 p-4">
              <button type="button" aria-label="Sinais mais específicos — quero refletir mais sobre este registro" onClick={onTogglePlusDetails} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={plusDetailsOpen}>
                <div><p className="text-sm font-semibold text-forest-900">Sinais mais específicos</p><p className="mt-0.5 text-xs text-ink-soft">Se forem úteis, você pode acrescentar estes sinais.</p></div>
                {plusDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {plusDetailsOpen && (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SliderField label="Estresse" value={values.stress} touched={touched.has('stress')} onChange={value => onScaleChange('stress', value)} onClear={() => onScaleClear('stress')} />
                    <SliderField label="Autoestima" value={values.selfEsteem} touched={touched.has('selfEsteem')} onChange={value => onScaleChange('selfEsteem', value)} onClear={() => onScaleClear('selfEsteem')} />
                    <SliderField label="Irritabilidade" value={values.irritability} touched={touched.has('irritability')} onChange={value => onScaleChange('irritability', value)} onClear={() => onScaleClear('irritability')} />
                    <SliderField label="Sobrecarga" value={values.overload} touched={touched.has('overload')} onChange={value => onScaleChange('overload', value)} onClear={() => onScaleClear('overload')} />
                  </div>
                  <TagGroup title="Gatilhos que você reconhece" options={triggerTags} selected={triggers} onToggle={onToggleTrigger} category="advanced" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-1 mt-5 bg-white/95 px-1 pt-3 backdrop-blur"><button type="button" onClick={onClose} className="w-full rounded-2xl bg-forest-900 px-4 py-3 text-sm font-medium text-white">Concluir detalhes</button></div>
      </div>
    </>
  )
}
