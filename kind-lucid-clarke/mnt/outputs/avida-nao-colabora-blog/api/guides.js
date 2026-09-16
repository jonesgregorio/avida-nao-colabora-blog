const SITE = 'https://www.avidanaocolabora.com'
const TITLE = 'Guias de bem-estar emocional — A Vida Não Colabora'
const DESCRIPTION = 'Caminhos de leitura sobre diário emocional, emoções, sobrecarga, autocuidado, sono, descanso, relações e limites.'
const GUIDES = [
  ['Diário emocional','diario-emocional','Entenda o que é um diário emocional, para que ele pode servir e como começar sem transformar o registro em cobrança.'],
  ['Emoções e autoconhecimento','emocoes-autoconhecimento','Perceba, nomeie e contextualize emoções com mais clareza, sem exigir uma resposta perfeita.'],
  ['Sobrecarga emocional','sobrecarga-emocional','Reconheça sinais de sobrecarga, diferencie cansaço de excesso emocional e organize próximos passos possíveis.'],
  ['Autocuidado emocional','autocuidado-emocional','Entenda autocuidado emocional como escolhas realistas que respeitam energia, rotina e necessidades do momento.'],
  ['Sono, descanso e energia','sono-descanso-energia','Observe sono, descanso e energia como partes da rotina emocional e saiba quando alterações persistentes merecem avaliação.'],
  ['Relações e limites','relacoes-limites','Identifique limites, comunique necessidades e preserve energia nas relações com clareza e respeito.'],
]
const escapeHtml = (value='') => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const replaceOrAppend = (html, pattern, replacement) => pattern.test(html) ? html.replace(pattern,replacement) : html.replace('</head>',`    ${replacement}\n  </head>`)

export default async function handler(req,res){
  if(req.method && req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end('Method Not Allowed')
  try{
    const host=req.headers?.host || 'www.avidanaocolabora.com'
    const proto=host.includes('localhost') ? 'http' : 'https'
    const shellResponse=await fetch(`${proto}://${host}/index.html`)
    if(!shellResponse.ok) throw new Error(`shell ${shellResponse.status}`)
    let html=await shellResponse.text()
    const canonical=`${SITE}/guias`
    html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${TITLE}</title>`)
    html=replaceOrAppend(html,/<meta\s+name=["']description["'][^>]*>/i,`<meta name="description" content="${DESCRIPTION}" />`)
    html=replaceOrAppend(html,/<meta\s+name=["']robots["'][^>]*>/i,'<meta name="robots" content="index, follow, max-image-preview:large" />')
    html=replaceOrAppend(html,/<link\s+rel=["']canonical["'][^>]*>/i,`<link rel="canonical" href="${canonical}" />`)
    html=replaceOrAppend(html,/<link\s+rel=["']alternate["'][^>]*hreflang=["']pt-BR["'][^>]*>/i,`<link rel="alternate" hreflang="pt-BR" href="${canonical}" />`)
    html=replaceOrAppend(html,/<link\s+rel=["']alternate["'][^>]*hreflang=["']x-default["'][^>]*>/i,`<link rel="alternate" hreflang="x-default" href="${canonical}" />`)
    html=replaceOrAppend(html,/<meta\s+property=["']og:title["'][^>]*>/i,`<meta property="og:title" content="${TITLE}" />`)
    html=replaceOrAppend(html,/<meta\s+property=["']og:description["'][^>]*>/i,`<meta property="og:description" content="${DESCRIPTION}" />`)
    html=replaceOrAppend(html,/<meta\s+property=["']og:url["'][^>]*>/i,`<meta property="og:url" content="${canonical}" />`)
    const items=GUIDES.map(([title,key,description])=>`<li><a href="/guias/${key}"><strong>${escapeHtml(title)}</strong></a><p>${escapeHtml(description)}</p></li>`).join('')
    const body=`<main class="seo-snapshot"><nav aria-label="Navegação estrutural"><a href="/">Início</a> · <a href="/blog">Blog</a> · <a href="/guias">Guias</a></nav><h1>Encontre um caminho para entender e cuidar do que você sente</h1><p>Escolha um tema para começar e avance por conteúdos relacionados no seu ritmo. Os guias conectam explicação, reflexão e ferramentas da plataforma sem transformar experiência pessoal em diagnóstico.</p><section><h2>Escolha por onde começar</h2><ul>${items}</ul></section><section><h2>Do conteúdo para a prática</h2><p>Os caminhos conectam leituras às ferramentas já existentes da A Vida Não Colabora, como Diário, Check-in, Mapa Emocional e Plano de Autocuidado, quando essa relação realmente fizer sentido.</p></section><section><h2>Informação sem diagnóstico</h2><p>Os materiais são educativos. Não substituem avaliação, diagnóstico ou acompanhamento profissional.</p></section></main>`
    html=html.replace(/<div id="root">[\s\S]*?<\/div>/i,`<div id="root">${body}</div>`)
    const schema={ '@context':'https://schema.org','@type':'CollectionPage',name:TITLE,description:DESCRIPTION,url:canonical,mainEntity:{'@type':'ItemList',itemListElement:GUIDES.map(([title,key],index)=>({'@type':'ListItem',position:index+1,name:title,url:`${SITE}/guias/${key}`}))}}
    html=replaceOrAppend(html,/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`)
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600')
    if(req.method==='HEAD') return res.status(200).end()
    return res.status(200).end(html)
  }catch(error){
    console.error('[guides] render failed',error)
    res.setHeader('Retry-After','60'); return res.status(503).end('Temporarily unavailable')
  }
}
