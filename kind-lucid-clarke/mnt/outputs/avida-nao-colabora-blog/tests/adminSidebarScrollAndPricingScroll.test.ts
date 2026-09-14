import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const adminLayout = read('src/components/admin/AdminLayout.tsx')
const app = read('src/App.tsx')

// Achado ao vivo: no desktop, rolar o menu lateral do Admin pra baixo e clicar em qualquer
// aba fazia o menu voltar pro topo sozinho. Causa: `const Sidebar = () => (...)` era definido
// DENTRO do render de AdminLayout — o React trata isso como um componente novo a cada render
// do pai, remontando o <aside>/<nav> inteiro (e zerando o scroll) a cada troca de aba.
test('AdminSidebarContent é um componente próprio, definido fora do render de AdminLayout (não remonta a cada navegação)', () => {
  // (o comentário explicativo cita a sintaxe antiga como referência histórica; o que importa é
  // que ela não exista mais como código real, fora de comentário)
  assert.doesNotMatch(adminLayout, /^\s*const Sidebar = \(\) =>/m)
  assert.match(adminLayout, /^function AdminSidebarContent\(/m)
  // definido ANTES de "export default function AdminLayout" — ou seja, fora do seu corpo
  const sidebarIdx = adminLayout.indexOf('function AdminSidebarContent(')
  const adminLayoutIdx = adminLayout.indexOf('export default function AdminLayout(')
  assert.ok(sidebarIdx > 0 && sidebarIdx < adminLayoutIdx, 'AdminSidebarContent precisa estar declarado antes/fora de AdminLayout')
})

test('as duas instâncias do menu (desktop e mobile) usam o mesmo componente estável, recebendo os dados como props', () => {
  const uses = adminLayout.match(/<AdminSidebarContent visibleNav=\{visibleNav\} active=\{active\} go=\{go\} initials=\{initials\} name=\{name\} onExit=\{onExit\} \/>/g) ?? []
  assert.equal(uses.length, 2, 'esperava o componente usado 2x (sidebar fixa do desktop + drawer do mobile)')
})

// Achado ao vivo: no mobile, clicar em "Ver mais funcionalidades" (Home → Planos) abria a
// página de Planos já rolada quase até o rodapé, em vez do topo. Causa: window.scrollTo com
// behavior:'smooth' é uma animação — a troca de view (setView) substitui o conteúdo da página
// logo em seguida, interrompendo a animação no meio do caminho, bem longe do topo.
test('navegação entre views usa rolagem instantânea, não "smooth" (que pode ser interrompida pela troca de conteúdo)', () => {
  assert.doesNotMatch(app, /window\.scrollTo\(\{ ?top: ?0, ?behavior: ?'smooth' ?\}\)/)
  const instantScrolls = app.match(/window\.scrollTo\(0, 0\)/g) ?? []
  assert.ok(instantScrolls.length >= 7, `esperava várias chamadas de scroll instantâneo (achei ${instantScrolls.length})`)
})
