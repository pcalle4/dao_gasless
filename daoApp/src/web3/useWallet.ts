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
  accounts: string[]
  chainId: number | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  connecting: boolean
  isConnected: boolean
  connect: () => Promise<void>
  selectAccount: (nextAddress: string) => Promise<void>
  disconnect: () => void
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<string[]>([])
  const [chainId, setChainId] = useState<number | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [connecting, setConnecting] = useState(false)

  const reset = useCallback(() => {
    setAddress(null)
    setAccounts([])
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
      // Intentamos pedir permisos primero para que MetaMask vuelva a mostrar el selector
      let accounts: string[] = []
      if (window.ethereum.request) {
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          })
        } catch (_err) {
          // ignorar, seguimos con la solicitud de cuentas estándar
        }
        accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? []
      } else {
        accounts = await browserProvider.send('eth_requestAccounts', [])
      }
      const signerInstance = await browserProvider.getSigner()
      const network = await browserProvider.getNetwork()

      setProvider(browserProvider)
      setSigner(signerInstance)
      setAccounts(accounts ?? [])
      setAddress(accounts?.[0] ?? null)
      setChainId(Number(network.chainId))
    } finally {
      setConnecting(false)
    }
  }, [])

  const selectAccount = useCallback(
    async (nextAddress: string) => {
      if (!provider) return
      const signerInstance = await provider.getSigner(nextAddress)
      setSigner(signerInstance)
      setAddress(nextAddress)
    },
    [provider],
  )

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

      setAccounts(accounts)
      if (!address || !accounts.includes(address)) {
        setAddress(accounts[0])
      }
      if (provider) {
        const nextAddress = address && accounts.includes(address) ? address : accounts[0]
        provider.getSigner(nextAddress).then(setSigner).catch(() => reset())
      }
    }

    const handleChainChanged = (chainIdHex: string) => {
      const parsed = parseInt(chainIdHex, 16)
      setChainId(Number.isNaN(parsed) ? null : parsed)
      if (window.ethereum) {
        const nextProvider = new EthersBrowserProvider(window.ethereum)
        setProvider(nextProvider)
        const nextAddress = address ?? undefined
        nextProvider.getSigner(nextAddress).then(setSigner).catch(() => reset())
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
    accounts,
    chainId,
    provider,
    signer,
    connecting,
    isConnected: Boolean(address),
    connect,
    selectAccount,
    disconnect,
  }
}
