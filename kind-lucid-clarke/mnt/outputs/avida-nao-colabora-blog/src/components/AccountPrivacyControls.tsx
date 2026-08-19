import { useState } from 'react'
import { Download, Loader2, ShieldCheck, Trash2, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

interface Props {
  user: User | null
  profile: Profile | null
}

async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context
  if (context) {
    try {
      const body = await context.clone().json() as { error?: string }
      if (body?.error) return body.error
    } catch {
      // Mantém mensagem amigável abaixo.
    }
  }
  return fallback
}

export default function AccountPrivacyControls({ user, profile }: Props) {
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isAdmin = profile?.role === 'admin'

  async function handleExport() {
    if (!user) return
    setExporting(true)
    setExportMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        body: {},
      })
      if (error) {
        throw new Error(await functionErrorMessage(error, 'Não foi possível preparar seus dados agora.'))
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `a-vida-nao-colabora-meus-dados-${date}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportMsg('Exportação preparada e baixada com sucesso.')
    } catch (error) {
      setExportMsg((error as Error).message || 'Não foi possível exportar seus dados agora.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (!user || deleting) return
    setDeleteError('')
    if (confirmation !== 'EXCLUIR') {
      setDeleteError('Digite EXCLUIR exatamente como mostrado.')
      return
    }
    if (!password) {
      setDeleteError('Informe sua senha atual para confirmar.')
      return
    }

    setDeleting(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation, password },
      })
      if (error) {
        throw new Error(await functionErrorMessage(error, 'Não foi possível excluir sua conta agora.'))
      }
      if (!data?.ok) throw new Error('Não foi possível confirmar a exclusão da conta.')

      // Remove o JWT local imediatamente. O backend já fez o hard delete no Auth.
      await supabase.auth.signOut().catch(() => undefined)
      window.location.assign('/')
    } catch (error) {
      setDeleteError((error as Error).message || 'Não foi possível excluir sua conta agora.')
      setDeleting(false)
    }
  }

  return (
    <section className="bg-paper-soft border border-line rounded-3xl p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-700 flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div>
          <h2 className="font-serif text-lg sm:text-xl text-forest-900">Privacidade e seus dados</h2>
          <p className="text-sm text-ink-soft mt-1 leading-relaxed">
            Baixe uma cópia dos dados vinculados à sua conta ou solicite a exclusão definitiva diretamente por aqui.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-forest-900 text-sm">Exportar meus dados</p>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                Gera um arquivo JSON com perfil, diário, check-ins, questionários, relatórios, planos, orientações, preferências, suporte, histórico de uso e cobrança relacionados à sua conta.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || !user}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-forest-200 text-forest-800 bg-mint/30 hover:bg-mint/60 text-sm font-medium disabled:opacity-50 flex-shrink-0"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Preparando…' : 'Baixar meus dados'}
            </button>
          </div>
          {exportMsg && <p className="text-xs text-ink-soft mt-3">{exportMsg}</p>}
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-red-700 text-sm">Excluir minha conta</p>
              <p className="text-xs text-red-700/80 mt-1 leading-relaxed">
                Remove sua conta e os dados pessoais do aplicativo. Se houver cadastro de cobrança no Stripe, ele é encerrado para impedir novas cobranças.
              </p>
              {isAdmin && (
                <p className="text-xs text-red-700 mt-2 font-medium">
                  Contas administrativas não podem ser excluídas por autoatendimento.
                </p>
              )}
            </div>
            <button
              onClick={() => { setShowDelete(true); setDeleteError('') }}
              disabled={isAdmin || !user}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 bg-white hover:bg-red-50 text-sm font-medium disabled:opacity-50 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" /> Excluir conta
            </button>
          </div>
        </div>
      </div>

      {showDelete && !isAdmin && (
        <div className="fixed inset-0 z-[100] bg-black/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-line shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="delete-account-title" className="font-serif text-2xl text-forest-900">Excluir conta definitivamente</h3>
                <p className="text-sm text-ink-soft mt-2 leading-relaxed">Esta ação não pode ser desfeita.</p>
              </div>
              <button
                onClick={() => !deleting && setShowDelete(false)}
                disabled={deleting}
                aria-label="Fechar"
                className="p-1.5 rounded-lg text-ink-soft hover:bg-paper disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 leading-relaxed">
              <ul className="space-y-2 list-disc pl-5">
                <li>Diário, check-ins, questionários, relatórios, planos, orientações e demais dados pessoais do aplicativo serão removidos.</li>
                <li>Seu avatar armazenado será removido.</li>
                <li>Se existir cliente/assinatura no Stripe, o cadastro de cobrança será encerrado para impedir novas cobranças.</li>
                <li>Registros que provedores precisem conservar por obrigação legal, segurança ou auditoria podem seguir os prazos aplicáveis fora do aplicativo.</li>
              </ul>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-forest-800 mb-1.5">Senha atual</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-white text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus:border-red-300"
                  placeholder="Digite sua senha atual"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-forest-800 mb-1.5">Digite <strong>EXCLUIR</strong> para confirmar</span>
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-white text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus:border-red-300"
                  placeholder="EXCLUIR"
                />
              </label>

              {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl border border-line text-sm text-ink-soft hover:bg-paper disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || confirmation !== 'EXCLUIR' || !password}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
