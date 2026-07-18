import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Loader2, Check } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface Props { user: User | null }

// Espelha as colunas de user_notification_preferences (095). Modelo opt-out:
// ausência de linha = tudo ligado.
interface Prefs {
  email_enabled: boolean
  receive_selfcare_reminders: boolean
  receive_report_reminders: boolean
  receive_care_plan_reminders: boolean
  receive_product_updates: boolean
}

const PADRAO: Prefs = {
  email_enabled: true,
  receive_selfcare_reminders: true,
  receive_report_reminders: true,
  receive_care_plan_reminders: true,
  receive_product_updates: true,
}

// Preferências de e-mail (§6). Só cobre os lembretes de autocuidado e avisos do
// produto — e-mails transacionais (pagamento, assinatura, segurança) NÃO estão
// aqui e não podem ser desligados por engano.
export default function EmailPreferences({ user }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(PADRAO)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from('user_notification_preferences')
        .select('email_enabled, receive_selfcare_reminders, receive_report_reminders, receive_care_plan_reminders, receive_product_updates')
        .eq('user_id', user.id).maybeSingle()
      if (!vivo) return
      if (data) setPrefs({ ...PADRAO, ...(data as Partial<Prefs>) })
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [user])

  async function salvar(next: Prefs) {
    if (!user) return
    setSaving(true); setErro(null)
    // upsert da própria linha (RLS: auth.uid() = user_id).
    const { error } = await supabase.from('user_notification_preferences')
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { setErro('Não foi possível salvar: ' + error.message) }
    else { setSalvo(true); setTimeout(() => setSalvo(false), 2000) }
    setSaving(false)
  }

  function toggle(campo: keyof Prefs) {
    const next = { ...prefs, [campo]: !prefs[campo] }
    setPrefs(next)
    void salvar(next)
  }

  const linha = (campo: keyof Prefs, titulo: string, descricao: string, desabilitado = false) => (
    <label className={`flex items-start gap-3 py-2.5 ${desabilitado ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={prefs[campo]}
        disabled={desabilitado || saving}
        onChange={() => toggle(campo)}
        className="mt-0.5 w-4 h-4 rounded border-stone-300 text-forest-700 focus:ring-forest-500"
      />
      <span>
        <span className="block text-sm text-forest-900">{titulo}</span>
        <span className="block text-xs text-ink-soft">{descricao}</span>
      </span>
    </label>
  )

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-forest-500" /></div>

  const mestreDesligado = !prefs.email_enabled

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Mail size={16} className="text-forest-600" />
        <h3 className="font-medium text-forest-900">Preferências de e-mail</h3>
        {salvo && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> salvo</span>}
      </div>
      <p className="text-xs text-ink-soft mb-3">
        Escolha quais e-mails de acompanhamento você quer receber. E-mails sobre pagamento,
        assinatura e segurança continuam chegando — eles não fazem parte destas opções.
      </p>

      <div className="divide-y divide-line">
        {linha('email_enabled', 'Receber e-mails de acompanhamento',
          'Desligue aqui para pausar todos os e-mails abaixo de uma vez.')}
        {linha('receive_selfcare_reminders', 'Lembretes de autocuidado por e-mail',
          'Enviaremos lembretes leves quando você ficar alguns dias sem registrar como está se sentindo.',
          mestreDesligado)}
        {linha('receive_report_reminders', 'Lembretes sobre relatórios',
          'Avisos quando um check-in rápido pode dar mais contexto ao seu relatório.',
          mestreDesligado)}
        {linha('receive_care_plan_reminders', 'Lembretes sobre o plano de autocuidado',
          'Avisos quando seus registros podem deixar o plano do mês mais conectado a você.',
          mestreDesligado)}
        {linha('receive_product_updates', 'Novidades do produto',
          'Novos conteúdos e melhorias — enviados com moderação.',
          mestreDesligado)}
      </div>

      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
    </div>
  )
}
