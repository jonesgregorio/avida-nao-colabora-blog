import { useState } from 'react'
import { Download, FileText, Image as ImageIcon } from 'lucide-react'
import {
  downloadSupportAttachment,
  formatSupportAttachmentSize,
  type SupportAttachment,
} from '../../lib/supportAttachments'

interface Props {
  attachments: SupportAttachment[]
  inverse?: boolean
}

export default function SupportAttachmentList({ attachments, inverse = false }: Props) {
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!attachments.length) return null

  async function handleDownload(attachment: SupportAttachment) {
    setDownloadingPath(attachment.path)
    setError(null)
    try {
      await downloadSupportAttachment(attachment)
    } catch {
      setError('Não foi possível baixar este anexo agora.')
    } finally {
      setDownloadingPath(null)
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map(attachment => {
        const Icon = attachment.mime_type.startsWith('image/') ? ImageIcon : FileText
        const busy = downloadingPath === attachment.path
        return (
          <button
            key={attachment.path}
            type="button"
            onClick={() => handleDownload(attachment)}
            disabled={busy}
            className={`w-full max-w-[320px] flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
              inverse
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                : 'border-line bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium truncate">{attachment.name}</span>
              {attachment.size > 0 && (
                <span className={`block text-[10px] ${inverse ? 'text-white/70' : 'text-stone-400'}`}>
                  {formatSupportAttachmentSize(attachment.size)}
                </span>
              )}
            </span>
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        )
      })}
      {error && <p className={`text-[11px] ${inverse ? 'text-red-100' : 'text-red-600'}`}>{error}</p>}
    </div>
  )
}
