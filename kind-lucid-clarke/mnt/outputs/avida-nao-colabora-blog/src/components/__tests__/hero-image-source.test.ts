import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Hero image source', () => {
  it('uses a non-empty committed hero asset', () => {
    const heroPath = path.resolve(process.cwd(), 'public/images/home/hero-person-clean.webp')
    expect(fs.existsSync(heroPath)).toBe(true)
    expect(fs.statSync(heroPath).size).toBeGreaterThan(1024)
  })
})
