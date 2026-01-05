import { useCallback, useEffect, useState } from 'react'
import type { BrowserProvider, Eip1193Provider, JsonRpcSigner } from 'ethers'
import { BrowserProvider as EthersBrowserProvider } from 'ethers'

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: any[]) => void) => void
      removeListener?: (event: string, handler: (...args: any[]) => void) => void
    }
  }
}

export interface WalletState {
  address: string | null
  chainId: number | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  connecting: boolean
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [connecting, setConnecting] = useState(false)

  const reset = useCallback(() => {
    setAddress(null)
    setChainId(null)
    setSigner(null)
    setProvider(null)
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask no está disponible en este navegador.')
    }

    setConnecting(true)
    try {
      const browserProvider = new EthersBrowserProvider(window.ethereum)
      const accounts = await browserProvider.send('eth_requestAccounts', [])
      const signerInstance = await browserProvider.getSigner()
      const network = await browserProvider.getNetwork()

      setProvider(browserProvider)
      setSigner(signerInstance)
      setAddress(accounts?.[0] ?? null)
      setChainId(Number(network.chainId))
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    reset()
  }, [reset])

  useEffect(() => {
    if (!window.ethereum) return undefined

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        reset()
        return
      }

      setAddress(accounts[0])
      if (provider) {
        provider.getSigner().then(setSigner).catch(() => reset())
      }
    }

    const handleChainChanged = (chainIdHex: string) => {
      const parsed = parseInt(chainIdHex, 16)
      setChainId(Number.isNaN(parsed) ? null : parsed)
      if (window.ethereum) {
        const nextProvider = new EthersBrowserProvider(window.ethereum)
        setProvider(nextProvider)
        nextProvider.getSigner().then(setSigner).catch(() => reset())
      }
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)
    window.ethereum.on?.('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [provider, reset])

  return {
    address,
    chainId,
    provider,
    signer,
    connecting,
    isConnected: Boolean(address),
    connect,
    disconnect,
  }
}
