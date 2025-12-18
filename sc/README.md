## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Commands

### Setup

```shell
# Install dependencies
forge install

# Setup env
cp .env.example .env
# Edit .env with your private key
```

### Run Tests

```shell
forge test -vvv
```

### Local Deployment (Anvil)

1. Start Anvil:

```shell
anvil
```

2. Deploy:

```shell
source .env
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```
