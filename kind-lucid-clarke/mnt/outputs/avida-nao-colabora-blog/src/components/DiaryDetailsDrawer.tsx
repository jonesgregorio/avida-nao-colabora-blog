import { BatteryCharging, BriefcaseBusiness, ChevronDown, ChevronUp, Heart, Sparkles, Target, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useModalA11y } from '../hooks/useModalA11y'
import { SliderField, TagGroup } from './DiaryFormFields'

const emotionalTags = ['ansiedade','medo','preocupação','insegurança','tristeza','desânimo','solidão','culpa','irritação','raiva','frustração','cansaço','sobrecarga','confusão','calma','esperança','alegria','gratidão']
const freeEmotionalTags = ['ansiedade','tristeza','cansaço','sobrecarga','calma','gratidão']
const contextTags = ['trabalho','estudos','família','relacionamento','saúde','casa','dinheiro','amizades','vida pessoal','rotina','futuro','autoimagem','sono','alimentação']
const needTags = ['descanso','acolhimento','organização','clareza','conversa','limite','ajuda','pausa','leveza','segurança','coragem','paciência','presença','menos cobrança']
const careTags = ['tomar banho','beber água','respirar','ouvir música','caminhar','dormir mais cedo','conversar com alguém','organizar uma tarefa','ficar em silêncio','escrever mais','ver um conteúdo guiado','reduzir redes sociais','fazer uma pausa','comer algo leve','pedir ajuda']

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

type SectionProps = {
  number: number
  icon: React.ReactNode
  title: string
  description: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function DetailSection({ number, icon, title, description, open, onToggle, children }: SectionProps) {
  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-line bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-semibold text-forest-800">{number}</span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint/70 text-forest-700">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-forest-900">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{description}</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-forest-600" /> : <ChevronDown className="h-4 w-4 shrink-0 text-forest-600" />}
      </button>
      {open && <div className="border-t border-line/70 px-4 py-4 sm:px-5">{children}</div>}
    </section>
  )
}

export default function DiaryDetailsDrawer(props: DiaryDetailsDrawerProps) {
  const {
    isEssential, isFree, fieldOn, touched, values, onScaleChange, onScaleClear,
    emotions, contexts, needs, careActions,
    onToggleEmotion, onToggleContext, onToggleNeed, onToggleCareAction, onClose,
  } = props
  const dialogRef = useModalA11y(onClose)
  const [energyOpen, setEnergyOpen] = useState(true)
  const [feelingsOpen, setFeelingsOpen] = useState(true)
  const [contextOpen, setContextOpen] = useState(false)
  const [needsOpen, setNeedsOpen] = useState(false)
  const [careOpen, setCareOpen] = useState(false)
  const selectedCount = useMemo(
    () => emotions.length + contexts.length + needs.length + careActions.length,
    [emotions, contexts, needs, careActions],
  )

  return (
    <>
      <button type="button" aria-label="Fechar detalhes opcionais" className="fixed inset-0 z-40 cursor-default bg-forest-950/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diary-details-title"
        className="fixed inset-x-3 bottom-3 z-50 max-h-[90vh] overflow-y-auto rounded-[2rem] border border-line bg-paper-soft shadow-2xl outline-none md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:w-[min(860px,calc(100vw-3rem))] md:max-h-[90vh] md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <div className="sticky top-0 z-10 border-b border-line bg-paper-soft/95 px-5 py-5 backdrop-blur sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-700">Adicionar mais detalhes (opcional)</p>
              <h2 id="diary-details-title" className="mt-2 font-serif text-3xl text-forest-900 sm:text-4xl">Informações do registro</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">Esses detalhes podem te ajudar a entender melhor como foi o seu dia. Preencha apenas se fizer sentido.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="min-h-11 min-w-11 rounded-2xl border border-line bg-white p-2.5 text-ink-soft hover:text-forest-900"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-forest-900">Não é obrigatório. Escolha apenas o que fizer sentido agora.</p>
              <p className="mt-0.5 text-xs text-ink-soft">Você sempre pode voltar e ajustar depois.{selectedCount > 0 ? ` ${selectedCount} item${selectedCount === 1 ? '' : 's'} selecionado${selectedCount === 1 ? '' : 's'}.` : ''}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-7">
          {isEssential && (fieldOn('energy') || fieldOn('sleep_quality')) && (
            <DetailSection number={1} icon={<BatteryCharging className="h-5 w-5" />} title="Energia e sono" description="Como está seu nível de energia e a qualidade do seu sono." open={energyOpen} onToggle={() => setEnergyOpen(v => !v)}>
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldOn('energy') && <SliderField label="Energia" value={values.energy} touched={touched.has('energy')} onChange={v => onScaleChange('energy', v)} onClear={() => onScaleClear('energy')} />}
                {fieldOn('sleep_quality') && <SliderField label="Sono" value={values.sleep} touched={touched.has('sleep')} onChange={v => onScaleChange('sleep', v)} onClear={() => onScaleClear('sleep')} />}
              </div>
            </DetailSection>
          )}

          <DetailSection number={isEssential ? 2 : 1} icon={<Heart className="h-5 w-5" />} title="Sentimentos principais" description="Marque até 5 sentimentos que mais representam este momento." open={feelingsOpen} onToggle={() => setFeelingsOpen(v => !v)}>
            <TagGroup title="O que apareceu por aí?" description="Escolha só o que chegar mais perto do que você sentiu." options={isFree ? freeEmotionalTags : emotionalTags} selected={emotions} onToggle={onToggleEmotion} allowCustom uniformLight maxSelected={5} />
          </DetailSection>

          {isEssential && (
            <DetailSection number={3} icon={<BriefcaseBusiness className="h-5 w-5" />} title="Contexto do dia" description="O que esteve mais presente hoje na sua rotina?" open={contextOpen} onToggle={() => setContextOpen(v => !v)}>
              <TagGroup title="Onde isso apareceu?" options={contextTags} selected={contexts} onToggle={onToggleContext} category="context" allowCustom neutralLight />
            </DetailSection>
          )}

          {isEssential && (
            <DetailSection number={4} icon={<Target className="h-5 w-5" />} title="O que você precisa agora?" description="Escolha o que mais pode te apoiar neste momento." open={needsOpen} onToggle={() => setNeedsOpen(v => !v)}>
              <TagGroup title="O que faria sentido agora?" options={needTags} selected={needs} onToggle={onToggleNeed} category="need" allowCustom neutralLight />
            </DetailSection>
          )}

          {isEssential && (
            <DetailSection number={5} icon={<Heart className="h-5 w-5" />} title="O que pode ajudar um pouco?" description="Possibilidades de cuidado, não uma lista de tarefas." open={careOpen} onToggle={() => setCareOpen(v => !v)}>
              <TagGroup title="Possibilidades para este momento" options={careTags} selected={careActions} onToggle={onToggleCareAction} category="care_action" allowCustom neutralLight />
            </DetailSection>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-forest-600"><Heart className="h-4 w-4" /></span>
            <p className="text-xs leading-relaxed text-ink-soft">Essas informações são só para você e complementam sua escrita. Você ainda tem total liberdade para escrever o que quiser.</p>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-line bg-paper-soft/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={onClose} aria-label="Salvar detalhes. Voltar ao meu registro" className="w-full rounded-2xl bg-forest-900 px-4 py-3.5 text-sm font-medium text-white hover:bg-forest-800 sm:ml-auto sm:block sm:w-auto sm:min-w-52">Salvar detalhes</button>
        </div>
      </div>
    </>
  )
}
