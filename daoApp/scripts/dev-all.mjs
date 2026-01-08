import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const rootDir = resolve(process.cwd())
const relayerDir = resolve(rootDir, 'relayer')

const children = []

const spawnProc = (label, command, args, cwd) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit' })
  children.push({ label, child })
  return child
}

const shutdown = (code = 0) => {
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

const ui = spawnProc('ui', npmCmd, ['run', 'dev'], rootDir)
const relayer = spawnProc('relayer', npmCmd, ['run', 'dev'], relayerDir)

if (process.env.WITH_DAEMON === '1') {
  spawnProc('daemon', npmCmd, ['run', 'daemon'], relayerDir)
}

const exitHandler = (label) => (code) => {
  if (code && code !== 0) {
    console.error(`${label} exited with code ${code}`)
    shutdown(code)
  }
}

ui.on('exit', exitHandler('ui'))
relayer.on('exit', exitHandler('relayer'))
