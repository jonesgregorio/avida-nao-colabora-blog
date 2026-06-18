import { Stethoscope } from 'lucide-react'

export default function AdminProfessionals() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Parceiros Profissionais</h1>
      <div className="text-center py-20 text-stone-400">
        <Stethoscope className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium text-stone-600 mb-2">Em breve</p>
        <p className="text-sm max-w-sm mx-auto">
          Cadastro e gestão de psicólogos, terapeutas e outros profissionais parceiros da plataforma.
          Inclui perfil, especialidades, disponibilidade e integração com o sistema de indicações.
        </p>
      </div>
    </div>
  )
}
