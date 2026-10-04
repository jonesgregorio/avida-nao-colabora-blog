const ORIGIN = 'https://www.avidanaocolabora.com'
const PATHS = ['/', '/blog', '/guias/diario-emocional', '/guias/emocoes-autoconhecimento', '/guias/sobrecarga-emocional', '/guias/autocuidado-emocional', '/guias/sono-descanso-energia', '/guias/relacoes-limites', '/blog/faca-seu-primeiro-check-in-emocional', '/blog/como-organizar-o-sono-quando-a-rotina-saiu-do-eixo', '/login', '/admin', '/pagina-inexistente-auditoria-seo', '/blog/artigo-inexistente-auditoria-seo', '/guias/guia-inexistente-auditoria-seo']

export function inspectResponse(path, status, html, headerRobots = '') {
  const issues = []
  const add = (code, severity, detail) => issues.push({ path, code, severity, detail, automatic: false })
  const invalid = path.includes('inexistente-auditoria-seo')
  if (invalid) {
    if (![404, 410].includes(status)) add('soft404', 'critical', `URL inexistente respondeu HTTP ${status}; precisa retornar 404 ou 410.`)
    return issues
  }
  if (status !== 200) { add('http', 'critical', `Página respondeu HTTP ${status}.`); return issues }
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)]
  const robots = meta.filter(m => /name=["']robots["']/i.test(m[0])).map(m => m[0]).join(' ')
  if (/noindex/i.test(headerRobots) && /content=["']index\b/i.test(robots)) add('robots_conflict', 'warning', 'HTML permite indexação, mas o cabeçalho HTTP bloqueia; alinhar as instruções.')
  if (['/login', '/admin'].includes(path)) {
    if (!/noindex/i.test(headerRobots + robots)) add('private_index', 'critical', 'Rota privada sem noindex.')
    return issues
  }
  if (/noindex/i.test(headerRobots + robots)) add('public_noindex', 'critical', 'Página pública bloqueada para indexação.')
  if (!/<title>[^<]+<\/title>/i.test(html)) add('title', 'warning', 'Título ausente no HTML publicado.')
  if (!meta.some(m => /name=["']description["']/i.test(m[0]) && /content=["'][^"']+/i.test(m[0]))) add('description', 'warning', 'Descrição ausente no HTML publicado.')
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1]
  if (canonical !== ORIGIN + path) add('canonical', 'warning', 'Canônica publicada diferente da URL auditada ou ausente.')
  if ((html.match(/<h1\b/gi) || []).length !== 1) add('h1', 'warning', 'HTML publicado deve apresentar um título principal claro.')
  if (/Abrir leitura relacionada/.test(html)) add('generic_links', 'warning', 'Links do guia precisam apresentar títulos descritivos.')
  if (path.startsWith('/blog/') && !/BlogPosting/.test(html)) add('schema', 'warning', 'Dados estruturados de artigo não encontrados no HTML.')
  if (path.startsWith('/blog/') && meta.some(m => /og:image:(width|height)/i.test(m[0]) && /content=["']512["']/i.test(m[0]))) add('image_dimensions', 'warning', 'Capa de artigo herda dimensões 512; confirmar dimensões reais e ajustar metadados.')
  return issues
}

// Diagnóstico somente de URLs públicas fixas: não aceita destinos fornecidos pelo cliente.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300')
  if (req.method !== 'GET') return res.status(405).end()
  const checked = [], issues = [], unavailable = []
  for (let i = 0; i < PATHS.length; i += 5) {
    await Promise.all(PATHS.slice(i, i + 5).map(async path => {
      try {
        const response = await fetch(ORIGIN + path, { signal: AbortSignal.timeout(5000) })
        const html = await response.text()
        checked.push(path)
        issues.push(...inspectResponse(path, response.status, html, response.headers.get('x-robots-tag') || ''))
      } catch { unavailable.push(path) }
    }))
  }
  return res.status(200).json({ generatedAt: new Date().toISOString(), checked, issues, unavailable, scope: 'Amostra de 15 URLs públicas; não mede Core Web Vitals, dimensões reais de todas as imagens ou toda a cobertura do Google.' })
}
