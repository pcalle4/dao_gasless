import dotenv from 'dotenv'
import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import daoAbi from '../src/abis/DAOVoting.json'

dotenv.config()

const { RELAYER_PRIVATE_KEY, RPC_URL, DAO_ADDRESS, MAX_PROPOSALS = '50', INTERVAL_MS = '10000' } = process.env

if (!RELAYER_PRIVATE_KEY || !RPC_URL || !DAO_ADDRESS) {
  throw new Error('Faltan variables de entorno para el daemon')
}

const provider = new JsonRpcProvider(RPC_URL)
const wallet = new Wallet(RELAYER_PRIVATE_KEY, provider)
const dao = new Contract(DAO_ADDRESS, daoAbi, wallet)

const runOnce = async () => {
  const limit = Number(MAX_PROPOSALS || '50') || 50
  const processed: Array<{ id: number; txHash: string }> = []
  const now = Math.floor(Date.now() / 1000)

  for (let i = 1; i <= limit; i++) {
    try {
      const p = await dao.getProposal(i)
      const createdAt = BigInt(p.createdAt ?? 0)
      if (createdAt === 0n || p.executed) continue

      const executableAt = BigInt(p.executableAt ?? 0)
      const votesFor = BigInt(p.votesFor ?? 0)
      const votesAgainst = BigInt(p.votesAgainst ?? 0)

      const canExecute = now >= Number(executableAt) && votesFor > votesAgainst
      if (!canExecute) continue

      const tx = await dao.executeProposal(i)
      await tx.wait()
      processed.push({ id: i, txHash: tx.hash })
      console.log(`Ejecutada propuesta ${i}: ${tx.hash}`)
    } catch (err) {
      console.error(`Error ejecutando propuesta ${i}`, err)
    }
  }

  if (processed.length === 0) {
    console.log('Sin propuestas ejecutables')
  }
}

const interval = Number(INTERVAL_MS || '10000') || 10000
console.log(`Daemon iniciado. Escaneando cada ${interval}ms`)

runOnce()
setInterval(runOnce, interval)
