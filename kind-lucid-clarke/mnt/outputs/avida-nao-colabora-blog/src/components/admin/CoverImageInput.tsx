import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Upload, Loader2, X, ImageIcon, Link2 } from 'lucide-react'

interface Props {
  url: string
  alt: string
  onChangeUrl: (u: string) => void
  onChangeAlt: (a: string) => void
}

// Limites: o bucket é público e a capa vai no topo do artigo — arquivo gigante
// deixa o blog lento para o leitor.
const MAX_MB = 5
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

// Upload de capa direto no editor. Usa o bucket 'media' (068), o mesmo do Estúdio
// de Mídia — leitura pública, escrita só por admin (RLS no storage.objects).
// Antes, o editor só aceitava URL: era preciso subir o arquivo em outro lugar e
// colar o link aqui.
export default function CoverImageInput({ url, alt, onChangeUrl, onChangeAlt }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [modoUrl, setModoUrl] = useState(false)
  const inputFile = useRef<HTMLInputElement>(null)

  async function enviar(file: File) {
    setErro(null)

    if (!TIPOS_ACEITOS.includes(file.type)) {
      setErro('Formato não aceito. Use JPG, PNG, WebP, AVIF ou GIF.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErro(`Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é ${MAX_MB} MB.`)
      return
    }

    setEnviando(true)
    // Nome único e sem acento/espaço: o path vira URL pública.
    const seguro = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `capas/${Date.now()}-${seguro}`

    const { error } = await supabase.storage.from('media')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (error) {
      // Erro de RLS aqui quase sempre significa sessão sem role admin.
      setErro(`Falha no upload: ${error.message}`)
      setEnviando(false)
      return
    }

    const { data } = supabase.storage.from('media').getPublicUrl(path)
    onChangeUrl(data.publicUrl)
    // Sugere um alt a partir do nome do arquivo, mas só se estiver vazio —
    // nunca sobrescrever um texto que a pessoa escreveu.
    if (!alt.trim()) onChangeAlt(seguro.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
    setEnviando(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void enviar(file)
  }

  return (
    <div className="space-y-3">
      {url ? (
        <div className="relative group">
          <img
            src={url}
            alt={alt || 'Capa do artigo'}
            className="w-full h-40 object-cover rounded-lg border border-line bg-stone-50"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
          />
          <button
            onClick={() => { onChangeUrl(''); setErro(null) }}
            title="Remover capa"
            className="absolute top-2 right-2 bg-white/90 hover:bg-white text-stone-600 hover:text-red-600 rounded-full p-1.5 shadow-sm transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => inputFile.current?.click()}
            className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-stone-700 text-xs px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <Upload className="w-3 h-3" /> Trocar
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={onDrop}
          onClick={() => inputFile.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            arrastando ? 'border-forest-500 bg-mint/40' : 'border-stone-200 hover:border-forest-300 hover:bg-stone-50'
          }`}
        >
          {enviando ? (
            <div className="flex flex-col items-center gap-2 text-stone-500">
              <Loader2 className="w-6 h-6 animate-spin text-forest-600" />
              <p className="text-xs">Enviando imagem…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-stone-400">
              <ImageIcon className="w-7 h-7" />
              <p className="text-xs text-stone-600 font-medium">Arraste uma imagem ou clique para escolher</p>
              <p className="text-[10px]">JPG, PNG, WebP, AVIF ou GIF · até {MAX_MB} MB</p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputFile}
        type="file"
        accept={TIPOS_ACEITOS.join(',')}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviar(f); e.target.value = '' }}
      />

      {erro && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
      )}

      {/* A URL continua acessível: capas antigas e imagens hospedadas fora
          precisam seguir funcionando. */}
      {modoUrl ? (
        <div className="space-y-1">
          <label className="block text-[11px] text-stone-500">URL da imagem</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
            <button onClick={() => setModoUrl(false)} className="text-xs text-stone-500 hover:text-stone-700 px-2">Fechar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setModoUrl(true)} className="text-[11px] text-stone-400 hover:text-forest-700 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Usar uma URL em vez de enviar arquivo
        </button>
      )}

      <div className="space-y-1">
        <label className="block text-[11px] text-stone-500">
          Texto alternativo (alt) <span className="text-stone-400">— descreve a imagem para leitores de tela e para o SEO</span>
        </label>
        <input
          value={alt}
          onChange={(e) => onChangeAlt(e.target.value)}
          placeholder="Ex.: mulher escrevendo em um caderno perto da janela"
          className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />
      </div>
    </div>
  )
}
