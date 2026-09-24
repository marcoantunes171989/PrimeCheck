import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const port = Number(process.argv[2])
const sha = String(process.argv[3] || '').trim()
const logFile = resolve(process.argv[4] || `primecheck-vite-${port}.log`)
const pidFile = resolve(process.argv[5] || `primecheck-vite-${port}.pid`)
const projectDir = resolve(process.argv[6] || process.cwd())

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`Porta local inválida: ${process.argv[2]}`)
}
if (!/^[0-9a-f]{40}$/i.test(sha)) {
  throw new Error(`SHA inválido: ${sha || '(vazio)'}`)
}

mkdirSync(dirname(logFile), { recursive: true })
mkdirSync(dirname(pidFile), { recursive: true })

const output = openSync(logFile, 'a')
const daemon = resolve(projectDir, 'scripts', 'vite-local-daemon.mjs')

const child = spawn(
  process.execPath,
  [daemon, String(port), sha, projectDir],
  {
    cwd: projectDir,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', output, output],
    env: {
      ...process.env,
      VITE_PRIMECHECK_SHA: sha,
    },
  },
)

child.unref()
closeSync(output)

writeFileSync(pidFile, String(child.pid) + '\n', 'utf8')
console.log(`PrimeCheck local server iniciado. PID=${child.pid} PORT=${port}`)
