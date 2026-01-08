import { useWalletContext } from '../web3/WalletProvider'

const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

const ConnectWallet: React.FC = () => {
  const { address, accounts, chainId, connect, disconnect, selectAccount, connecting, isConnected } =
    useWalletContext()

  return (
    <div className="card connect-card">
      <div>
        <p className="label">Wallet</p>
        <p className="value">
          {address ? shortAddress(address) : 'No conectada'}{' '}
          {chainId ? <span className="pill">Chain {chainId}</span> : null}
        </p>
        {isConnected && accounts.length > 1 ? (
          <select
            className="account-select"
            value={address ?? ''}
            onChange={(e) => selectAccount(e.target.value)}
            disabled={connecting}
          >
            {accounts.map((acct) => (
              <option key={acct} value={acct}>
                {acct}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {isConnected ? (
        <div className="button-row">
          <button className="primary" onClick={connect} disabled={connecting}>
            {connecting ? 'Conectando...' : 'Cambiar cuenta'}
          </button>
          <button onClick={disconnect} disabled={connecting}>
            Desconectar
          </button>
        </div>
      ) : (
        <button className="primary" onClick={connect} disabled={connecting}>
          {connecting ? 'Conectando...' : 'Conectar MetaMask'}
        </button>
      )}
    </div>
  )
}

export default ConnectWallet
