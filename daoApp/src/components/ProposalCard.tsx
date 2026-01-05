import { useState } from 'react'
import type { Proposal, VoteType } from '../types'
import { formatEth } from '../web3/format'

interface ProposalCardProps {
  proposal: Proposal
  onVote: (proposalId: bigint, vote: VoteType) => Promise<boolean>
  onExecute: (proposalId: bigint) => Promise<boolean>
  isConnected: boolean
}

const formatDate = (timestamp: bigint) => {
  const ms = Number(timestamp) * 1000
  if (Number.isNaN(ms) || ms === 0) return 'No definido'
  return new Date(ms).toLocaleString()
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onVote, onExecute, isConnected }) => {
  const [voting, setVoting] = useState<VoteType | null>(null)
  const [executing, setExecuting] = useState(false)

  const now = Math.floor(Date.now() / 1000)
  const isActive = now < Number(proposal.deadline) && !proposal.executed
  const waitingWindow =
    !proposal.executed &&
    now >= Number(proposal.deadline) &&
    now < Number(proposal.executableAt)
  const canExecute =
    !proposal.executed &&
    now >= Number(proposal.executableAt) &&
    proposal.votesFor > proposal.votesAgainst

  let status = 'Pendiente'
  if (proposal.executed) status = 'Ejecutada'
  else if (isActive) status = 'Activa'
  else if (waitingWindow) status = 'En espera'
  else if (proposal.votesFor > proposal.votesAgainst) status = 'Aprobada'
  else status = 'Rechazada'

  const handleVote = async (vote: VoteType) => {
    setVoting(vote)
    await onVote(proposal.id, vote)
    setVoting(null)
  }

  const handleExecute = async () => {
    setExecuting(true)
    await onExecute(proposal.id)
    setExecuting(false)
  }

  return (
    <div className="card proposal">
      <div className="card-header">
        <div>
          <p className="label">Propuesta #{proposal.id.toString()}</p>
          <p className="value">{status}</p>
          <p className="muted">Destinatario: {proposal.recipient}</p>
        </div>
        <div className="status-pill">
          <span>Monto</span>
          <strong>{formatEth(proposal.amount)} ETH</strong>
        </div>
      </div>

      <div className="proposal-body">
        <div className="votes">
          <div>
            <p className="label">A favor</p>
            <p className="value">{proposal.votesFor.toString()}</p>
          </div>
          <div>
            <p className="label">En contra</p>
            <p className="value">{proposal.votesAgainst.toString()}</p>
          </div>
          <div>
            <p className="label">Abstenciones</p>
            <p className="value">{proposal.votesAbstain.toString()}</p>
          </div>
        </div>
        <div className="dates">
          <p className="muted">Vence: {formatDate(proposal.deadline)}</p>
          <p className="muted">Ejecutable desde: {formatDate(proposal.executableAt)}</p>
          <p className="muted">Tu voto: no disponible (se añadirá con getter/evento)</p>
        </div>
      </div>

      <div className="actions split">
        <div className="button-row">
          {[0, 1, 2].map((vote) => {
            const label =
              vote === 0 ? 'Votar A Favor' : vote === 1 ? 'Votar En Contra' : 'Votar Abstención'
            return (
              <button
                key={vote}
                onClick={() => handleVote(vote as VoteType)}
                disabled={!isConnected || !isActive || voting !== null || executing}
              >
                {voting === vote ? 'Firmando...' : label}
              </button>
            )
          })}
        </div>
        <button
          className="primary"
          onClick={handleExecute}
          disabled={!isConnected || !canExecute || executing}
          title={
            canExecute
              ? ''
              : 'Necesita votos suficientes y que pase el security delay para ejecutarse'
          }
        >
          {executing ? 'Ejecutando...' : 'Ejecutar'}
        </button>
      </div>
    </div>
  )
}

export default ProposalCard
