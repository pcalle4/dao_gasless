import { useState } from 'react'
import { formatEth } from '../web3/format'

interface FundingPanelProps {
  daoAddress: string
  daoBalance: bigint
  userBalance: bigint
  onDeposit: (amountEth: string) => Promise<boolean>
  onRefresh?: () => void
  loadingBalances?: boolean
  isConnected: boolean
}

const FundingPanel: React.FC<FundingPanelProps> = ({
  daoAddress,
  daoBalance,
  userBalance,
  onDeposit,
  onRefresh,
  loadingBalances,
  isConnected,
}) => {
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    const ok = await onDeposit(amount)
    setSubmitting(false)
    if (ok) setAmount('')
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="label">Cofre del DAO</p>
          <p className="value">{formatEth(daoBalance)} ETH</p>
          <p className="muted mono">{daoAddress}</p>
        </div>
        <div>
          <p className="label">Tu balance interno</p>
          <p className="value">{formatEth(userBalance)} ETH</p>
          {loadingBalances ? <p className="muted">Actualizando...</p> : null}
          <div className="input-inline">
            <button onClick={onRefresh} disabled={loadingBalances}>
              {loadingBalances ? 'Refrescando...' : 'Refrescar'}
            </button>
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label className="label" htmlFor="amount">
            Depositar (ETH)
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.001"
            placeholder="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isConnected || submitting}
          />
        </div>
        <div className="actions">
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={!isConnected || submitting || !amount}
          >
            {submitting ? 'Enviando...' : 'Depositar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FundingPanel
