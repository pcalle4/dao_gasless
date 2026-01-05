import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { Contract, JsonRpcProvider, Wallet, isHexString } from 'ethers'
import daoAbi from '../src/abis/DAOVoting.json'
import forwarderAbi from '../src/abis/MinimalForwarder.json'

dotenv.config()

const {
  RELAYER_PRIVATE_KEY,
  RPC_URL,
  DAO_ADDRESS,
  FORWARDER_ADDRESS,
  PORT = '8787',
  MAX_PROPOSALS = '50',
} = process.env

if (!RELAYER_PRIVATE_KEY || !RPC_URL || !DAO_ADDRESS || !FORWARDER_ADDRESS) {
  throw new Error('Faltan variables de entorno en relayer (.env)')
}

const provider = new JsonRpcProvider(RPC_URL)
const wallet = new Wallet(RELAYER_PRIVATE_KEY, provider)
const forwarder = new Contract(FORWARDER_ADDRESS, forwarderAbi, wallet)
const dao = new Contract(DAO_ADDRESS, daoAbi, wallet)

type IncomingRequest = {
  from: string
  to: string
  value: string | number | bigint
  gas: string | number | bigint
  nonce: string | number | bigint
  data: string
}

const normalizeRequest = (req: IncomingRequest) => {
  if (!req?.from || !req?.to || !req?.data) {
    throw new Error('Falta información en la solicitud')
  }

  if (!isHexString(req.data)) {
    throw new Error('data no es hex válido')
  }

  return {
    from: req.from,
    to: req.to,
    value: BigInt(req.value ?? 0),
    gas: BigInt(req.gas ?? 0),
    nonce: BigInt(req.nonce ?? 0),
    data: req.data,
  }
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/relay', async (req, res) => {
  try {
    const { request, signature } = req.body || {}
    if (!request || typeof signature !== 'string' || !isHexString(signature)) {
      return res.status(400).json({ error: 'Request o firma inválida' })
    }

    const parsed = normalizeRequest(request as IncomingRequest)
    const isValid = await forwarder.verify(parsed, signature)
    if (!isValid) {
      return res.status(400).json({ error: 'Firma o nonce no válidos' })
    }

    const gasLimit = parsed.gas + 50_000n
    const tx = await forwarder.execute(parsed, signature, { gasLimit })
    await tx.wait()
    return res.json({ txHash: tx.hash })
  } catch (err: any) {
    console.error('Relay error', err)
    return res.status(500).json({ error: err?.message || 'Error interno' })
  }
})

app.post('/api/daemon/run-once', async (req, res) => {
  const limit = Number((req.query?.max as string) ?? MAX_PROPOSALS ?? '50') || 50
  const processed: Array<{ id: number; txHash: string }> = []
  const countRaw = await dao.proposalCount()
  const total = Number(BigInt(countRaw?.toString?.() ?? countRaw ?? 0n))
  const max = Math.min(limit, total)

  for (let i = 1; i <= max; i++) {
    try {
      const stateRaw = await dao.getProposalState(i)
      const state = Number(stateRaw)
      // APPROVED = 3
      if (state !== 3) continue
      const tx = await dao.executeProposal(i)
      await tx.wait()
      processed.push({ id: i, txHash: tx.hash })
    } catch (err) {
      console.error(`Error evaluando propuesta ${i}:`, err)
    }
  }

  res.json({ processed })
})

app.listen(Number(PORT), () => {
  console.log(`Relayer escuchando en http://localhost:${PORT}`)
})
