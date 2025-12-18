# DAO Gasless

This project contains a Gasless DAO implementation, consisting of a frontend application and smart contracts.

## Project Structure

- **[daoApp](./daoApp)**: The frontend application built with React + Vite.
- **[sc](./sc)**: The smart contracts managed with Foundry.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [Foundry](https://getfoundry.sh/)

### Frontend (daoApp)

Navigate to the `daoApp` directory to run the frontend:

```bash
cd daoApp
npm install
npm run dev
```

### Smart Contracts (sc)

Navigate to the `sc` directory to work with the smart contracts:

```bash
cd sc
forge build
forge test
```
