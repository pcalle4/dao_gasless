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
  const countRaw = await dao.proposalCount()
  const total = Number(BigInt(countRaw?.toString?.() ?? countRaw ?? 0n))
  const max = Math.min(limit, total)

  for (let i = 1; i <= max; i++) {
    try {
      const stateRaw = await dao.getProposalState(i)
      const state = Number(stateRaw)
      if (state !== 3) continue // APPROVED

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
