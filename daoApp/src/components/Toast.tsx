const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null
  return <div className="toast">{message}</div>
}

export default Toast
