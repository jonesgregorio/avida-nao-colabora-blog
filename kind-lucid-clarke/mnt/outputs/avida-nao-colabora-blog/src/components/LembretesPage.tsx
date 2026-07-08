import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { BellRing, Check, NotebookPen, Sprout, BarChart3, LifeBuoy } from 'lucide-react'

interface Props {
  user: User | null
  profile: Profile | null
  onRefreshProfile?: () => void
  onNavigate: (v: string) => void
}

const FREQ = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'never', label: 'Nunca' },
]

const REMINDER_TYPES = [
  { Icon: NotebookPen, title: 'Lembrete do diário', desc: 'Um convite gentil para registrar como você está.' },
  { Icon: Sprout, title: 'Autocuidado', desc: 'Pequenas pausas e práticas ao longo da semana.' },
  { Icon: BarChart3, title: 'Relatório disponível', desc: 'Avisamos quando seu resumo estiver pronto.' },
]

export default function LembretesPage({ profile, onRefreshProfile, onNavigate }: Props) {
  const [freq, setFreq] = useState(profile?.notification_frequency || 'weekly')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(newFreq: string) {
    setFreq(newFreq)
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.rpc('update_my_profile', { p_notification_frequency: newFreq })
    setSaving(false)
    if (!error) {
      setSaved(true)
      if (onRefreshProfile) onRefreshProfile()
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Lembretes <BellRing className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft">Escolha como e com que frequência quer receber lembretes gentis para cuidar de você.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:gap-6">
        <div className="space-y-5 min-w-0">
          <section className="bg-paper-soft border border-line rounded-3xl p-6">
            <h2 className="font-serif text-lg text-forest-900 mb-1">Frequência dos lembretes</h2>
            <p className="text-sm text-ink-soft mb-4">Você pode mudar quando quiser.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FREQ.map(f => (
                <button
                  key={f.value}
                  onClick={() => save(f.value)}
                  disabled={saving}
                  aria-pressed={freq === f.value}
                  className={`rounded-2xl border py-3 text-sm font-medium transition-colors disabled:opacity-60 ${freq === f.value ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {saved && <p className="text-sm text-forest-700 mt-3 flex items-center gap-1"><Check className="w-4 h-4" /> Preferência salva.</p>}
          </section>

          <section className="bg-paper-soft border border-line rounded-3xl p-6">
            <h2 className="font-serif text-lg text-forest-900 mb-4">O que você recebe</h2>
            <div className="space-y-3">
              {REMINDER_TYPES.map(t => (
                <div key={t.title} className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><t.Icon className="w-5 h-5" /></span>
                  <div>
                    <p className="font-medium text-forest-900 text-sm">{t.title}</p>
                    <p className="text-sm text-ink-soft leading-snug">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-line bg-mint/40 p-5">
            <p className="font-serif text-lg text-forest-900">No seu tempo</p>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">Lembretes são só um apoio — nunca uma cobrança. Se preferir silêncio, escolha "Nunca".</p>
          </div>
          <button
            onClick={() => onNavigate('notifications')}
            className="w-full flex items-center justify-center gap-2 border border-line text-forest-700 text-sm font-medium px-4 py-2.5 rounded-2xl hover:bg-mint/50 transition-colors"
          >
            <LifeBuoy className="w-4 h-4" /> Ver notificações
          </button>
        </aside>
      </div>
    </div>
  )
}
