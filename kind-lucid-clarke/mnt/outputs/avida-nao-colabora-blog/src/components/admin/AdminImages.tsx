import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Upload, Trash2, Copy } from 'lucide-react'

interface ImageItem {
  name: string
  url: string
  created_at: string
}

export default function AdminImages() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [bucketError, setBucketError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const { data, error } = await supabase.storage.from('article-images').list('', { sortBy: { column: 'created_at', order: 'desc' } })
    if (error) { setBucketError(true); setLoading(false); return }
    if (data) {
      const items = data.map(f => ({
        name: f.name,
        url: supabase.storage.from('article-images').getPublicUrl(f.name).data.publicUrl,
        created_at: f.created_at || '',
      }))
      setImages(items)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const name = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('article-images').upload(name, file)
    if (error) { showToast('Erro ao fazer upload: ' + error.message) }
    else { showToast('Upload concluído!'); load() }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function remove(name: string) {
    if (!confirm('Excluir imagem?')) return
    await supabase.storage.from('article-images').remove([name])
    load()
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url)
    showToast('URL copiada!')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-forest-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-forest-900">Biblioteca de Imagens</h1>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" /> {uploading ? 'Enviando...' : 'Upload'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={upload} className="hidden" />
      </div>

      {bucketError && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <strong>Bucket não encontrado.</strong> Crie o bucket <code>article-images</code> como público em{' '}
          <strong>Supabase Dashboard → Storage → New bucket</strong>.
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando imagens...</p>
      ) : images.length === 0 ? (
        <p className="text-stone-400 text-sm">Nenhuma imagem enviada ainda.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map(img => (
            <div key={img.name} className="group relative bg-white rounded-xl border border-line overflow-hidden">
              <img src={img.url} alt={img.name} className="w-full h-28 object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copy(img.url)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white" title="Copiar URL">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(img.name)} className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded text-white" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-stone-400 px-2 py-1.5 truncate">{img.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
