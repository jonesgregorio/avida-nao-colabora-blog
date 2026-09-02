import { useState } from 'react'
import DiaryTagChip from './DiaryTagChip'
import type { TagCategory } from '../lib/tagCategories'

const unique = (items: string[]) => [...new Set(items.filter(Boolean))]

export function SliderField({ label, value, touched, onChange, onClear }: { label: string; value: number; touched: boolean; onChange: (n: number) => void; onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-forest-900">{label}</span>
        <span className="text-xs text-ink-soft">{touched ? `${value}/5` : 'Não informado'}</span>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(Number(e.target.value))} className={`w-full accent-forest-600 ${touched ? '' : 'opacity-50'}`} aria-label={label} aria-valuetext={touched ? `${label}: ${value} de 5` : 'Não informado'} />
      {touched && <button type="button" onClick={onClear} className="mt-1 text-[11px] text-ink-soft underline underline-offset-2">Limpar</button>}
    </div>
  )
}

export function QuickScaleField({ label, value, touched, labels, onChange, onClear }: { label: string; value: number; touched: boolean; labels: string[]; onChange: (n: number) => void; onClear: () => void }) {
  const currentLabel = labels[Math.max(0, Math.min(labels.length - 1, value - 1))] || `${value}/5`
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-forest-900">{label}</span>
        <span className="text-xs text-ink-soft text-right">{touched ? currentLabel : 'Opcional'}</span>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(Number(e.target.value))} className={`w-full accent-forest-600 ${touched ? '' : 'opacity-50'}`} aria-label={label} aria-valuetext={`${label}: ${currentLabel}`} />
      <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-ink-soft"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
      {touched && <button type="button" onClick={onClear} className="mt-1 text-[11px] text-ink-soft underline underline-offset-2">Limpar</button>}
    </div>
  )
}

export function TagGroup({ title, description, options, selected, onToggle, category, allowCustom = false, uniformLight = false, maxSelected }: { title: string; description?: string; options: string[]; selected: string[]; onToggle: (tag: string) => void; category?: TagCategory; allowCustom?: boolean; uniformLight?: boolean; maxSelected?: number }) {
  const [open, setOpen] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [custom, setCustom] = useState('')
  const visible = open ? options : unique([...options.slice(0, 9), ...selected.filter(item => options.includes(item))])
  const canAdd = !maxSelected || selected.length < maxSelected
  const addCustom = () => {
    const clean = custom.replace(/\s+/g, ' ').trim().slice(0, 32)
    if (!clean || selected.some(item => item.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR')) || !canAdd) return
    onToggle(clean)
    setCustom('')
    setAddingCustom(false)
  }
  return (
    <div>
      <p className="text-sm font-semibold text-forest-900">{title}</p>
      {description && <p className="text-xs text-ink-soft mt-1 mb-3">{description}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {visible.map(tag => uniformLight ? (
          <button key={tag} type="button" onClick={() => onToggle(tag)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected.includes(tag) ? 'border-forest-400 bg-mint text-forest-900' : 'border-forest-200 bg-mint/35 text-forest-700 hover:bg-mint/60'}`}>{tag}</button>
        ) : <DiaryTagChip key={tag} label={tag} category={category} selected={selected.includes(tag)} onClick={() => onToggle(tag)} />)}
        {allowCustom && !addingCustom && <button type="button" onClick={() => setAddingCustom(true)} disabled={!canAdd} className="rounded-full border border-dashed border-forest-300 bg-white px-3 py-1.5 text-xs font-medium text-forest-700 hover:bg-mint/30 disabled:opacity-50">+ outro</button>}
      </div>
      {allowCustom && addingCustom && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`custom-${title.replace(/\s+/g, '-').toLowerCase()}`}>Escrever outra opção para {title}</label>
          <input id={`custom-${title.replace(/\s+/g, '-').toLowerCase()}`} autoFocus value={custom} maxLength={32} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} placeholder="Escreva em poucas palavras" className="min-h-11 flex-1 rounded-xl border border-line bg-white px-3 text-base text-forest-900 outline-none focus:border-forest-400 sm:text-sm" />
          <div className="flex gap-2"><button type="button" onClick={addCustom} disabled={!custom.trim() || !canAdd} className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-medium text-white disabled:opacity-50">Adicionar</button><button type="button" onClick={() => { setAddingCustom(false); setCustom('') }} className="min-h-11 rounded-xl border border-line px-4 text-sm text-ink-soft">Cancelar</button></div>
        </div>
      )}
      {maxSelected && <p className="mt-2 text-[11px] text-ink-soft">{selected.length} de {maxSelected} selecionados</p>}
      {options.length > 9 && <button type="button" onClick={() => setOpen(v => !v)} className="text-xs text-forest-700 font-medium mt-3">{open ? 'Mostrar menos' : 'Ver mais opções'}</button>}
    </div>
  )
}