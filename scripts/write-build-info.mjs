import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const shortSha = sha.slice(0, 12)
const payload = {
  sha,
  shortSha,
  builtAt: new Date().toISOString(),
}

mkdirSync(resolve('dist'), { recursive: true })
writeFileSync(resolve('dist/build-info.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`PrimeCheck build info: ${shortSha}`)
