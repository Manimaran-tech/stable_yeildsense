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
  <i>Maximize your DeFi yields with intelligent range predictions</i>
</p>

<p align="center">
  <a href="https://yieldsense-app.web.app/">Live Demo</a>
</p>

---

## Overview

YieldSense is an advanced liquidity management platform that combines machine learning and real-time analytics to optimize concentrated liquidity positions on Orca Whirlpools. The platform enables users to make data-driven decisions when providing liquidity on the Solana blockchain.

---

## Deployment

YieldSense is deployed and publicly accessible at:

**Live URL:** https://yieldsense-app.web.app/

This deployment mirrors the full functionality of the development environment and demonstrates a production-ready architecture for AI-powered DeFi tools.

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
|  |            Orca Whirlpools  |  SPL Tokens                   |   |
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
| **Database** | Firebase Firestore |
| **Alerts** | Telegram Bot API |
| **Hosting** | Thinkroot, Render.com |

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
- **Supported Tokens**: JupSOL

---

## Security

- **Client-Side Signing**: No private keys are stored on servers
- **Environment Variables**: All secrets are managed through environment configuration
- **Rate Limiting**: Configured RPC endpoints with appropriate limits

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>YieldSense - Smarter Liquidity, Better Yields</b>
</p>
