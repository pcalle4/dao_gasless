import { Contract, Interface, JsonRpcProvider, type TypedDataDomain, type TypedDataField, type TypedDataSigner } from 'ethers'
import daoAbi from '../abis/DAOVoting.json'
import forwarderAbi from '../abis/MinimalForwarder.json'
import type { VoteType } from '../types'

export type ForwardRequest = {
  from: string
  to: string
  value: bigint
  gas: bigint
  nonce: bigint
  data: string
}

export const DEFAULT_NAME = 'MinimalForwarder'
export const DEFAULT_VERSION = '0.0.1'

const daoInterface = new Interface(daoAbi)

export const buildTypedData = (chainId: number, forwarderAddress: string, request: ForwardRequest) => {
  const domain: TypedDataDomain = {
    name: DEFAULT_NAME,
    version: DEFAULT_VERSION,
    chainId,
    verifyingContract: forwarderAddress,
  }

  const types: Record<string, TypedDataField[]> = {
    ForwardRequest: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'gas', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
  }

  return { domain, types, message: request }
}

export const signForwardRequest = async (
  signer: TypedDataSigner,
  typedData: ReturnType<typeof buildTypedData>,
) => {
  const { domain, types, message } = typedData
  return signer.signTypedData(domain, types, message)
}

interface PrepareVoteMetaTxParams {
  signer: TypedDataSigner
  provider?: JsonRpcProvider | null
  daoAddress: string
  forwarderAddress: string
  chainId: number
  userAddress: string
  proposalId: bigint | number
  voteType: VoteType
  gasLimit?: bigint
  rpcUrl?: string
}

export const prepareVoteMetaTx = async ({
  signer,
  provider,
  daoAddress,
  forwarderAddress,
  chainId,
  userAddress,
  proposalId,
  voteType,
  gasLimit,
  rpcUrl,
}: PrepareVoteMetaTxParams) => {
  const readProvider =
    provider ?? signer.provider ?? (rpcUrl ? new JsonRpcProvider(rpcUrl) : null)

  if (!readProvider) {
    throw new Error('No hay provider disponible para el relayer')
  }

  const forwarder = new Contract(forwarderAddress, forwarderAbi, readProvider)
  const nonce = await forwarder.getNonce(userAddress)
  const data = daoInterface.encodeFunctionData('vote', [proposalId, voteType])

  const request: ForwardRequest = {
    from: userAddress,
    to: daoAddress,
    value: 0n,
    gas: gasLimit ?? 300000n,
    nonce: BigInt(nonce.toString()),
    data,
  }

  const typedData = buildTypedData(chainId, forwarderAddress, request)
  const signature = await signForwardRequest(signer, typedData)

  return { request, signature }
}
