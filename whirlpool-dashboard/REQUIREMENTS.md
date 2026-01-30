# YieldSense Dashboard - Requirements

## Prerequisites

| Tool | Version | Download Link |
|------|---------|---------------|
| Node.js | 18+ | https://nodejs.org/ |
| pnpm | 8+ | `npm install -g pnpm` |
| Git | 2.40+ | https://git-scm.com/ |

---

## Frontend (whirlpool-dashboard)

### Core Dependencies
```
react: ^19.2.0
react-dom: ^19.2.0
react-router-dom: ^7.11.0
```

### Solana Wallet
```
@solana/web3.js: ^1.98.4
@solana/spl-token: ^0.4.14
@solana/wallet-adapter-base: ^0.9.27
@solana/wallet-adapter-react: ^0.15.39
@solana/wallet-adapter-react-ui: ^0.9.39
@solana/wallet-adapter-wallets: ^0.19.37
```

### Build Tools
```
vite: ^7.2.4
typescript: ~5.9.3
tailwindcss: ^4.0.0
```

---

## Lending Backend (server/)

### Core Dependencies
```
express: ^4.21.2
cors: ^2.8.5
dotenv: ^16.4.5
```

### Solana/Orca SDK
```
@coral-xyz/anchor: ^0.32.1
@orca-so/whirlpools: ^6.0.0
@orca-so/whirlpools-sdk: ^0.17.4
@orca-so/common-sdk: ^0.6.0
@solana/web3.js: ^1.98.4
@solana/spl-token: ^0.4.14
```

### Dev Tools
```
tsx: ^4.19.2
typescript: ^5.7.2
```

---

## Trading Backend (trading-api/)

### Core Dependencies
```
express: ^4.21.2
cors: ^2.8.5
dotenv: ^16.4.5
```

### Swap Routing
```
@jup-ag/api: ^6.0.35
@orca-so/whirlpools-sdk: ^0.17.4
@coral-xyz/anchor: ^0.32.1
@solana/web3.js: ^1.98.4
decimal.js: ^10.6.0
```

### Dev Tools
```
tsx: ^4.19.2
typescript: ^5.7.2
```

---

## Quick Install Commands

```powershell
# Frontend
cd whirlpool-dashboard
pnpm install

# Lending Backend
cd server
npm install

# Trading Backend
cd trading-api
npm install
```

---

## Environment Variables

### server/.env
```
RPC_URL=https://api.mainnet-beta.solana.com  # or Helius/QuickNode
PORT=3001
```

### trading-api/.env
```
RPC_URL=https://api.mainnet-beta.solana.com
PORT=3002
MAX_SLIPPAGE_BPS=500
```
