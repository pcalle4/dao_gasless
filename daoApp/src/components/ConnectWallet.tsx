import { useWalletContext } from '../web3/WalletProvider'

const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

const ConnectWallet: React.FC = () => {
  const { address, chainId, connect, disconnect, connecting, isConnected } = useWalletContext()

  return (
    <div className="card connect-card">
      <div>
        <p className="label">Wallet</p>
        <p className="value">
          {address ? shortAddress(address) : 'No conectada'}{' '}
          {chainId ? <span className="pill">Chain {chainId}</span> : null}
        </p>
      </div>
      <button className="primary" onClick={isConnected ? disconnect : connect} disabled={connecting}>
        {connecting ? 'Conectando...' : isConnected ? 'Desconectar' : 'Conectar MetaMask'}
      </button>
    </div>
  )
}

export default ConnectWallet
