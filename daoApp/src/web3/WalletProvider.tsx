import { createContext, useContext } from 'react'
import { useWallet, type WalletState } from './useWallet'

const WalletContext = createContext<WalletState | undefined>(undefined)

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wallet = useWallet()
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWalletContext debe usarse dentro de WalletProvider')
  }
  return ctx
}
