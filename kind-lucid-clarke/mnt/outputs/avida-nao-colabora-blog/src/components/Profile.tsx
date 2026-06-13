import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Profile as ProfileType } from '../types'
import { ArrowLeft, Camera, Crown, CreditCard, TrendingUp } from 'lucide-react'

interface ProfileProps {
  user: any
  profile: ProfileType | null
  onBack: () => void
  onNavigatePricing: () => void
  onRefreshProfile: () => void
}

const planInfo: Record<string, { label: string; color: string; price: string }> = {
  free: { label: 'Gratuito', color: 'bg-sand-100 text-sand-700', price: 'R$ 0' },
  essential: { label: 'Essencial', color: 'bg-sage-100 text-sage-700', price: 'R$ 19,90/mês' },
  therapeutic: { label: 'Terapêutico', color: 'bg-ocean-100 text-ocean-700', price: 'R$ 39,90/mês' },
}

export default function ProfilePage({ user, profile, onBack, onNavigatePricing, onRefreshProfile }: ProfileProps) {
  const [name, setName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const fileRef = useRef<HTMLInputElement>(null)
  const [success, setSuccess] = useState('')

  const handleSaveName = async () => {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    setSuccess('Nome atualizado!')
    setTimeout(() => setSuccess(''), 3000)
    onRefreshProfile()
    setSaving(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id)
      setAvatarUrl(url)
      onRefreshProfile()
    }
    setUploadingAvatar(false)
  }

  const plan = profile?.plan || 'free'
  const planDetails = planInfo[plan]

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="font-serif text-3xl text-sage-800 mb-6">Meu Perfil</h1>

      {/* Avatar */}
      <div className="bg-white border border-sand-200 rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-sage-100 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-3xl text-sage-400">{name?.charAt(0) || '?'}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 w-7 h-7 bg-sage-600 hover:bg-sage-700 text-white rounded-full flex items-center justify-center shadow-md"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sage-800">{profile?.full_name || 'Usuário'}</p>
            <p className="text-sm text-sage-400">{user.email}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${planDetails.color}`}>
              {planDetails.label}
            </span>
          </div>
        </div>
      </div>

      {/* Edit name */}
      <div className="bg-white border border-sand-200 rounded-2xl p-6 mb-4">
        <h3 className="font-semibold text-sage-700 mb-3 text-sm">Nome de exibição</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Como prefere ser chamado(a)?"
            className="flex-1 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
          <button
            onClick={handleSaveName}
            disabled={saving}
            className="bg-sage-600 hover:bg-sage-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? '...' : 'Salvar'}
          </button>
        </div>
        {success && <p className="text-sage-600 text-xs mt-2">{success}</p>}
      </div>

      {/* Subscription */}
      <div className="bg-white border border-sand-200 rounded-2xl p-6 mb-4">
        <h3 className="font-semibold text-sage-700 mb-4 text-sm flex items-center gap-2">
          <Crown className="w-4 h-4 text-sand-500" /> Assinatura
        </h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-sage-800">{planDetails.label}</p>
            <p className="text-sm text-sage-400">{planDetails.price}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${planDetails.color}`}>Ativo</span>
        </div>

        {plan !== 'therapeutic' && (
          <button
            onClick={onNavigatePricing}
            className="w-full flex items-center justify-center gap-2 border border-sage-300 text-sage-700 hover:bg-sage-50 text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            <TrendingUp className="w-4 h-4" /> Ver planos e fazer upgrade
          </button>
        )}

        {plan !== 'free' && (
          <button className="mt-2 w-full flex items-center justify-center gap-2 text-sage-400 hover:text-sage-600 text-xs py-2">
            <CreditCard className="w-3.5 h-3.5" /> Gerenciar cobrança
          </button>
        )}
      </div>

      {/* Account */}
      <div className="bg-white border border-sand-200 rounded-2xl p-6">
        <h3 className="font-semibold text-sage-700 mb-3 text-sm">Conta</h3>
        <p className="text-sm text-sage-500">E-mail: {user.email}</p>
        <p className="text-xs text-sage-400 mt-1">
          Membro desde {new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
