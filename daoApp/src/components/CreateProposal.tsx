import { useMemo, useState } from 'react'
import { formatEth } from '../web3/format'

interface CreateProposalProps {
  onCreate: (params: { recipient: string; amountEth: string; deadline: number }) => Promise<boolean>
  daoBalance: bigint
  userBalance: bigint
  isConnected: boolean
}

const CreateProposal: React.FC<CreateProposalProps> = ({
  onCreate,
  daoBalance,
  userBalance,
  isConnected,
}) => {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const creationThreshold = useMemo(
    () => (daoBalance === 0n ? 0n : (daoBalance * 10n) / 100n),
    [daoBalance],
  )
  const canCreate = userBalance >= creationThreshold

  const handleSubmit = async () => {
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000)
    setSubmitting(true)
    const ok = await onCreate({ recipient, amountEth: amount, deadline: deadlineTs })
    setSubmitting(false)
    if (ok) {
      setRecipient('')
      setAmount('')
      setDeadline('')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="label">Crear propuesta</p>
          <p className="muted">
            Necesitas al menos el 10% del balance del DAO para lanzar propuestas.
          </p>
        </div>
        <div className="status-pill">
          <span>Tu poder</span>
          <strong>
            {formatEth(userBalance)} / {formatEth(creationThreshold)} ETH
          </strong>
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="recipient">
            Destinatario
          </label>
          <input
            id="recipient"
            type="text"
            placeholder="0xRecipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={!isConnected || submitting}
          />
        </div>
        <div>
          <label className="label" htmlFor="amount">
            Monto (ETH)
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.001"
            placeholder="1.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isConnected || submitting}
          />
        </div>
        <div>
          <label className="label" htmlFor="deadline">
            Deadline (fecha y hora)
          </label>
          <input
            id="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={!isConnected || submitting}
          />
        </div>
        <div className="actions">
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={!isConnected || submitting || !recipient || !amount || !deadline || !canCreate}
          >
            {submitting ? 'Creando...' : 'Crear propuesta'}
          </button>
          {!canCreate ? (
            <p className="muted small">
              Necesitas al menos el 10% del balance del DAO para crear propuestas.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CreateProposal
