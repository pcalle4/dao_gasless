export type VoteType = 0 | 1 | 2

export interface Proposal {
  id: bigint
  recipient: string
  amount: bigint
  deadline: bigint
  votesFor: bigint
  votesAgainst: bigint
  votesAbstain: bigint
  executed: boolean
  createdAt: bigint
  executableAt: bigint
}
