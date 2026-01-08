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
cat <<'EOF' > .env
PRIVATE_KEY=0x...
RPC_URL=http://127.0.0.1:8545
EOF
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

2. Create `sc/.env` with the deployer key (Anvil default is fine):

```shell
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=http://127.0.0.1:8545
```

3. Deploy and capture the output:

```shell
source .env
forge script script/DeployLocal.s.sol --rpc-url $RPC_URL --broadcast | tee deploy.log
```

4. Auto-copy the addresses into the UI/relayer envs:

```shell
node -e "
const fs = require('fs');
const log = fs.readFileSync('deploy.log', 'utf8');
const match = (label) => {
  const re = new RegExp(label + ' deployed at:\\\\s*(0x[a-fA-F0-9]{40})');
  const m = log.match(re);
  if (!m) throw new Error('No se encontró ' + label + ' en deploy.log');
  return m[1];
};
const dao = match('DAOVoting');
const forwarder = match('MinimalForwarder');
const replaceEnv = (path, updates) => {
  let content = fs.readFileSync(path, 'utf8');
  for (const [key, val] of Object.entries(updates)) {
    const re = new RegExp('^' + key + '=.*$', 'm');
    if (re.test(content)) content = content.replace(re, key + '=' + val);
    else content += '\\n' + key + '=' + val;
  }
  fs.writeFileSync(path, content);
};
replaceEnv('../daoApp/.env', {
  VITE_DAO_ADDRESS: dao,
  VITE_FORWARDER_ADDRESS: forwarder
});
replaceEnv('../daoApp/relayer/.env', {
  DAO_ADDRESS: dao,
  FORWARDER_ADDRESS: forwarder
});
console.log('Actualizado daoApp/.env y daoApp/relayer/.env');
"
```
