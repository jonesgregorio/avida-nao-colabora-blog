import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Stethoscope, Plus, Search, Pencil, Trash2, X, Save } from 'lucide-react'

interface Professional {
  id: string
  name: string
  specialty: string
  email: string
  phone: string
  bio: string
  active: boolean
  created_at: string
}

const SPECIALTIES = [
  'Psicologia', 'Psiquiatria', 'Terapia Ocupacional',
  'Coaching', 'Nutrição', 'Fisioterapia', 'Outro',
]

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

const empty = (): Omit<Professional, 'id' | 'created_at'> => ({
  name: '', specialty: 'Psicologia', email: '', phone: '', bio: '', active: true,
})

export default function AdminProfessionals() {
  const [list, setList] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(empty())
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tableExists, setTableExists] = useState(true)

  async function load() {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .order('name')
    if (error?.code === '42P01') { setTableExists(false); setLoading(false); return }
    setList(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  function openNew() {
    setForm(empty()); setEditId(null); setShowForm(true)
  }

  function openEdit(p: Professional) {
    setForm({ name: p.name, specialty: p.specialty, email: p.email, phone: p.phone, bio: p.bio, active: p.active })
    setEditId(p.id); setShowForm(true)
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) { showToast('Nome e e-mail são obrigatórios.'); return }
    setSaving(true)
    if (editId) {
      await supabase.from('professionals').update(form).eq('id', editId)
      showToast('Profissional atualizado.')
    } else {
      await supabase.from('professionals').insert(form)
      showToast('Profissional cadastrado.')
    }
    setSaving(false); setShowForm(false); load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remover ${name}?`)) return
    await supabase.from('professionals').delete().eq('id', id)
    showToast('Removido.'); load()
  }

  async function toggleActive(p: Professional) {
    await supabase.from('professionals').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  const filtered = list.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.specialty.toLowerCase().includes(search.toLowerCase())
  )

  if (!tableExists) return (
    <div>
      <h1 className="text-2xl font-bold text-forest-900 mb-6">Parceiros Profissionais</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
        <strong>Tabela não encontrada.</strong> Execute o SQL de migração no Supabase para criar a tabela <code>professionals</code>:
        <pre className="mt-3 bg-amber-100 rounded p-3 text-xs overflow-x-auto">{`CREATE TABLE IF NOT EXISTS professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'Psicologia',
  email TEXT NOT NULL,
  phone TEXT,
  bio TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "professionals_admin" ON professionals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "professionals_read" ON professionals FOR SELECT USING (active = true);`}</pre>
      </div>
    </div>
  )

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-forest-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-forest-900">Parceiros Profissionais</h1>
          <p className="text-stone-400 text-sm mt-1">{list.length} profissional{list.length !== 1 ? 'is' : ''} cadastrado{list.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-forest-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800">
          <Plus className="w-4 h-4" /> Cadastrar profissional
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          placeholder="Buscar por nome ou especialidade…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-forest-900">{editId ? 'Editar profissional' : 'Novo profissional'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-stone-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-500 font-medium mb-1 block">Nome *</label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-medium mb-1 block">Especialidade</label>
                <select className={inputCls} value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}>
                  {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-500 font-medium mb-1 block">E-mail *</label>
                  <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-xs text-stone-500 font-medium mb-1 block">Telefone</label>
                  <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-500 font-medium mb-1 block">Bio / Apresentação</label>
                <textarea className={inputCls} rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Breve descrição do profissional..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                <span className="text-sm text-stone-700">Ativo (visível na plataforma)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-stone-600 border border-line rounded-lg hover:bg-stone-50">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-forest-900 text-white rounded-lg hover:bg-forest-800 disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Nenhum resultado.' : 'Nenhum profissional cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-line p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <span className="text-violet-700 font-bold text-sm">{p.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-forest-900 truncate">{p.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.active ? 'bg-mint text-forest-800' : 'bg-stone-100 text-stone-500'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-stone-500">{p.specialty} · {p.email}</p>
                {p.bio && <p className="text-xs text-stone-400 mt-0.5 truncate">{p.bio}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(p)}
                  className={`text-xs px-2 py-1 rounded border ${p.active ? 'border-line text-stone-500 hover:bg-stone-50' : 'border-forest-200 text-forest-700 hover:bg-mint'}`}
                >
                  {p.active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(p.id, p.name)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
