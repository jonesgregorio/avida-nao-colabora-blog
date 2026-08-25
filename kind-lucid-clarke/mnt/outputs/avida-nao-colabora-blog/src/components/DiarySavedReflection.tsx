import type { User } from '@supabase/supabase-js'
import { CheckCircle2, Home, Loader2, PenLine, Sparkles } from 'lucide-react'
import type { Plan } from '../types'
import type { DiaryMirror } from '../lib/diaryCompanion'
import type { Signal } from '../lib/contentRecommendation'
import RecommendedContent from './RecommendedContent'
import DiaryTagChip from './DiaryTagChip'

// Extraído de DiaryExperience.tsx (Parte 17 da MISSÃO GERAL): a tela de
// "registro salvo" era um bloco JSX autocontido de ~55 linhas dentro do
// componente principal — recebe só o que já foi calculado/decidido pelo pai,
// sem nenhuma lógica própria de estado, então sai sem alterar comportamento.

export interface SavedState<TEntry extends { mood: string | number }> {
  entry: TEntry
  signal: Signal
  mirror: DiaryMirror | null
  processing: boolean
  kind: 'diary' | 'checkin'
}

export default function DiarySavedReflection<TEntry extends { mood: string | number }>({
  saved, user, plan, isEssential, todayDeepened, suggestionsApplied, onOpenArticle,
  moodMeta, onApplySuggestions, onAskFollowUp, onFinishCheckin, onContinueFromCheckin, onViewHistory, onBack,
}: {
  saved: SavedState<TEntry>
  user: User | null
  plan: Plan
  isEssential: boolean
  todayDeepened: boolean
  suggestionsApplied: boolean
  onOpenArticle?: (slug: string) => void
  moodMeta: (value: string | number | undefined) => { emoji: string; label: string }
  onApplySuggestions: () => void
  onAskFollowUp: () => void
  onFinishCheckin: () => void
  onContinueFromCheckin: () => void
  onViewHistory: () => void
  onBack: () => void
}) {
  const meta = moodMeta(saved.entry.mood)
  const suggestedCount = saved.mirror ? Object.values(saved.mirror.suggested_tags).reduce((sum, arr) => sum + arr.length, 0) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-mint flex items-center justify-center mx-auto"><CheckCircle2 className="w-7 h-7 text-forest-700" /></div>
        <h1 className="font-serif text-3xl text-forest-900 mt-5">{saved.kind === 'checkin' ? 'Check-in registrado' : 'Seu registro ficou guardado'}</h1>
        <p className="text-ink-soft mt-2">{saved.kind === 'checkin' ? 'Você registrou como está agora. Quer deixar assim ou escrever um pouco mais?' : 'Você não precisava resolver nada. Colocar em palavras já foi suficiente por hoje.'}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm"><span>{meta.emoji}</span><span>{meta.label}</span></div>
      </div>

      {saved.kind === 'diary' && saved.processing && (
        <div className="mt-8 rounded-3xl border border-line bg-paper-soft p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-forest-600" /><p className="text-sm text-ink-soft mt-3">Lendo seu registro com cuidado para devolver um espelho curto…</p></div>
      )}

      {saved.kind === 'diary' && !saved.processing && saved.mirror && (
        <section className="mt-8 rounded-3xl border border-forest-100 bg-mint/35 p-5 sm:p-7">
          <div className="flex items-start gap-3"><Sparkles className="w-5 h-5 text-forest-600 mt-1" /><div><p className="text-xs uppercase tracking-[0.16em] text-forest-600 font-semibold">O que apareceu no seu registro</p><h2 className="font-serif text-2xl text-forest-900 mt-1">{saved.mirror.title}</h2></div></div>
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-white/80 border border-line p-4"><p className="text-xs font-semibold text-forest-700">O que ganhou espaço</p><p className="text-sm text-ink mt-2 leading-relaxed">{saved.mirror.weight}</p></div>
            <div className="rounded-2xl bg-white/80 border border-line p-4"><p className="text-xs font-semibold text-forest-700">Algo para observar</p><p className="text-sm text-ink mt-2 leading-relaxed">{saved.mirror.observation}</p></div>
            <div className="rounded-2xl bg-white/80 border border-line p-4"><p className="text-xs font-semibold text-forest-700">Algo que você fez por si</p><p className="text-sm text-ink mt-2 leading-relaxed">{saved.mirror.strength}</p></div>
          </div>
          {saved.mirror.pattern && <div className="mt-3 rounded-2xl border border-line bg-white/70 p-4"><p className="text-xs font-semibold text-forest-700">Recorrência para observar</p><p className="text-sm text-ink-soft mt-1">{saved.mirror.pattern}</p></div>}
          <div className="mt-4 rounded-2xl bg-forest-900 text-white p-5"><p className="text-xs text-forest-100">Uma pergunta para levar com você</p><p className="font-serif text-xl mt-1">{saved.mirror.question}</p></div>
          <p className="text-[11px] text-ink-soft mt-3">Leitura automática de autopercepção. Não é diagnóstico nem substitui acompanhamento profissional.</p>
        </section>
      )}

      {saved.kind === 'diary' && !saved.processing && !saved.mirror && <div className="mt-8 rounded-2xl border border-line bg-paper-soft p-5 text-sm text-ink-soft">Este registro foi salvo sem análise de IA, como você escolheu.</div>}

      {suggestedCount > 0 && saved.mirror && (
        <section className="mt-5 rounded-3xl border border-line bg-white p-5">
          <h3 className="font-serif text-xl text-forest-900">A IA percebeu algumas marcações possíveis</h3>
          <p className="text-sm text-ink-soft mt-1">Elas só entram no seu mapa e nos relatórios se você confirmar.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {saved.mirror.suggested_tags.emotions.map(t => <DiaryTagChip key={`e-${t}`} label={t} selected />)}
            {saved.mirror.suggested_tags.contexts.map(t => <DiaryTagChip key={`c-${t}`} label={t} category="context" selected />)}
            {saved.mirror.suggested_tags.needs.map(t => <DiaryTagChip key={`n-${t}`} label={t} category="need" selected />)}
            {saved.mirror.suggested_tags.care_actions.map(t => <DiaryTagChip key={`a-${t}`} label={t} category="care_action" selected />)}
            {saved.mirror.suggested_tags.triggers.map(t => <DiaryTagChip key={`t-${t}`} label={t} category="advanced" selected />)}
          </div>
          <button type="button" disabled={suggestionsApplied} onClick={onApplySuggestions} className="mt-4 rounded-xl bg-forest-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60">{suggestionsApplied ? 'Marcações confirmadas' : 'Confirmar estas marcações'}</button>
        </section>
      )}

      {onOpenArticle && <div className="mt-6"><RecommendedContent user={user ? { id: user.id } : null} profile={{ plan }} signal={saved.signal} source={saved.kind === 'checkin' ? 'checkin' : 'diary'} limit={2} variant="compact" title="Conteúdos que podem fazer sentido agora" description="Sugestões relacionadas ao que você acabou de registrar." onOpen={onOpenArticle} /></div>}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {saved.kind === 'checkin' && <><button onClick={onFinishCheckin} className="rounded-2xl border border-line bg-white px-5 py-2.5 text-sm font-medium text-forest-900">Concluir</button><button onClick={onContinueFromCheckin} className="rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2"><PenLine className="w-4 h-4" /> Quero escrever sobre isso</button></>}
        {saved.kind === 'diary' && isEssential && !todayDeepened && <button onClick={onAskFollowUp} className="rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> {saved.mirror ? 'Quero responder à pergunta' : 'Quero aprofundar meu registro'}</button>}
        <button onClick={onViewHistory} className="rounded-2xl border border-line bg-white px-5 py-2.5 text-sm font-medium text-forest-900">Ver meus registros</button>
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-ink-soft inline-flex items-center gap-1.5"><Home className="w-4 h-4" /> Início</button>
      </div>
    </div>
  )
}
