# DAO Gasless UI (Vite + React + ethers v6)

Interfaz para fondear un DAO, crear propuestas y votar vía meta-transacciones EIP-2771 usando un forwarder MinimalForwarder y un relayer Express.

## Requisitos
- Node 18+
- Anvil/Hardhat node en `http://127.0.0.1:8545` (chainId 31337 por defecto)
- Contratos desplegados: `DAOVoting` y `MinimalForwarder`

## Variables de entorno

Clona el ejemplo y ajusta direcciones:

```bash
cp .env.local.example .env.local
```

```
VITE_DAO_ADDRESS=0x...
VITE_FORWARDER_ADDRESS=0x...
VITE_CHAIN_ID=31337
VITE_RPC_URL=http://127.0.0.1:8545
VITE_RELAYER_URL=http://localhost:8787
```

Relayer (`daoApp/relayer/.env`):

```
RELAYER_PRIVATE_KEY=0x...
RPC_URL=http://127.0.0.1:8545
DAO_ADDRESS=0x...
FORWARDER_ADDRESS=0x...
MAX_PROPOSALS=50
INTERVAL_MS=10000
```

## Instalación

```bash
cd daoApp
npm install
```

## Correr la UI

```bash
npm run dev
# abre http://localhost:5173
```

## Relayer Express (puerto 8787)

```bash
cd daoApp/relayer
npm install
npm run dev
# healthcheck: http://localhost:8787/health
```

Daemon opcional para auto-ejecutar propuestas aprobadas:

```bash
npm run daemon
```

## Notas
- Votación gasless: la UI firma typed-data (EIP-712) y envía el request al relayer (`/api/relay`).
- El listado de propuestas usa `nextProposalId` cuando existe; si no, permite fijar un ID máximo y consulta una a una.
- Los fondos internos y el balance del DAO se muestran en la cabecera; la creación de propuestas revisa el 10% del balance como pre-chequeo UI. 
