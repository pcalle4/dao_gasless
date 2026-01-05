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

export enum ProposalState {
  NONEXISTENT = 0,
  ACTIVE = 1,
  WAITING_SECURITY_DELAY = 2,
  APPROVED = 3,
  REJECTED = 4,
  EXECUTED = 5,
}

export interface UserVote {
  hasVoted: boolean
  voteType?: VoteType
}
