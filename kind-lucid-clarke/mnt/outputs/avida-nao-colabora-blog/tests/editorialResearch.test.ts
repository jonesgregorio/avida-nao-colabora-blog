import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMedlineSources, researchOfficialSources, validateResearchedCitations, selectSearchOpportunities, researchBrief, normalizeResearchQuery, validateResearchAudit } from '../supabase/functions/_shared/editorialResearch.ts'
import { buildArticleGenerationPrompt, hasEditorialSource } from '../supabase/functions/_shared/articleGenerationContract.ts'
const document = (url = 'https://medlineplus.gov/stress.html', publisher = 'National Library of Medicine', text = 'Stress management involves observing symptoms, everyday routines and seeking professional help when symptoms persist. '.repeat(3)) => `<document rank="0" url="${url}"><content name="title">&lt;span&gt;Stress&lt;/span&gt;</content><content name="organizationName">${publisher}</content><content name="FullSummary">${text}</content></document>`
const date = '2026-10-06T00:00:00.000Z'
test('source parser reads actual summaries and rejects unrelated, spoofed or wrong publishers', () => {
  const sources = parseMedlineSources(`<list>${document()}${document('https://medlineplus.gov.evil.test/stress.html')}${document('http://medlineplus.gov/stress.html')}${document('https://medlineplus.gov/sleep.html', 'Fake Publisher')}${document('https://medlineplus.gov/stress.html')}</list>`, 'stress', date)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].title, 'Stress')
  assert.equal(sources[0].retrievedAt, date)
  assert.equal(parseMedlineSources(document(), 'asthma', date).length, 0)
  assert.equal(parseMedlineSources(document(), '', date).length, 0)
})
test('search targets a fixed official endpoint with encoding and a timeout', async () => {
  const result = await researchOfficialSources('stress / https://evil.test', (async (url, init) => {
    const u = new URL(String(url))
    assert.equal(u.hostname, 'wsearch.nlm.nih.gov')
    assert.equal(u.searchParams.get('retmax'), '6')
    assert.ok(init?.signal)
    assert.equal(init?.redirect, 'error')
    return new Response(document(), { status: 200 })
  }) as typeof fetch)
  assert.equal(result.sources.length, 1)
  assert.ok(normalizeResearchQuery('stress OR http://127.0.0.1').length <= 100)
})
test('provider outage never becomes a claim of researched sources', async () => {
  const result = await researchOfficialSources('stress', (async () => { throw new Error('timeout') }) as typeof fetch)
  assert.equal(result.sources.length, 0)
  assert.ok(result.warnings.length)
})
test('generation replaces static sources and citations must come from actual research', () => {
  const sources = parseMedlineSources(document(), 'stress', date)
  const research = { sources, query: 'stress', warnings: [], retrievedAt: date }
  const prompt = buildArticleGenerationPrompt({ themes: ['Estresse'], sourcesBrief: researchBrief(research) })
  assert.ok(prompt.includes('medlineplus.gov/stress.html'))
  assert.ok(!prompt.includes('nimh.nih.gov/health/topics/caring'))
  assert.equal(validateResearchedCitations('[Fonte](https://medlineplus.gov/stress.html) [Interno](https://www.avidanaocolabora.com/blog/pausas)', sources).length, 0)
  assert.ok(validateResearchedCitations('[Inventada](https://medlineplus.gov/sleep.html)', sources).length)
  assert.ok(hasEditorialSource('[Fonte](https://medlineplus.gov/stress.html)'))
})
test('Search Console opportunities aggregate only related queries with weighted position', () => {
  const rows = [
    { day: '2026-10-05', dimension_key: 'estresse no trabalho', clicks: 2, impressions: 20, position: 10 },
    { day: '2026-10-04', dimension_key: 'estresse no trabalho', clicks: 1, impressions: 10, position: 4 },
    { day: '2026-10-05', dimension_key: 'comprar carro', clicks: 10, impressions: 1000, position: 2 },
  ]
  const [row] = selectSearchOpportunities('estresse diário', rows)
  assert.equal(row.impressions, 30)
  assert.equal(row.clicks, 3)
  assert.equal(row.ctr, 0.1)
  assert.equal(row.position, 8)
  assert.deepEqual(selectSearchOpportunities('sono', rows), [])
})

test('persisted research blocks unsupported references on publication, including reloads', () => {
  const sources = parseMedlineSources(document(), 'stress', date)
  const notes = 'Notas manuais\nPesquisa editorial: ' + JSON.stringify({ research: { sources, query: 'stress', retrievedAt: date, warnings: [] } })
  assert.deepEqual(validateResearchAudit('[Fonte](https://medlineplus.gov/stress.html)', notes), [])
  assert.ok(validateResearchAudit('[Outra](https://medlineplus.gov/sleep.html)', notes).length)
  assert.ok(validateResearchAudit('texto', 'Pesquisa editorial: invalid').length)
  assert.deepEqual(validateResearchAudit('artigo antigo', 'notas antigas'), [])
})

test('stress ambiguity rejects urinary stress and unspecified trauma disorders', () => {
  const urine = document('https://medlineplus.gov/urinaryincontinence.html').replace('Stress&lt;/span&gt;', 'Urinary Incontinence&lt;/span&gt;')
  const trauma = document('https://medlineplus.gov/posttraumaticstressdisorder.html').replace('Stress&lt;/span&gt;', 'Post-Traumatic Stress Disorder&lt;/span&gt;')
  assert.equal(parseMedlineSources(urine + trauma + document(), 'stress', date).length, 1)
})

test('exact official topic wins over demographic subtopics', () => {
  const general = document('https://medlineplus.gov/mentalhealth.html').replace('Stress&lt;/span&gt;', 'Mental Health&lt;/span&gt;')
  const child = document('https://medlineplus.gov/childmentalhealth.html').replace('Stress&lt;/span&gt;', 'Child Mental Health&lt;/span&gt;')
  const sources = parseMedlineSources(child + general, 'mental health', date)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].title, 'Mental Health')
})
