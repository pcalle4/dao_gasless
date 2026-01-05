import type { ForwardRequest } from '../gasless/forwarderEip712'

const getRelayerUrl = () => {
  const url = import.meta.env.VITE_RELAYER_URL
  if (!url) throw new Error('Falta VITE_RELAYER_URL en el entorno')
  return url
}

const serializeRequest = (request: ForwardRequest) => ({
  ...request,
  value: request.value.toString(),
  gas: request.gas.toString(),
  nonce: request.nonce.toString(),
})

export const relayMetaTx = async (request: ForwardRequest, signature: string) => {
  const response = await fetch(`${getRelayerUrl()}/api/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: serializeRequest(request), signature }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'No se pudo reenviar la transacción meta')
  }

  return response.json() as Promise<{ txHash: string }>
}
