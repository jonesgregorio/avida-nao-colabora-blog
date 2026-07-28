import { useState } from 'react'
import { Video, Search, Loader2, Check, X, Link2, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  searchArticleVideos, videoMarker, youtubeIdFromUrl,
  currentRelatedVideoId, setRelatedVideoInContent, removeRelatedVideoFromContent,
  type VideoArticleInput, type VideoCandidate,
} from '../../lib/videoSearch'

interface Props {
  article: VideoArticleInput
  content: string
  onChangeContent: (c: string) => void
}

function fmtDur(s: number): string {
  if (!s) return ''
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

const REL_BADGE: Record<string, { label: string; cls: string }> = {
  muito: { label: 'Muito relacionado', cls: 'bg-green-100 text-green-700' },
  relacionado: { label: 'Relacionado', cls: 'bg-blue-100 text-blue-700' },
  pouco: { label: 'Pouco relacionado', cls: 'bg-amber-100 text-amber-700' },
}

export default function RelatedVideoPicker({ article, content, onChangeContent }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<VideoCandidate[] | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const [manualErr, setManualErr] = useState<string | null>(null)

  const currentId = currentRelatedVideoId(content)

  async function buscar() {
    setLoading(true); setError(null)
    const { query: q, candidates: cs, error: e } = await searchArticleVideos({ ...article, content })
    setQuery(q)
    setLoading(false)
    if (e) { setError(e === 'no_key' ? 'A chave do YouTube (YOUTUBE_API_KEY) não está configurada.' : 'Não foi possível buscar agora. Tente novamente.'); setCandidates([]); return }
    setCandidates(cs)
  }

  function selecionar(c: VideoCandidate) {
    const marker = videoMarker(c.videoId, c.title)
    if (marker) onChangeContent(setRelatedVideoInContent(content, marker))
  }

  function inserirManual() {
    setManualErr(null)
    const id = youtubeIdFromUrl(manualUrl.trim())
    if (!id) { setManualErr('URL do YouTube inválida. Use um link de watch, youtu.be, embed ou shorts.'); return }
    const marker = videoMarker(id, 'Vídeo de referência')
    if (marker) { onChangeContent(setRelatedVideoInContent(content, marker)); setManualUrl('') }
  }

  function remover() { onChangeContent(removeRelatedVideoFromContent(content)) }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-forest-700" />
        <h3 className="text-sm font-semibold text-forest-900">Vídeo relacionado</h3>
      </div>

      {/* Vídeo atual, se houver */}
      {currentId && (
        <div className="flex items-center gap-3 bg-stone-50 border border-line rounded-xl p-2.5">
          <img src={`https://i.ytimg.com/vi/${currentId}/mqdefault.jpg`} alt="" className="w-24 h-14 object-cover rounded-lg flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-stone-500">Vídeo atual do artigo</p>
            <a href={`https://www.youtube.com/watch?v=${currentId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-forest-700 underline break-all">youtube.com/watch?v={currentId}</a>
          </div>
          <button onClick={remover} className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1 flex-shrink-0"><X className="w-3.5 h-3.5" /> Remover</button>
        </div>
      )}

      <button onClick={buscar} disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 text-sm bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {loading ? 'Buscando…' : currentId ? 'Buscar outro vídeo relacionado' : 'Buscar vídeo relacionado'}
      </button>

      {query && candidates && (
        <p className="text-[11px] text-stone-400">Busca usada: <span className="text-stone-500">"{query}"</span> · <button onClick={buscar} className="text-forest-700 hover:underline inline-flex items-center gap-0.5"><RefreshCw className="w-3 h-3" /> buscar de novo</button></p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}</p>
      )}

      {candidates && candidates.length === 0 && !error && (
        <p className="text-xs text-ink-soft bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Nenhum vídeo suficientemente relacionado foi encontrado. Ajuste o título/tags do artigo e busque de novo, ou insira uma URL manualmente abaixo.
        </p>
      )}

      {/* Candidatos */}
      {candidates && candidates.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {candidates.map(c => {
            const badge = c.usedElsewhere ? { label: 'Já usado em outro artigo', cls: 'bg-red-100 text-red-700' } : (REL_BADGE[c.relevance ?? 'pouco'])
            const isCurrent = c.videoId === currentId
            return (
              <div key={c.videoId} className={`flex gap-3 border rounded-xl p-2.5 ${isCurrent ? 'border-forest-300 bg-mint/30' : 'border-line bg-white'}`}>
                {c.thumbnail && <img src={c.thumbnail} alt="" className="w-28 h-16 object-cover rounded-lg flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    {c.durationSeconds > 0 && <span className="text-[10px] text-stone-400">{fmtDur(c.durationSeconds)}</span>}
                  </div>
                  <p className="text-sm font-medium text-forest-900 line-clamp-2 leading-snug">{c.title}</p>
                  <p className="text-[11px] text-stone-400 truncate">{c.channel}</p>
                </div>
                <div className="flex flex-col items-end justify-center gap-1.5 flex-shrink-0">
                  <button onClick={() => selecionar(c)} disabled={isCurrent}
                    className="text-xs inline-flex items-center gap-1 bg-forest-700 hover:bg-forest-800 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg">
                    {isCurrent ? <><Check className="w-3.5 h-3.5" /> Atual</> : 'Usar'}
                  </button>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-stone-400 hover:text-forest-700">ver</a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* URL manual */}
      <div className="pt-1">
        <label className="block text-[11px] text-stone-500 mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> Ou insira uma URL do YouTube manualmente</label>
        <div className="flex gap-2">
          <input value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"
            className="flex-1 text-xs border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-300" />
          <button onClick={inserirManual} disabled={!manualUrl.trim()} className="text-xs bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 px-3 py-2 rounded-lg">Inserir</button>
        </div>
        {manualErr && <p className="text-[11px] text-red-600 mt-1">{manualErr}</p>}
      </div>
    </div>
  )
}
