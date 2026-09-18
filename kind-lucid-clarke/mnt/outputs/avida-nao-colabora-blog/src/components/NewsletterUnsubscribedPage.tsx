import { CheckCircle, AlertCircle } from 'lucide-react'

interface NewsletterUnsubscribedPageProps {
  onNavigateHome: () => void
}

// Destino do link de cancelamento da newsletter do rodapé (e-mails sem conta).
// A Edge Function unsubscribe faz a baixa no banco e REDIRECIONA para cá — ela
// não serve mais a página em HTML própria porque o gateway do Supabase força
// Content-Type: text/plain (+ CSP sandbox) nas respostas de Edge Function,
// deixando a página crua/ilegível no navegador. Redirecionar para uma página
// do próprio site evita esse problema por completo.
export default function NewsletterUnsubscribedPage({ onNavigateHome }: NewsletterUnsubscribedPageProps) {
  const ok = new URLSearchParams(window.location.search).get('ok') !== '0'

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-line max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-5">
          {ok ? <CheckCircle className="w-16 h-16 text-forest-600" /> : <AlertCircle className="w-16 h-16 text-ink-soft" />}
        </div>

        {ok ? (
          <>
            <h1 className="font-serif text-3xl text-forest-900 mb-3">Inscrição cancelada</h1>
            <p className="text-ink-soft text-sm leading-relaxed mb-6">
              Pronto: você não receberá mais os e-mails da nossa newsletter. Mudou de ideia? É só se inscrever de novo pelo rodapé do site, quando quiser.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl text-forest-900 mb-3">Não foi possível cancelar</h1>
            <p className="text-ink-soft text-sm leading-relaxed mb-6">
              O link pode ser inválido ou já ter expirado. Você pode se inscrever novamente pelo rodapé do site quando quiser.
            </p>
          </>
        )}

        <button
          onClick={onNavigateHome}
          className="w-full bg-forest-900 hover:bg-forest-800 text-white py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Voltar ao site
        </button>
      </div>
    </div>
  )
}
