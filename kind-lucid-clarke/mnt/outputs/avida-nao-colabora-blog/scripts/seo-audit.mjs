// Auditoria de SEO automática (somente leitura). Roda no GitHub Actions todo dia
// (.github/workflows/seo-audit.yml) e escreve o relatório em Markdown em seo-report.md.
// Não altera nada no site nem no Google. Sem dependências além do Node 20+.
//
// Fontes: (1) o próprio site, via HTTP; (2) Lighthouse (arquivos lh-*.json, se o workflow
// os gerou); (3) dados do Search Console que o Admin já sincroniza nas tabelas seo_* —
// lidos pela Management API do Supabase com SUPABASE_ACCESS_TOKEN (segredo já existente).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'

const SITE = process.env.SEO_SITE || 'https://www.avidanaocolabora.com'
const REF = process.env.SUPABASE_PROJECT_REF || 'lejvvhzluggyxlfwfoxl'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const OUT = process.env.SEO_REPORT_PATH || 'seo-report.md'

const findings = [] // { sev: 'alta'|'media'|'baixa', title, evidence, fix }
const notes = []    // o que não deu para ler
const add = (sev, title, evidence, fix) => findings.push({ sev, title, evidence, fix })

async function get(url, opts = {}) {
  const t0 = Date.now()
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), ...opts })
  const body = opts.method === 'HEAD' ? '' : await res.text()
  return { res, body, ms: Date.now() - t0 }
}
const first = (re, s) => (s.match(re) || [])[1]?.trim() ?? ''
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

// ── 1. Sitemap + página a página ───────────────────────────────────────────────
async function auditPages() {
  const { body: xml, res } = await get(`${SITE}/sitemap.xml`)
  if (!res.ok) { add('alta', 'Sitemap fora do ar', `${SITE}/sitemap.xml → ${res.status}`, 'Restaurar /api/sitemap.'); return [] }
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1]))
  const pages = await pool(urls, 6, async url => {
    try {
      const { res, body, ms } = await get(url)
      return {
        url, status: res.status, ms,
        title: decode(first(/<title>([^<]*)<\/title>/i, body)),
        desc: decode(first(/<meta name="description" content="([^"]*)"/i, body)),
        canonical: first(/<link rel="canonical" href="([^"]*)"/i, body),
        h1: (body.match(/<h1[\s>]/gi) || []).length,
        noindex: /<meta name="robots" content="[^"]*noindex/i.test(body),
        ld: (body.match(/application\/ld\+json/gi) || []).length,
        og: /property="og:image"/i.test(body),
      }
    } catch (e) { return { url, status: 0, ms: 0, error: String(e) } }
  })

  const bad = pages.filter(p => p.status !== 200)
  if (bad.length) add('alta', `${bad.length} URL(s) do sitemap não respondem 200`, bad.map(p => `${p.url} → ${p.status || p.error}`).join('\n'), 'Corrigir ou tirar do sitemap.')
  const ok = pages.filter(p => p.status === 200)
  const noCanon = ok.filter(p => p.canonical !== p.url)
  if (noCanon.length) add('alta', `${noCanon.length} página(s) com canonical diferente da própria URL`, noCanon.map(p => `${p.url} → ${p.canonical || '(vazio)'}`).join('\n'), 'Alinhar o canonical (ou tirar a URL do sitemap se for redirecionamento).')
  const noind = ok.filter(p => p.noindex)
  if (noind.length) add('alta', `${noind.length} página(s) do sitemap com noindex`, noind.map(p => p.url).join('\n'), 'Remover o noindex ou tirar do sitemap.')
  const h1 = ok.filter(p => p.h1 !== 1)
  if (h1.length) add('media', `${h1.length} página(s) sem exatamente um H1`, h1.map(p => `${p.url} (${p.h1})`).join('\n'), 'Deixar um único H1 por página.')
  const noLd = ok.filter(p => p.ld === 0)
  if (noLd.length) add('media', `${noLd.length} página(s) sem dados estruturados`, noLd.map(p => p.url).join('\n'), 'Incluir JSON-LD adequado.')
  const noOg = ok.filter(p => !p.og)
  if (noOg.length) add('baixa', `${noOg.length} página(s) sem og:image`, noOg.map(p => p.url).join('\n'), 'Definir og:image.')

  const dupOf = key => {
    const m = new Map()
    for (const p of ok) if (p[key]) m.set(p[key], [...(m.get(p[key]) || []), p.url])
    return [...m.values()].filter(v => v.length > 1)
  }
  const dt = dupOf('title'), dd = dupOf('desc')
  if (dt.length) add('media', `${dt.length} título(s) duplicado(s)`, dt.map(v => v.join(' | ')).join('\n'), 'Diferenciar os títulos.')
  if (dd.length) add('media', `${dd.length} descrição(ões) duplicada(s)`, dd.map(v => v.join(' | ')).join('\n'), 'Diferenciar as descrições.')

  const shortDesc = ok.filter(p => p.desc && p.desc.length < 120)
  if (shortDesc.length) add('baixa', `${shortDesc.length} descrição(ões) com menos de 120 caracteres`, shortDesc.map(p => `${p.url} (${p.desc.length})`).join('\n'), 'Alongar para ~130–155 caracteres.')
  const longDesc = ok.filter(p => p.desc.length > 160)
  if (longDesc.length) add('baixa', `${longDesc.length} descrição(ões) com mais de 160 caracteres`, longDesc.map(p => `${p.url} (${p.desc.length})`).join('\n'), 'Encurtar (o Google corta).')
  const longTitle = ok.filter(p => p.title.length > 60)
  if (longTitle.length) add('baixa', `${longTitle.length} título(s) com mais de 60 caracteres`, longTitle.map(p => `${p.url} (${p.title.length})`).join('\n'), 'Encurtar para caber no resultado.')
  const noDesc = ok.filter(p => !p.desc)
  if (noDesc.length) add('media', `${noDesc.length} página(s) sem meta description`, noDesc.map(p => p.url).join('\n'), 'Escrever a descrição.')

  const slow = ok.filter(p => p.ms > 1500)
  if (slow.length) add('baixa', `${slow.length} página(s) com resposta acima de 1,5 s`, slow.map(p => `${p.url} (${p.ms} ms)`).join('\n'), 'Reavaliar na próxima rodada (pode ser cache frio).')

  // Slugs longos: o limite do gerador é 60; acima disso pode haver corte no meio da palavra.
  const slugs = ok.map(p => new URL(p.url).pathname).filter(p => p.startsWith('/blog/')).map(p => ({ p, s: p.slice(6) }))
  const cut = slugs.filter(({ s }) => s.length >= 55 && (/-(e|de|do|da|em|para|com|sem|na|no|a|o|um|uma|ou|que)$/.test(s) || (s.length > 55 && s.length < 60 && !/-[a-z0-9]{4,}$/.test(s))))
  if (cut.length) add('baixa', `${cut.length} slug(s) possivelmente cortado(s) no meio`, cut.map(x => x.p).join('\n'), 'Só renomear com decisão sua (exige 301 e reinicia histórico no Google).')

  notes.push(`${ok.length}/${pages.length} URLs do sitemap responderam 200.`)
  return pages
}

// ── 2. Infra: robots, www, 410, URL inexistente ────────────────────────────────
async function auditInfra() {
  const robots = await get(`${SITE}/robots.txt`)
  if (!/Sitemap:\s*\S+/i.test(robots.body)) add('media', 'robots.txt sem linha Sitemap', robots.body.slice(0, 200), 'Declarar o sitemap no robots.txt.')
  if (/Disallow:\s*\/\s*$/m.test(robots.body)) add('alta', 'robots.txt bloqueia o site inteiro', 'Disallow: /', 'Remover o bloqueio.')

  const apex = SITE.replace('://www.', '://')
  if (apex !== SITE) {
    const r = await fetch(apex + '/', { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (![301, 308].includes(r.status)) add('media', 'Domínio sem www não redireciona (301/308)', `${apex}/ → ${r.status}`, 'Redirecionar para o www.')
  }
  for (const path of ['/author/x/', '/author/x', '/wp-login.php', '/xmlrpc.php', '/wp-content/x.jpg']) {
    const r = await fetch(SITE + path, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (r.status !== 410) add('media', `Lixo de WordPress não devolve 410: ${path}`, `${SITE}${path} → ${r.status}`, 'Manter a regra 410 no vercel.json.')
  }
  const missing = await get(`${SITE}/zz-nao-existe-${Date.now()}`)
  if (!/<meta name="robots" content="[^"]*noindex/i.test(missing.body)) {
    add('baixa', 'URL inexistente devolve 200 com "index, follow" no HTML bruto', `status ${missing.res.status}; o noindex só entra depois do JavaScript`, 'Opcional: devolver noindex/404 pelo servidor para rotas fora de uma lista válida.')
  }
  const missingArticle = await get(`${SITE}/blog/zz-artigo-inexistente-${Date.now()}`)
  if (missingArticle.res.status !== 404) add('media', 'Artigo inexistente não devolve 404', `status ${missingArticle.res.status}`, 'Devolver 404 real.')
}

// ── 3. Search Console (tabelas seo_* do Admin) ─────────────────────────────────
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(30000),
  })
  if (!r.ok) throw new Error(`Management API ${r.status}`)
  return r.json()
}
async function auditSearchConsole() {
  if (!TOKEN) { notes.push('Search Console: SUPABASE_ACCESS_TOKEN ausente — dados do Google não lidos.'); return null }
  try {
    const [perf] = await sql(`select
      coalesce(sum(clicks) filter (where day >= current_date-9 and day < current_date-2),0)::int as clicks,
      coalesce(sum(impressions) filter (where day >= current_date-9 and day < current_date-2),0)::int as impressions,
      coalesce(sum(clicks) filter (where day >= current_date-16 and day < current_date-9),0)::int as pclicks,
      coalesce(sum(impressions) filter (where day >= current_date-16 and day < current_date-9),0)::int as pimpressions,
      max(day)::text as last_day
      from seo_search_performance_daily where dimension='total'`)
    const cov = await sql(`select coalesce(coverage_state,'?') as state, count(*)::int as n from seo_url_inspections group by 1 order by 2 desc`)
    const alerts = await sql(`select severity, title, url from seo_alerts where status='open' order by first_seen_at desc limit 15`)
    const runs = await sql(`select status, started_at::text from seo_sync_runs order by started_at desc limit 1`)
    const topq = await sql(`select dimension_key as q, sum(impressions)::int as imp, round(avg(position)::numeric,1) as pos from seo_search_performance_daily where dimension='query' and day >= current_date-16 group by 1 order by 2 desc limit 10`)
    if (runs[0]?.status !== 'succeeded') add('media', 'Última sincronização com o Search Console não teve sucesso', JSON.stringify(runs[0] || {}), 'Conferir a Edge Function google-search-console e a chave de serviço.')
    for (const a of alerts) add(a.severity === 'critical' ? 'alta' : 'media', `Alerta do Search Console: ${a.title}`, a.url || '', 'Ver o SEO Control Center no Admin.')
    const notIdx = cov.filter(c => !/indexada/i.test(c.state) || /não indexada/i.test(c.state))
    return { perf, cov, notIdx, topq }
  } catch (e) {
    notes.push(`Search Console: não consegui ler as tabelas (${e.message}).`)
    return null
  }
}

// ── 4. Lighthouse (arquivos lh-*.json gerados pelo workflow) ───────────────────
function auditLighthouse() {
  const files = readdirSync('.').filter(f => /^lh-.*\.json$/.test(f))
  if (!files.length) { notes.push('Lighthouse: nenhum resultado gerado nesta rodada.'); return [] }
  const rows = []
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(f, 'utf8'))
      const a = j.audits || {}
      rows.push({
        url: j.finalDisplayedUrl || j.requestedUrl,
        perf: Math.round((j.categories?.performance?.score ?? 0) * 100),
        seo: Math.round((j.categories?.seo?.score ?? 0) * 100),
        lcp: a['largest-contentful-paint']?.displayValue, cls: a['cumulative-layout-shift']?.displayValue, tbt: a['total-blocking-time']?.displayValue,
      })
    } catch { notes.push(`Lighthouse: ${f} ilegível.`) }
  }
  for (const r of rows) {
    if (r.perf < 50) add('media', `Desempenho baixo (${r.perf}/100) em ${r.url}`, `LCP ${r.lcp} · CLS ${r.cls} · TBT ${r.tbt}`, 'Otimizar imagens/JS dessa página.')
    if (r.seo < 90) add('media', `Nota de SEO do Lighthouse baixa (${r.seo}/100) em ${r.url}`, '', 'Ver o relatório do Lighthouse para os itens reprovados.')
  }
  return rows
}

// ── Relatório ──────────────────────────────────────────────────────────────────
const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
let pages = []
try { pages = await auditPages() } catch (e) { notes.push(`Varredura do site falhou: ${e.message}`) }
try { await auditInfra() } catch (e) { notes.push(`Checagens de infraestrutura falharam: ${e.message}`) }
const gsc = await auditSearchConsole()
const lh = auditLighthouse()

const order = { alta: 0, media: 1, baixa: 2 }
findings.sort((a, b) => order[a.sev] - order[b.sev])
const label = { alta: '🔴 Alta', media: '🟠 Média', baixa: '🟡 Baixa' }
const grave = findings.filter(f => f.sev === 'alta').length
const nota = Math.max(0, 10 - grave * 2 - findings.filter(f => f.sev === 'media').length * 0.5 - findings.filter(f => f.sev === 'baixa').length * 0.15).toFixed(1)

let md = `# Relatório de SEO — ${today}\n\nSomente leitura: nada foi alterado no site nem no Google.\n\n`
md += `**Nota técnica: ${nota}/10** · ${findings.length} ponto(s) de atenção (${grave} grave(s)) · ${pages.filter(p => p.status === 200).length}/${pages.length} URLs do sitemap OK.\n\n`
if (gsc) {
  const p = gsc.perf
  const d = (a, b) => (b === 0 ? (a === 0 ? '—' : 'novo') : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`)
  md += `## Google (Search Console, dados até ${p.last_day || 'n/d'})\n\n| Métrica (7 dias, com atraso de ~2 dias) | Agora | Semana anterior | Variação |\n|---|---|---|---|\n| Impressões | ${p.impressions} | ${p.pimpressions} | ${d(p.impressions, p.pimpressions)} |\n| Cliques | ${p.clicks} | ${p.pclicks} | ${d(p.clicks, p.pclicks)} |\n\n`
  md += `Inspeção de URLs (amostra do Admin): ${gsc.cov.map(c => `${c.n} × ${c.state}`).join(' · ') || 'sem dados'}\n\n`
  if (gsc.topq.length) md += `Principais buscas: ${gsc.topq.map(q => `“${q.q}” (${q.imp} impr., pos. ${q.pos})`).join(' · ')}\n\n`
}
if (lh.length) md += `## Desempenho (Lighthouse, celular)\n\n| Página | Perf | SEO | LCP | CLS | TBT |\n|---|---|---|---|---|---|\n${lh.map(r => `| ${r.url} | ${r.perf} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`).join('\n')}\n\n`
md += `## Correções sugeridas\n\n`
if (!findings.length) md += 'Nenhum problema encontrado nesta rodada. ✅\n\n'
findings.forEach((f, i) => {
  md += `### A${i + 1} — ${f.title}  \n**Gravidade:** ${label[f.sev]}\n\n${f.evidence ? '```\n' + f.evidence.slice(0, 1500) + '\n```\n\n' : ''}**Correção:** ${f.fix}\n\n`
})
md += `## Não consegui ler / observações\n\n${notes.length ? notes.map(n => `- ${n}`).join('\n') : '- Nada.'}\n- Core Web Vitals reais, backlinks, ações manuais e segurança do Search Console só existem na tela do Google (sem API): peça uma leitura pelo Claude quando quiser.\n\n`
md += `---\n**Quer que eu faça os ajustes?** Responda ao Claude no chat: “fazer todos”, “fazer A1, A3…” ou “nenhum agora”. Nada é alterado sem o seu aval.\n`

writeFileSync(OUT, md)
console.log(md)
