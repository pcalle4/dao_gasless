import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import ConnectWallet from './components/ConnectWallet'
import CreateProposal from './components/CreateProposal'
import FundingPanel from './components/FundingPanel'
import ProposalList from './components/ProposalList'
import Toast from './components/Toast'
import { relayMetaTx } from './api/relayer'
import { prepareVoteMetaTx } from './gasless/forwarderEip712'
import type { VoteType } from './types'
import { WalletProvider, useWalletContext } from './web3/WalletProvider'
import { getChainIdFromEnv, getDaoReadContract, getDaoWriteContract, getReadProvider } from './web3/getContracts'
import { parseEthInput } from './web3/format'

const daoAddress = import.meta.env.VITE_DAO_ADDRESS
const forwarderAddress = import.meta.env.VITE_FORWARDER_ADDRESS
const rpcUrl = import.meta.env.VITE_RPC_URL
const targetChainId = getChainIdFromEnv()

const AppContent: React.FC = () => {
  const { address, chainId, signer, isConnected } = useWalletContext()
  const daoRead = useMemo(() => getDaoReadContract(), [])
  const provider = useMemo(() => getReadProvider(), [])
  const daoWrite = useMemo(() => (signer ? getDaoWriteContract(signer) : null), [signer])

  const [daoBalance, setDaoBalance] = useState<bigint>(0n)
  const [userBalance, setUserBalance] = useState<bigint>(0n)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadingBalances, setLoadingBalances] = useState(false)

  const refreshData = useCallback(async () => {
    setLoadingBalances(true)
    try {
      const [daoBal, userBal] = await Promise.all([
        daoRead.getDaoBalance(),
        address ? daoRead.getUserBalance(address) : Promise.resolve(0n),
      ])
      setDaoBalance(BigInt(daoBal))
      setUserBalance(BigInt(userBal ?? 0))
    } finally {
      setLoadingBalances(false)
    }
  }, [address, daoRead])

  useEffect(() => {
    refreshData()
  }, [refreshData, address, refreshKey])

  useEffect(() => {
    if (!statusMessage) return undefined
    const id = window.setTimeout(() => setStatusMessage(null), 5000)
    return () => window.clearTimeout(id)
  }, [statusMessage])

  const handleDeposit = useCallback(
    async (amountEth: string) => {
      if (!daoWrite) {
        setStatusMessage('Conecta tu wallet para depositar')
        return false
      }
      const parsed = parseEthInput(amountEth)
      if (!parsed || parsed <= 0n) {
        setStatusMessage('Monto inválido')
        return false
      }
      try {
        setStatusMessage('Enviando depósito...')
        const tx = await daoWrite.fundDao({ value: parsed })
        await tx.wait()
        setStatusMessage(`Depósito confirmado: ${tx.hash}`)
        setRefreshKey((k) => k + 1)
        return true
      } catch (err: any) {
        setStatusMessage(err?.message || 'Error al depositar')
        return false
      }
    },
    [daoWrite],
  )

  const handleCreateProposal = useCallback(
    async ({
      recipient,
      amountEth,
      deadline,
      description,
    }: {
      recipient: string
      amountEth: string
      deadline: number
      description: string
    }) => {
      if (!daoWrite) {
        setStatusMessage('Conecta tu wallet para crear propuestas')
        return false
      }
      const amount = parseEthInput(amountEth)
      if (!amount || amount <= 0n) {
        setStatusMessage('Monto inválido')
        return false
      }
      if (!recipient || !recipient.startsWith('0x')) {
        setStatusMessage('Destinatario inválido')
        return false
      }
      const now = Math.floor(Date.now() / 1000)
      if (!deadline || deadline <= now) {
        setStatusMessage('La fecha límite debe ser futura')
        return false
      }
      if (!description.trim()) {
        setStatusMessage('La descripción es obligatoria')
        return false
      }
      try {
        setStatusMessage('Creando propuesta...')
        const tx = await daoWrite.createProposal(recipient, amount, BigInt(deadline), description.trim())
        await tx.wait()
        setStatusMessage(`Propuesta creada: ${tx.hash}`)
        setRefreshKey((k) => k + 1)
        return true
      } catch (err: any) {
        setStatusMessage(err?.message || 'Error al crear la propuesta')
        return false
      }
    },
    [daoWrite],
  )

  const handleVote = useCallback(
    async (proposalId: bigint, voteType: VoteType) => {
      if (!signer || !address) {
        setStatusMessage('Conecta tu wallet para votar')
        return false
      }
      try {
        setStatusMessage('Preparando meta-transacción...')
        const { request, signature } = await prepareVoteMetaTx({
          signer,
          provider,
          daoAddress,
          forwarderAddress,
          chainId: targetChainId,
          userAddress: address,
          proposalId,
          voteType,
          rpcUrl,
        })
        setStatusMessage('Enviando al relayer...')
        const res = await relayMetaTx(request, signature)
        setStatusMessage(`Voto enviado al relayer: ${res.txHash}`)
        setRefreshKey((k) => k + 1)
        return true
      } catch (err: any) {
        setStatusMessage(err?.message || 'Error al enviar el voto gasless')
        return false
      }
    },
    [address, daoAddress, forwarderAddress, provider, rpcUrl, signer],
  )

  const handleExecute = useCallback(
    async (proposalId: bigint) => {
      if (!daoWrite) {
        setStatusMessage('Conecta tu wallet para ejecutar')
        return false
      }
      try {
        setStatusMessage('Ejecutando propuesta...')
        const tx = await daoWrite.executeProposal(proposalId)
        await tx.wait()
        setStatusMessage(`Propuesta ejecutada: ${tx.hash}`)
        setRefreshKey((k) => k + 1)
        return true
      } catch (err: any) {
        setStatusMessage(err?.message || 'Error al ejecutar la propuesta')
        return false
      }
    },
    [daoWrite],
  )

  const chainWarning = chainId && chainId !== targetChainId

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">DAO Gasless</p>
          <h1>Propuestas tipo GoFundMe</h1>
          <p className="muted">
            Deposita, crea propuestas y vota vía meta-transacciones con forwarder EIP-2771.
          </p>
          <p className="muted small">
            1) Conecta tu wallet y deposita al DAO. 2) Crea propuesta. 3) Vota (gasless) y ejecuta tras
            el delay de seguridad.
          </p>
          {chainWarning ? (
            <p className="warning">Conéctate a la red {targetChainId} para operar (actual: {chainId})</p>
          ) : null}
        </div>
        <ConnectWallet />
      </header>

      <main className="grid">
        <FundingPanel
          daoAddress={daoAddress}
          daoBalance={daoBalance}
          userBalance={userBalance}
          onDeposit={handleDeposit}
          onRefresh={refreshData}
          loadingBalances={loadingBalances}
          isConnected={isConnected}
        />
        <CreateProposal
          onCreate={handleCreateProposal}
          daoBalance={daoBalance}
          userBalance={userBalance}
          isConnected={isConnected}
        />
        <ProposalList
          daoContract={daoRead}
          refreshKey={refreshKey}
          onVote={handleVote}
          onExecute={handleExecute}
          isConnected={isConnected}
          userAddress={address ?? undefined}
        />
      </main>
      <Toast message={statusMessage} />
    </div>
  )
}

const App: React.FC = () => (
  <WalletProvider>
    <AppContent />
  </WalletProvider>
)

export default App
