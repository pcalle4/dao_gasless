import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Contract } from 'ethers'
import ProposalCard from './ProposalCard'
import type { Proposal, VoteType } from '../types'

interface ProposalListProps {
  daoContract: Contract
  refreshKey: number
  defaultMaxId?: number | null
  onVote: (proposalId: bigint, vote: VoteType) => Promise<boolean>
  onExecute: (proposalId: bigint) => Promise<boolean>
  isConnected: boolean
}

const toProposal = (raw: any): Proposal => ({
  id: BigInt(raw.id ?? 0),
  recipient: raw.recipient ?? '',
  amount: BigInt(raw.amount ?? 0),
  deadline: BigInt(raw.deadline ?? 0),
  votesFor: BigInt(raw.votesFor ?? 0),
  votesAgainst: BigInt(raw.votesAgainst ?? 0),
  votesAbstain: BigInt(raw.votesAbstain ?? 0),
  executed: Boolean(raw.executed),
  createdAt: BigInt(raw.createdAt ?? 0),
  executableAt: BigInt(raw.executableAt ?? 0),
})

const ProposalList: React.FC<ProposalListProps> = ({
  daoContract,
  refreshKey,
  defaultMaxId,
  onVote,
  onExecute,
  isConnected,
}) => {
  const [maxId, setMaxId] = useState<number>(defaultMaxId && defaultMaxId > 0 ? defaultMaxId : 10)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (defaultMaxId && defaultMaxId > 0) {
      setMaxId(defaultMaxId)
    }
  }, [defaultMaxId])

  const fetchProposals = useCallback(async () => {
    const lastId = Math.max(1, maxId || 10)
    setLoading(true)
    const fetched: Proposal[] = []

    for (let i = 1; i <= lastId; i++) {
      try {
        const raw = await daoContract.getProposal(i)
        const proposal = toProposal(raw)
        if (proposal.createdAt > 0n) {
          fetched.push(proposal)
        }
      } catch (err) {
        // ignore non existing proposals
      }
    }

    setProposals(fetched)
    setLoading(false)
  }, [daoContract, maxId])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals, refreshKey])

  const maxIdInput = useMemo(() => maxId, [maxId])

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="label">Propuestas</p>
          <p className="muted">
            Listar hasta Proposal ID N (si el contrato no reporta total, intenta manualmente).
          </p>
        </div>
        <div className="input-inline">
          <input
            type="number"
            min="1"
            value={maxIdInput}
            onChange={(e) => setMaxId(Number(e.target.value))}
          />
          <button onClick={fetchProposals} disabled={loading}>
            {loading ? 'Cargando...' : 'Refrescar'}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">Cargando propuestas...</p> : null}
      {!loading && proposals.length === 0 ? (
        <p className="muted">Sin propuestas en este rango.</p>
      ) : null}

      <div className="proposal-list">
        {proposals.map((p) => (
          <ProposalCard
            key={p.id.toString()}
            proposal={p}
            onVote={onVote}
            onExecute={onExecute}
            isConnected={isConnected}
          />
        ))}
      </div>
    </div>
  )
}

export default ProposalList
