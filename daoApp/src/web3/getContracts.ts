import { Contract, JsonRpcProvider, type Provider, type Signer } from 'ethers'
import daoAbi from '../abis/DAOVoting.json'
import forwarderAbi from '../abis/MinimalForwarder.json'

const readEnv = (key: string) => {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined
  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}`)
  }
  return value
}

const getRpcUrl = () => readEnv('VITE_RPC_URL')
const getDaoAddress = () => readEnv('VITE_DAO_ADDRESS')
const getForwarderAddress = () => readEnv('VITE_FORWARDER_ADDRESS')

let sharedProvider: JsonRpcProvider | null = null

export const getReadProvider = (): JsonRpcProvider => {
  if (!sharedProvider) {
    sharedProvider = new JsonRpcProvider(getRpcUrl())
  }
  return sharedProvider
}

export const getDaoReadContract = (provider?: Provider) =>
  new Contract(getDaoAddress(), daoAbi, provider ?? getReadProvider())

export const getDaoWriteContract = (signer: Signer) => new Contract(getDaoAddress(), daoAbi, signer)

export const getForwarderContract = (providerOrSigner?: Provider | Signer) =>
  new Contract(getForwarderAddress(), forwarderAbi, providerOrSigner ?? getReadProvider())

export const getChainIdFromEnv = () => Number(import.meta.env.VITE_CHAIN_ID ?? 0)
