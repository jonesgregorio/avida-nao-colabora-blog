import test from 'node:test'
import assert from 'node:assert/strict'
import { renderPublicArticleContent } from '../api/article.js'

test('fontes HTTPS e leituras internas são links no HTML público, sem aceitar scripts', () => {
  const html = renderPublicArticleContent('[Fonte](https://www.nhs.uk/example/) e [Guia](/blog/diario). [Perigo](javascript:alert) <script>alert(1)</script>')
  assert.match(html, /<a href="https:\/\/www.nhs.uk\/example\/">Fonte<\/a>/)
  assert.match(html, /<a href="\/blog\/diario">Guia<\/a>/)
  assert.doesNotMatch(html, /href="javascript:|<script>/)
  assert.match(html, /&lt;script&gt;/)
})
