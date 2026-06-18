import { FileText } from 'lucide-react'

export default function AdminPDF() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Relatórios PDF</h1>
      <div className="text-center py-20 text-stone-400">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium text-stone-600 mb-2">Em breve</p>
        <p className="text-sm max-w-sm mx-auto">
          Geração e download de relatórios em PDF para usuários e para o admin: relatório emocional mensal,
          resumo de diário, evolução do humor e exportação de dados por período.
        </p>
      </div>
    </div>
  )
}
