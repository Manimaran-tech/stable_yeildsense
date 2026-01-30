<p align="center">
  <img src="https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white" alt="Solana"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
</p>

<h1 align="center">YieldSense</h1>

<p align="center">
  <b>AI-Powered Concentrated Liquidity Position Manager for Orca Whirlpools on Solana</b>
</p>

<p align="center">
  <i>Maximize your DeFi yields with intelligent range predictions and privacy-preserving deposits</i>
</p>

<p align="center">
  <a href="https://yieldsense-dashboard-egq-zb.thinkroot.app/">Live Demo</a>
</p>

---

## Overview

YieldSense is an advanced liquidity management platform that combines machine learning, real-time analytics, and privacy-preserving technology to optimize concentrated liquidity positions on Orca Whirlpools. The platform enables users to make data-driven decisions when providing liquidity on the Solana blockchain.

---

## Deployment Options

YieldSense is available in two deployment configurations:

### Local Development Environment

The primary development version runs locally and provides the complete feature set. To use this version:

1. Clone the repository from GitHub
2. Install dependencies for all services (Frontend, Backend, ML API, Trading API)
3. Run all four services locally using the provided startup script

This approach gives full control over the environment and allows developers to explore, modify, and extend the codebase. Refer to the Quick Start section below for detailed installation instructions.

### Thinkroot Production Deployment

To validate the system architecture under different conditions, the complete YieldSense application was deployed on Thinkroot infrastructure. This deployment allows observation of system performance under:

- Different network latency conditions
- Varied user behavior patterns
- Alternative liquidity pool interactions
- External infrastructure dependencies

The Thinkroot deployment mirrors the full functionality of the local development environment and serves as a reference implementation for production-grade deployments.

**Thinkroot URL:** [https://yieldsense-dashboard-egq-zb.thinkroot.app/](https://yieldsense-dashboard-egq-zb.thinkroot.app/)

---

## Key Features

### AI-Powered Range Prediction
- Machine learning models analyze historical price data and market volatility
- Dynamic recommendations that adapt to current market sentiment
- Confidence scores to support informed decision-making

### Real-Time Yield Estimation
- 24-hour yield calculations based on pool volume and fee tier
- Concentration heuristics showing expected returns before deposit
- Accurate fee tier scaling (0.01%, 0.04%, 0.30%)

### Privacy-Preserving Deposits with Inco Network
YieldSense integrates the **Inco Network Solana SDK** for enhanced privacy:
- Encrypted deposit amounts using Inco's confidential computing
- Deposit values are hidden from on-chain observers
- Full transparency maintained only for the depositor
- Protects users from front-running and MEV exploitation

### Telegram Alert System
- Real-time out-of-range notifications when positions require attention
- Firebase-powered monitoring infrastructure
- Customizable alert thresholds per position

### Interactive Dashboard
- Modern, responsive user interface with glassmorphism design
- Live price charts and liquidity distribution visualization
- Streamlined position creation workflow

---

## Architecture

```
+-------------------------------------------------------------------+
|                        YIELDSENSE STACK                            |
+-------------------------------------------------------------------+
|                                                                    |
|  +----------------+  +----------------+  +----------------------+  |
|  |   Frontend     |  |   Backend      |  |      ML API          |  |
|  |    (React)     |  |  (Express)     |  |   (FastAPI/Python)   |  |
|  |                |  |                |  |                      |  |
|  | - Dashboard    |  | - Position     |  | - Price Prediction   |  |
|  | - Charts       |<>|   Manager      |<>| - Volatility Model   |  |
|  | - Wallet       |  | - WebSocket    |  | - Sentiment Analysis |  |
|  |   Connect      |  | - Pool Data    |  | - Staking APY        |  |
|  +----------------+  +----------------+  +----------------------+  |
|         |                  |                     |                 |
|  +------------------------------------------------------------+   |
|  |                    SOLANA BLOCKCHAIN                        |   |
|  |   Orca Whirlpools  |  Inco Encryption  |  SPL Tokens        |   |
|  +------------------------------------------------------------+   |
|                                                                    |
|  +----------------+  +---------------------------------------+     |
|  |  Monitoring    |  |              Firebase                 |     |
|  |   Service      |<>|  - Alert Rules - User Preferences     |     |
|  |  (Telegram)    |  |                                       |     |
|  +----------------+  +---------------------------------------+     |
|                                                                    |
+-------------------------------------------------------------------+
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Radix UI |
| **Backend** | Node.js, Express, TypeScript, WebSocket |
| **ML API** | Python, FastAPI, scikit-learn, TensorFlow, Transformers |
| **Blockchain** | Solana, Orca Whirlpools SDK, Anchor Framework |
| **Privacy** | Inco Network Solana SDK |
| **Database** | Firebase Firestore |
| **Alerts** | Telegram Bot API |
| **Hosting** | Thinkroot, Render.com |

---

## Inco Network Integration

YieldSense leverages **Inco Network** for privacy-preserving liquidity deposits:

- **Confidential Transactions**: Deposit amounts are encrypted before being submitted on-chain
- **MEV Protection**: Hidden transaction values prevent front-running attacks
- **User Privacy**: Only the depositor can decrypt and view their actual deposit amounts
- **SDK Integration**: Utilizes `@inco/solana-sdk` for seamless encryption/decryption operations

This integration ensures that large liquidity providers can participate in DeFi without exposing their strategies to competitors or malicious actors.

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Solana Wallet (Phantom, Solflare, or compatible)

### Installation

```bash
# Clone the repository
git clone https://github.com/Manimaran-tech/Yeildsense.git
cd Yeildsense

# Install dependencies
npm install
cd whirlpool-dashboard && npm install
cd server && npm install
cd ../ml-api && pip install -r requirements.txt
```

### Running All Services

```powershell
# Windows - Launch all services in separate windows
powershell -ExecutionPolicy Bypass -File start_services.ps1
```

**Services:**

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3005 | React Dashboard (Vite) |
| Backend | 3001 | Position Manager API |
| ML API | 8000 | AI Prediction Service |
| Trading API | 3002 | Swap Aggregation Service |

---

## Supported Pools

| Pool | Fee Tier | Status |
|------|----------|--------|
| SOL/USDC | 0.01% | Active |
| SOL/USDC | 0.04% | Active |
| JupSOL/SOL | 0.01% | Active |
| SOL/PENGU | 0.30% | Active |
| JUP/SOL | 0.30% | Active |

---

## ML Model Details

### Price Prediction
- **Algorithm**: Gradient Boosting with LSTM hybrid approach
- **Features**: OHLCV data, volatility metrics, volume trends
- **Performance**: Approximately 78% directional accuracy (24-hour horizon)

### Volatility Analysis
- **Model**: GARCH(1,1) for short-term volatility estimation
- **Output**: Expected price range with confidence intervals

### Staking APY Calculation
- **Sources**: Real-time RPC inflation rate and MEV rewards
- **Supported Tokens**: JupSOL, mSOL, bSOL, stSOL

---

## Security

- **Client-Side Signing**: No private keys are stored on servers
- **Inco Encryption**: Deposit amounts are encrypted on-chain
- **Environment Variables**: All secrets are managed through environment configuration
- **Rate Limiting**: Configured RPC endpoints with appropriate limits

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>YieldSense - Smarter Liquidity, Better Yields</b>
</p>
