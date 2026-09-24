import { createServer } from 'vite'
import { resolve } from 'node:path'

const port = Number(process.argv[2])
const sha = String(process.argv[3] || '').trim()
const projectDir = resolve(process.argv[4] || process.cwd())

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`Porta local inválida: ${process.argv[2]}`)
}
if (!/^[0-9a-f]{40}$/i.test(sha)) {
  throw new Error(`SHA inválido: ${sha || '(vazio)'}`)
}

process.chdir(projectDir)
process.env.VITE_PRIMECHECK_SHA = sha

const server = await createServer({
  root: projectDir,
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
})

await server.listen()
server.printUrls()
console.log(`PrimeCheck Vite daemon ativo. SHA=${sha} PORT=${port}`)

const shutdown = async signal => {
  console.log(`Encerrando PrimeCheck Vite daemon por ${signal}...`)
  await server.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await new Promise(() => {})
