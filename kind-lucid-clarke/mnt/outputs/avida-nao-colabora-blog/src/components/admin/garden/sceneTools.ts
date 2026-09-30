import type { Point } from '../../../lib/gardenThemes'

// Ferramentas de marcação da cena (o que um clique na imagem significa).

type Mode = 'point' | 'rect' | 'line' | 'poly' | 'points'

export type PickTool =
  | { kind: 'sun' } | { kind: 'glow' } | { kind: 'waterCenter' } | { kind: 'waterPoly' } | { kind: 'waterRip' }
  | { kind: 'thread' } | { kind: 'fallZone'; index: number } | { kind: 'hbZone' } | { kind: 'waterfall' }
  | { kind: 'waterfallLand' } | { kind: 'duck'; index: number } | { kind: 'dustZone' } | { kind: 'hawk' }
  | { kind: 'owl' } | { kind: 'smoke' } | { kind: 'star' }

const MODES: Record<PickTool['kind'], Mode> = {
  sun: 'point', glow: 'points', waterCenter: 'point', waterPoly: 'poly', waterRip: 'point', thread: 'line',
  fallZone: 'rect', hbZone: 'rect', waterfall: 'rect', waterfallLand: 'point', duck: 'line', dustZone: 'rect',
  hawk: 'point', owl: 'point', smoke: 'point', star: 'points',
}

export const TOOL_HELP: Record<PickTool['kind'], string> = {
  sun: 'Clique onde está a fonte de luz (sol ou lua).',
  glow: 'Clique em cada lanterna, janela ou fogo que deve brilhar. Clique em "Concluir" ao terminar.',
  waterCenter: "Clique no centro da bacia d'água.",
  waterPoly: 'Clique nos cantos do contorno da água, em sequência. Clique em "Concluir" ao fechar o contorno (mínimo 3 pontos).',
  waterRip: 'Clique de onde as marolas devem partir.',
  thread: "Clique no início e depois no fim do fio d'água que cai.",
  fallZone: 'Clique em dois cantos opostos da área de onde caem folhas, pétalas ou neve.',
  hbZone: 'Clique em dois cantos opostos da área onde os beija-flores ficam (perto das flores).',
  waterfall: "Clique em dois cantos opostos cobrindo a queda d'água (do topo ao pé).",
  waterfallLand: 'Clique onde a cachoeira encontra a água.',
  duck: 'Clique no início e depois no fim do trajeto do pato na água.',
  dustZone: 'Clique em dois cantos opostos da área onde a poeira flutua.',
  hawk: 'Clique no centro do voo circular do gavião.',
  owl: 'Clique onde a coruja fica pousada.',
  smoke: 'Clique na saída da chaminé.',
  star: 'Clique no céu para posicionar cada estrela. Clique em "Concluir" ao terminar.',
}

export function toolMode(tool: PickTool): Mode { return MODES[tool.kind] }

export type PickValue = Point | [number, number, number, number] | Point[]

