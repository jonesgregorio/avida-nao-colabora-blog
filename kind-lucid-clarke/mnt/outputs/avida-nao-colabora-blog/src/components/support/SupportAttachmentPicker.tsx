import { Paperclip, X } from 'lucide-react'
import {
  SUPPORT_ATTACHMENT_ACCEPT,
  MAX_SUPPORT_ATTACHMENTS,
  appendSupportFiles,
  formatSupportAttachmentSize,
} from '../../lib/supportAttachments'

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  onError?: (message: string | null) => void
  disabled?: boolean
  compact?: boolean
}

export default function SupportAttachmentPicker({ files, onChange, onError, disabled = false, compact = false }: Props) {
  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const result = appendSupportFiles(files, Array.from(selected))
    if (result.error) {
      onError?.(result.error)
      return
    }
    onError?.(null)
    onChange(result.files)
  }

  function removeAt(index: number) {
    onChange(files.filter((_, current) => current !== index))
    onError?.(null)
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className={`inline-flex items-center gap-1.5 border border-line rounded-xl text-stone-600 hover:bg-stone-50 cursor-pointer transition-colors ${compact ? 'text-xs px-3 py-2' : 'text-sm px-3.5 py-2.5'} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <Paperclip className="w-4 h-4" />
        Anexar arquivo
        <input
          type="file"
          accept={SUPPORT_ATTACHMENT_ACCEPT}
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={event => {
            handleFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
      </label>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <span key={`${file.name}-${file.size}-${index}`} className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-stone-50 border border-line px-2.5 py-1.5 text-xs text-stone-600">
              <span className="truncate max-w-[210px]">{file.name}</span>
              <span className="text-[10px] text-stone-400 flex-shrink-0">{formatSupportAttachmentSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remover ${file.name}`}
                className="text-stone-400 hover:text-red-500 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!compact && (
        <p className="text-[11px] text-ink-soft">
          Até {MAX_SUPPORT_ATTACHMENTS} arquivos. JPG, PNG, WEBP ou PDF, com até 5 MB cada.
        </p>
      )}
    </div>
  )
}
