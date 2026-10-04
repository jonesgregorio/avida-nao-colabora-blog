const APP_ROUTES = new Set('ig admin login diario perfil questionarios sucesso newsletter-cancelada suporte notificacoes guia-mensal comentarios-profissional mapa-emocional meu-relatorio minha-historia meu-jardim descobertas cuidar mais plano-de-autocuidado meu-plano meditacoes desafios trilhas conquistas lembretes itens-salvos favoritos sessoes sessao orientacao orientacoes minha-evolucao questionario-terapeutico'.split(' '))
export function isAppRoute(path) {
  const clean = path.replace(/^\/+|\/+$/g, '')
  return APP_ROUTES.has(clean) || /^(suporte|questionarios)\/[^/]+$/.test(clean)
}
export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end()
  const path = String(req.query?.path || '')
  if (!isAppRoute(path)) return res.status(404).end('Página não encontrada')
  try {
    const host = req.headers.host || process.env.VERCEL_URL
    const response = await fetch(`${host.includes('localhost') ? 'http' : 'https'}://${host}/index.html`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('shell unavailable')
    const html = (await response.text()).replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex, nofollow, noarchive" />')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).end(req.method === 'HEAD' ? '' : html)
  } catch { return res.status(503).end('Temporariamente indisponível') }
}
