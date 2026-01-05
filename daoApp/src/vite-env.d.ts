/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DAO_ADDRESS: string
  readonly VITE_FORWARDER_ADDRESS: string
  readonly VITE_CHAIN_ID: string
  readonly VITE_RPC_URL: string
  readonly VITE_RELAYER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
