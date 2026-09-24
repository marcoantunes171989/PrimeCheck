import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const releaseShaPath = resolve('release-sha.txt')

const fromEnvironment = [
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.GITHUB_SHA,
  process.env.VITE_PRIMECHECK_SHA,
]
  .map(value => String(value ?? '').trim())
  .find(value => /^[0-9a-f]{40}$/i.test(value))

const fromReleaseFile = existsSync(releaseShaPath)
  ? readFileSync(releaseShaPath, 'utf8').trim()
  : ''

let sha = fromEnvironment || (/^[0-9a-f]{40}$/i.test(fromReleaseFile) ? fromReleaseFile : '')

if (!sha) {
  try {
    sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    sha = 'manual-deploy'
  }
}

const shortSha = sha === 'manual-deploy' ? sha : sha.slice(0, 12)
const payload = {
  sha,
  shortSha,
  builtAt: new Date().toISOString(),
}

mkdirSync(resolve('dist'), { recursive: true })
writeFileSync(resolve('dist/build-info.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`PrimeCheck build info: ${shortSha}`)
