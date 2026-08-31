import { useState } from 'react'
import DiaryTagChip from './DiaryTagChip'
import type { TagCategory } from '../lib/tagCategories'

// Extraído de DiaryExperience.tsx (Parte 17 da MISSÃO GERAL: reduzir a
// complexidade do arquivo principal sem alterar comportamento). Componentes
// puros e sem estado externo — não têm dependência nenhuma do restante do
// Diário, então saem sem risco de regressão de comportamento.

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
      {/* §20: currentLabel já existe e é mostrado visualmente, mas não chegava ao
          leitor de tela — só o número bruto do slider era anunciado. */}
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(Number(e.target.value))} className={`w-full accent-forest-600 ${touched ? '' : 'opacity-50'}`} aria-label={label} aria-valuetext={`${label}: ${currentLabel}`} />
      <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-ink-soft"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
      {touched && <button type="button" onClick={onClear} className="mt-1 text-[11px] text-ink-soft underline underline-offset-2">Limpar</button>}
    </div>
  )
}

export function TagGroup({ title, description, options, selected, onToggle, category }: { title: string; description?: string; options: string[]; selected: string[]; onToggle: (tag: string) => void; category?: TagCategory }) {
  const [open, setOpen] = useState(false)
  const visible = open ? options : unique([...options.slice(0, 6), ...selected])
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-semibold text-forest-900">{title}</p>
      {description && <p className="text-xs text-ink-soft mt-1 mb-3">{description}</p>}
      <div className="flex flex-wrap gap-2">
        {visible.map(tag => <DiaryTagChip key={tag} label={tag} category={category} selected={selected.includes(tag)} onClick={() => onToggle(tag)} />)}
      </div>
      {options.length > 6 && <button type="button" onClick={() => setOpen(v => !v)} className="text-xs text-forest-700 font-medium mt-3">{open ? 'Mostrar menos' : 'Ver mais opções'}</button>}
    </div>
  )
}
