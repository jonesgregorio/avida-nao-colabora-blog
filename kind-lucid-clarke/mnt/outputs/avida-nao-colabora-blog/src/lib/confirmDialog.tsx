import { createRoot } from 'react-dom/client'

interface Opcoes {
  titulo: string
  mensagem: string
  confirmar?: string
  cancelar?: string
  tom?: 'normal' | 'perigo'
}

/**
 * Confirmação imperativa: `await confirmDialog({...})` de qualquer lugar, sem o
 * chamador precisar hospedar estado nem JSX.
 *
 * Existe porque o App tem 9 ramificações de render diferentes — pendurar um
 * modal com estado em todas seria repetição e fonte de divergência. Monta em um
 * container próprio no body e se desmonta ao responder.
 */
export function confirmDialog(o: Opcoes): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    const fechar = (resposta: boolean) => {
      resolve(resposta)
      // Desmonta fora do ciclo de render atual (React reclama se for síncrono).
      setTimeout(() => { root.unmount(); host.remove() }, 0)
    }

    const perigo = o.tom === 'perigo'

    root.render(
      <div
        className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        onClick={() => fechar(false)}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className={`font-semibold mb-2 ${perigo ? 'text-red-700' : 'text-forest-900'}`}>{o.titulo}</h3>
          <p className="text-sm text-stone-600 mb-5 whitespace-pre-line">{o.mensagem}</p>
          <div className="flex gap-2">
            <button
              onClick={() => fechar(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
                perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-forest-800 hover:bg-forest-700'
              }`}
            >
              {o.confirmar ?? 'Confirmar'}
            </button>
            <button
              onClick={() => fechar(false)}
              className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
            >
              {o.cancelar ?? 'Cancelar'}
            </button>
          </div>
        </div>
      </div>,
    )
  })
}
