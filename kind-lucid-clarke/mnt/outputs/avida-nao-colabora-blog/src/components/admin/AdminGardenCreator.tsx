import { useMemo, useState } from 'react'
import { ImagePlus, Loader2, Save, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { GARDEN_THEMES, gardenVisualProgress, type GardenTheme, type Point } from '../../lib/gardenThemes'
import { DEFAULT_SCENE, sanitizeSceneConfig, sceneOf, themeFromCatalogRow, type SceneConfig } from '../../lib/gardenSceneConfig'
import LivingGarden from '../garden/LivingGarden'
import ScenePicker from './garden/scenePicker'
import type { PickTool, PickValue } from './garden/sceneTools'
import SceneControls from './garden/sceneControls'

// Criador de jardins do Admin. O administrador envia as 6 imagens e monta o restante (cena viva:
// água, queda, fauna, luz e extras) clicando na imagem e ajustando controles. O jardim salvo usa a
// MESMA engine e as mesmas regras dos jardins do código: progresso, estágios, celebração,
// comparação de crescimento, campanhas, fila e ajuste manual funcionam igual.

export interface CatalogGardenRow {
  id: string
  slug: string
  label: string
  description: string
  theme_index: number
  status: string
  stage_images: string[]
  completion_title: string
  completion_message: string
  scene_config?: unknown
}

interface Props {
  gardens: CatalogGardenRow[]
  editing: CatalogGardenRow | null
  onClose: () => void
  onSaved: () => Promise<void>
  audit: (action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) => Promise<void>
}

type Step = 'identidade' | 'imagens' | 'cena' | 'previa'

const STEPS: { id: Step; label: string }[] = [
  { id: 'identidade', label: '1. Identidade' },
  { id: 'imagens', label: '2. Imagens' },
  { id: 'cena', label: '3. Cena viva' },
  { id: 'previa', label: '4. Prévia e salvar' },
]

const STAGE_NAMES = ['Recém-plantado', 'Brotando', 'Enraizando', 'Ganhando forma', 'Florescendo', 'Completo']
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_BYTES = 8 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

function slugify(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { reject(new Error('Não foi possível ler a imagem.')); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export default function AdminGardenCreator({ gardens, editing, onClose, onSaved, audit }: Props) {
  const isEdit = Boolean(editing)
  const [step, setStep] = useState<Step>('identidade')
  const [label, setLabel] = useState(editing?.label ?? '')
  const [slug, setSlug] = useState(editing?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [description, setDescription] = useState(editing?.description ?? '')
  const [completionTitle, setCompletionTitle] = useState(editing?.completion_title ?? 'Seu jardim floresceu por completo.')
  const [completionMessage, setCompletionMessage] = useState(editing?.completion_message ?? 'O que começou com pequenos cuidados agora ocupa todo esse espaço. Parabéns por cultivar até aqui. 🌿')
  const [images, setImages] = useState<string[]>(() => {
    const base = Array.isArray(editing?.stage_images) ? editing!.stage_images : []
    return Array.from({ length: 6 }, (_, i) => base[i] ?? '')
  })
  const [scene, setScene] = useState<SceneConfig>(() => (editing?.scene_config ? sanitizeSceneConfig(editing.scene_config) : { ...DEFAULT_SCENE }))
  const [tool, setTool] = useState<PickTool | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  const [done, setDone] = useState('')
  const [progress, setProgress] = useState(30)
  const [previewKey, setPreviewKey] = useState(0)

  const codeSlugs = useMemo(() => new Set(GARDEN_THEMES.map((t) => t.slug)), [])
  const slugTaken = !isEdit && (codeSlugs.has(slug) || gardens.some((g) => g.slug === slug))
  const slugOk = SLUG_RE.test(slug) && !slugTaken
  const imagesOk = images.every(Boolean)
  const finalImage = images[5] || images.filter(Boolean).pop() || ''

  const draftTheme: GardenTheme | null = useMemo(
    () => themeFromCatalogRow({ slug: slug || 'previa', label: label || 'Prévia', stage_images: images.filter(Boolean), scene_config: scene }),
    [slug, label, images, scene],
  )

  function applyPick(t: PickTool, value: PickValue) {
    const next: SceneConfig = JSON.parse(JSON.stringify(scene))
    const point = value as Point
    const rect = value as [number, number, number, number]
    switch (t.kind) {
      case 'sun': next.light.sun = point; break
      case 'glow': next.light.glow = [...next.light.glow, ...(value as Point[]).map((p): [number, number, number, string] => [p[0], p[1], 24, '250,205,130'])].slice(0, 8); break
      case 'waterCenter': next.water = { ...next.water, kind: 'basin', center: point, rx: (next.water.rx ?? 0) > 0.001 ? next.water.rx : 0.1, ry: (next.water.ry ?? 0) > 0.001 ? next.water.ry : 0.04, tint: next.water.tint === '#000000' ? '#3d5a52' : next.water.tint }; break
      case 'waterPoly': next.water = { ...next.water, kind: 'pond', poly: value as Point[], center: undefined, rx: undefined, ry: undefined }; break
      case 'waterRip': next.water = { ...next.water, ripFrom: point }; break
      case 'thread': next.water = { ...next.water, thread: rect }; break
      case 'fallZone': next.fall.emitters[t.index] = { ...next.fall.emitters[t.index], zone: rect }; break
      case 'hbZone': next.flyers.hbZone = rect; break
      case 'waterfall': next.waterfall = { x0: rect[0], x1: rect[2], top: rect[1], bottom: rect[3], land: next.waterfall?.land }; break
      case 'waterfallLand': if (next.waterfall) next.waterfall.land = point; break
      case 'duck': if (next.ducks?.[t.index]) next.ducks[t.index].path = rect; break
      case 'dustZone': next.dust = { count: next.dust?.count ?? 24, zone: rect }; break
      case 'hawk': next.hawk = { center: point, r: next.hawk?.r ?? [0.3, 0.055], sp: next.hawk?.sp ?? 0.12 }; break
      case 'owl': next.owl = point; break
      case 'smoke': next.smoke = point; break
      case 'star': next.stars = [...(next.stars ?? []), ...(value as Point[]).map((p): [number, number, number] => [p[0], p[1], 1.1])].slice(0, 60); break
    }
    setScene(sanitizeSceneConfig(next))
    const keepOpen = t.kind === 'glow' || t.kind === 'star' || t.kind === 'waterPoly'
    if (!keepOpen) setTool(null)
  }

  async function uploadImage(index: number, file: File | undefined) {
    if (!file) return
    setError(''); setWarn('')
    if (!SLUG_RE.test(slug)) { setError('Defina um identificador válido (passo 1) antes de enviar imagens.'); return }
    const ext = TYPES[file.type]
    if (!ext) { setError('Use imagem WebP, JPG ou PNG.'); return }
    if (file.size > MAX_BYTES) { setError('A imagem passa de 8 MB. Reduza e tente de novo.'); return }
    setUploading(index)
    try {
      const { w, h } = await imageSize(file)
      const ratio = w / h
      if (ratio < 1.6 || ratio > 1.95) throw new Error(`Proporção ${w}×${h} fora do padrão. Use quadro 16:9 (ideal 1672×941), igual aos jardins atuais.`)
      if (w < 1200) setWarn(`Imagem ${index + 1} tem ${w}px de largura; abaixo de 1200px pode ficar borrada.`)
      const path = `${slug}/${index + 1}.${ext}`
      const { error: upErr } = await supabase.storage.from('garden-images').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
      if (upErr) throw upErr
      const url = `${supabase.storage.from('garden-images').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
      setImages((list) => list.map((u, i) => (i === index ? url : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar a imagem.')
    } finally {
      setUploading(null)
    }
  }

  function startFromCode(slugOfCode: string) {
    const theme = GARDEN_THEMES.find((t) => t.slug === slugOfCode)
    if (theme) setScene(sanitizeSceneConfig(sceneOf(theme)))
  }

  async function save() {
    setError(''); setDone('')
    if (!label.trim()) { setError('Informe o nome do jardim.'); setStep('identidade'); return }
    if (!slugOk) { setError(slugTaken ? 'Esse identificador já existe. Escolha outro.' : 'Identificador inválido (use letras minúsculas, números e hífen).'); setStep('identidade'); return }
    if (!imagesOk) { setError('Envie as 6 imagens dos estágios.'); setStep('imagens'); return }
    const clean = JSON.parse(JSON.stringify(sanitizeSceneConfig(scene)))
    setSaving(true)
    try {
      if (isEdit && editing) {
        const { error: e } = await supabase.from('garden_catalog').update({
          label: label.trim(), description: description.trim(), cover_image: images[5], stage_images: images,
          completion_title: completionTitle.trim(), completion_message: completionMessage.trim(),
          scene_config: clean, updated_at: new Date().toISOString(),
        }).eq('id', editing.id)
        if (e) throw e
        await audit('garden.scene.update', 'garden', slug, { label: label.trim() })
        setDone('Jardim atualizado. As mudanças valem para quem abrir o Meu Jardim a partir de agora.')
      } else {
        const nextIndex = gardens.length ? Math.max(...gardens.map((g) => g.theme_index)) + 1 : 0
        const { error: e } = await supabase.from('garden_catalog').insert({
          slug, label: label.trim(), description: description.trim(), theme_index: nextIndex, status: 'draft',
          cover_image: images[5], stage_images: images, completion_title: completionTitle.trim(),
          completion_message: completionMessage.trim(), scene_config: clean,
        })
        if (e) throw e
        await audit('garden.create', 'garden', slug, { label: label.trim(), with_scene: true })
        setDone('Jardim criado como Rascunho (ninguém vê ainda). Para liberar, mude o status para "Pronto" ou "Na fila" no Catálogo.')
      }
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const input = 'mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm'

  return (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl text-forest-900">{isEdit ? `Editar jardim · ${editing?.label}` : 'Criar jardim completo'}</h3>
          <p className="mt-1 max-w-3xl text-xs text-ink-soft">Você envia as imagens e monta o restante aqui. O jardim criado funciona como os atuais: mesmos estágios, movimento, celebração, comparação de crescimento, fila, campanhas e ajuste manual.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {STEPS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={step === s.id} onClick={() => { setTool(null); setStep(s.id); if (s.id === 'previa') setPreviewKey((k) => k + 1) }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${step === s.id ? 'bg-forest-900 text-white' : 'bg-mint text-forest-800'}`}>{s.label}</button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {warn && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warn}</p>}
      {done && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{done}</p>}

      {step === 'identidade' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-ink-soft">Nome de exibição
            <input className={input} value={label} maxLength={120} placeholder="Ex.: Jardim de Inverno · primeira neve" onChange={(e) => { setLabel(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
          </label>
          <label className="text-xs text-ink-soft">Identificador (não muda depois de publicado)
            <input className={input} value={slug} disabled={isEdit} placeholder="jardim-de-inverno" onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} />
            {slug && !slugOk && <span className="mt-1 block text-[11px] text-red-600">{slugTaken ? 'Esse identificador já existe.' : 'Use letras minúsculas, números e hífen.'}</span>}
          </label>
          <label className="text-xs text-ink-soft md:col-span-2">Descrição editorial
            <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="text-xs text-ink-soft">Título ao concluir o jardim
            <input className={input} value={completionTitle} onChange={(e) => setCompletionTitle(e.target.value)} />
          </label>
          <label className="text-xs text-ink-soft">Mensagem ao concluir o jardim
            <input className={input} value={completionMessage} onChange={(e) => setCompletionMessage(e.target.value)} />
          </label>
          <div className="md:col-span-2"><button type="button" className="admin-btn-primary" onClick={() => setStep('imagens')}>Continuar para as imagens</button></div>
        </div>
      )}

      {step === 'imagens' && (
        <div className="mt-5 space-y-4">
          <p className="text-xs text-ink-soft">Envie 6 imagens, uma por estágio, da mais recente (recém-plantado) à final (completo). Mesmo quadro 16:9 em todas (ideal 1672×941), WebP, JPG ou PNG, até 8 MB. O mesmo enquadramento é o que permite o efeito de crescimento suave entre estágios.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((url, i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-3">
                <p className="text-xs font-semibold text-forest-800">{i + 1}. {STAGE_NAMES[i]}</p>
                <div className="mt-2 overflow-hidden rounded-xl bg-stone-100" style={{ aspectRatio: '1672 / 941' }}>
                  {url ? <img src={url} alt={`Estágio ${i + 1}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[11px] text-ink-soft">Sem imagem</div>}
                </div>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-forest-300 bg-mint px-3 py-1.5 text-xs font-medium text-forest-800">
                  {uploading === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  {url ? 'Trocar imagem' : 'Enviar imagem'}
                  <input type="file" accept="image/webp,image/jpeg,image/png" className="sr-only" disabled={uploading !== null} onChange={(e) => { void uploadImage(i, e.target.files?.[0]); e.target.value = '' }} />
                </label>
              </div>
            ))}
          </div>
          <button type="button" className="admin-btn-primary" disabled={!imagesOk} onClick={() => setStep('cena')}>Continuar para a cena viva</button>
        </div>
      )}

      {step === 'cena' && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper-soft p-3 text-xs text-ink-soft">
            <span>Atalho: começar a cena a partir de um jardim existente (você ajusta as posições para a sua imagem):</span>
            <select className="rounded-lg border border-line bg-white p-2 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) { startFromCode(e.target.value); e.target.value = '' } }}>
              <option value="">Escolher…</option>
              {GARDEN_THEMES.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="xl:sticky xl:top-24 xl:self-start">
              <ScenePicker image={finalImage} scene={scene} tool={tool} onPick={applyPick} onCancel={() => setTool(null)} />
              <p className="mt-2 text-[11px] text-ink-soft">Na imagem: amarelo = sol/lua · laranja = brilhos · verde = queda · azul = água · rosa = beija-flores · marrom = poeira/gavião.</p>
            </div>
            <SceneControls scene={scene} setScene={setScene} pick={setTool} />
          </div>
          <button type="button" className="admin-btn-primary" onClick={() => { setPreviewKey((k) => k + 1); setStep('previa') }}>Ver prévia animada</button>
        </div>
      )}

      {step === 'previa' && (
        <div className="mt-5 space-y-4">
          {draftTheme ? (
            <>
              <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-stone-100" style={{ aspectRatio: '1672 / 941' }}>
                <LivingGarden key={previewKey} theme={draftTheme} progress={gardenVisualProgress(progress, 6)} />
              </div>
              <label className="block text-xs text-ink-soft">Crescimento no ciclo: {progress} de 59 (arraste para ver cada estágio)
                <input type="range" min={0} max={59} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="mt-1 w-full accent-forest-700" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="admin-btn-secondary" onClick={() => setPreviewKey((k) => k + 1)}>Reiniciar animação</button>
                <button type="button" className="admin-btn-secondary" onClick={() => setStep('cena')}>Voltar e ajustar a cena</button>
              </div>
            </>
          ) : <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Para ver a prévia, conclua o nome, o identificador e as 6 imagens.</p>}
          <button type="button" className="admin-btn-primary" disabled={saving || !imagesOk || !slugOk || !label.trim()} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isEdit ? 'Salvar alterações' : 'Salvar como rascunho'}
          </button>
        </div>
      )}
    </div>
  )
}
