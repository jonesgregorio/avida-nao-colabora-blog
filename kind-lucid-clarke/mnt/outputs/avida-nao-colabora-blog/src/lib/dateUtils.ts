/** Chave de mês estável para filtros, períodos e persistência (YYYY-MM). */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
