export type CarePlanReadiness = {
  enough: boolean
  reason_code: 'ready' | 'insufficient_activity'
  title: string
  explanation: string
  next_steps: string[]
  total_entries: number
  active_days: number
  min_entries: number
  min_active_days: number
}

export function carePlanReadiness(totalEntries: number, activeDays: number): CarePlanReadiness {
  const minEntries = 12
  const minActiveDays = 8
  const enough = totalEntries >= minEntries && activeDays >= minActiveDays
  if (enough) return {
    enough: true, reason_code: 'ready', title: 'Há contexto suficiente para um plano pessoal.',
    explanation: 'Os registros deste ciclo têm continuidade suficiente para apoiar escolhas específicas sem preencher lacunas com suposições.',
    next_steps: [], total_entries: totalEntries, active_days: activeDays, min_entries: minEntries, min_active_days: minActiveDays,
  }
  const missing: string[] = []
  if (activeDays < minActiveDays) missing.push(`houve registros em ${activeDays} dia(s), e buscamos pelo menos ${minActiveDays} dias distribuídos no ciclo`)
  if (totalEntries < minEntries) missing.push(`foram ${totalEntries} registro(s), e buscamos pelo menos ${minEntries} sinais ao longo do período`)
  return {
    enough: false, reason_code: 'insufficient_activity', title: 'Ainda estamos conhecendo o seu ritmo.',
    explanation: `Neste ciclo, ${missing.join(' e ')}. Preferimos não criar um plano genérico só para preencher a tela: ele aparece quando consegue ser específico o bastante para ser útil.`,
    next_steps: [
      'Faça check-ins quando eles ajudarem você a nomear como está.',
      'Use o Diário quando quiser acrescentar contexto a um dia importante.',
      'Não é preciso registrar todos os dias: continuidade e variedade ajudam mais do que quantidade.',
    ],
    total_entries: totalEntries, active_days: activeDays, min_entries: minEntries, min_active_days: minActiveDays,
  }
}
