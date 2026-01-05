import { formatEther, parseEther } from 'ethers'

export const formatEth = (value?: bigint | null) => {
  if (value === undefined || value === null) return '0.0'
  return formatEther(value)
}

export const parseEthInput = (value: string) => {
  try {
    return parseEther(value || '0')
  } catch (err) {
    return null
  }
}
