import { useCallback, useEffect, useState } from 'react'
import type { Contract } from 'ethers'
import ProposalCard from './ProposalCard'
import type { Proposal, ProposalState, UserVote, VoteType } from '../types'

interface ProposalListProps {
  daoContract: Contract
  refreshKey: number
  onVote: (proposalId: bigint, vote: VoteType) => Promise<boolean>
  onExecute: (proposalId: bigint) => Promise<boolean>
  isConnected: boolean
  userAddress?: string
}

export interface ProposalView extends Proposal {
  state: ProposalState
  userVote?: UserVote
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
  onVote,
  onExecute,
  isConnected,
  userAddress,
}) => {
  const [proposals, setProposals] = useState<ProposalView[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    const fetched: ProposalView[] = []

    const countRaw = await daoContract.proposalCount()
    const count = Number(BigInt(countRaw?.toString?.() ?? countRaw ?? 0n))

    for (let i = 1; i <= count; i++) {
      try {
        const raw = await daoContract.getProposal(i)
        const proposal = toProposal(raw)
        if (proposal.createdAt === 0n) continue

        const stateRaw = await daoContract.getProposalState(i)
        const state = Number(stateRaw) as ProposalState

        let userVote: UserVote | undefined
        if (userAddress) {
          try {
            const [hasVoted, voteType] = await daoContract.getUserVote(i, userAddress)
            userVote = { hasVoted, voteType: Number(voteType) as VoteType }
          } catch {
            // ignore if call fails
          }
        }

        fetched.push({ ...proposal, state, userVote })
      } catch (err) {
        // ignore
      }
    }

    setProposals(fetched)
    setLoading(false)
  }, [daoContract, userAddress])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals, refreshKey])

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="label">Propuestas</p>
          <p className="muted">Listado automático 1..proposalCount.</p>
        </div>
        <button onClick={fetchProposals} disabled={loading}>
          {loading ? 'Cargando...' : 'Refrescar'}
        </button>
      </div>

      {loading ? <p className="muted">Cargando propuestas...</p> : null}
      {!loading && proposals.length === 0 ? <p className="muted">Sin propuestas.</p> : null}

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
