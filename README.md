# YieldSense: AI-Powered Concentrated Liquidity Position Manager for Orca Whirlpools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Blockchain: Solana](https://img.shields.io/badge/Blockchain-Solana-9945FF.svg?logo=solana&logoColor=white)](https://solana.com/)
[![DEX: Orca Whirlpools](https://img.shields.io/badge/DEX-Orca%20Whirlpools-FFD15C.svg)](https://www.orca.so/)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React%2019-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![Backend: Render](https://img.shields.io/badge/Backend-Render.com-46E3B7.svg?logo=render&logoColor=black)](https://render.com/)
[![ML Microservice: Railway](https://img.shields.io/badge/ML%20Engine-Railway.app-0B0D0E.svg?logo=railway&logoColor=white)](https://railway.app/)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-Verified%20Containers-2496ED.svg?logo=docker&logoColor=white)](https://hub.docker.com/u/markmayandi)

> **Quantitative DeFi infrastructure combining machine learning range forecasting, automated position management, and real-time risk telemetry for concentrated liquidity market makers.**

| Service | Environment | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **Interactive Web Application** | Firebase Hosting | [yieldsense-app.web.app](https://yieldsense-app.web.app/) | ![Active](https://img.shields.io/badge/status-active-brightgreen) |
| **Position Management API & WS** | Render.com | [yieldsense-backend-a8c2.onrender.com](https://yieldsense-backend-a8c2.onrender.com/health) | ![Active](https://img.shields.io/badge/backend-online-brightgreen) |
| **Trading Aggregation & Swap API** | Render.com | [yieldsense-trading-api-a8c2.onrender.com](https://yieldsense-trading-api-a8c2.onrender.com/health) | ![Active](https://img.shields.io/badge/trading--api-online-brightgreen) |
| **Quantitative ML Microservice** | Railway / Docker | [yieldsense-ml-api-production.up.railway.app](https://yieldsense-ml-api-production.up.railway.app/api/health) | ![Healthy](https://img.shields.io/badge/container-online-brightgreen) |
| **Docker Hub Container Registry** | Docker Hub | [markmayandi/yieldsense-ml-api](https://hub.docker.com/r/markmayandi/yieldsense-ml-api) | ![Docker](https://img.shields.io/badge/docker%20images-verified-blue) |

---

## Executive Summary

**YieldSense** is an enterprise-grade automated position management and analytics platform engineered specifically for Concentrated Liquidity Market Maker (CLMM) pools on the Solana blockchain (Orca Whirlpools). Concentrated liquidity increases capital efficiency by up to 4000x compared to traditional $x \cdot y = k$ invariant automated market makers; however, it subjects liquidity providers (LPs) to acute impermanent loss and out-of-range yield cessation when market prices shift beyond predefined tick boundaries.

YieldSense eliminates manual position adjustment and guesswork by coupling **GARCH(1,1) econometric volatility modeling**, **hybrid Gradient Boosting and LSTM price direction forecasting**, and **Orca Whirlpool SDK on-chain transaction builders**. The platform calculates mathematical yield curves across multiple fee tiers (0.01%, 0.04%, 0.30%), forecasts optimal 24-hour upper and lower price bounds, and alerts market makers before liquidity allocations experience range slippage.

---

## Market Inefficiency & Problem Statement

```
   TRADITIONAL AMM ($x \cdot y = k$)             CONCENTRATED LIQUIDITY (ORCA WHIRLPOOLS)
   +-------------------------------+             +-------------------------------+
   | Capital spread across         |             | Capital focused in narrow     |
   | $0 \to \infty$                |  =======>   | range $[P_a, P_b]$            |
   | Extremely low fee yields      |             | Up to 4000x capital density   |
   | Constant impermanent loss     |             | Risk: zero yield out-of-range |
   +-------------------------------+             +-------------------------------+
```

### Core Liquidity Provider Bottlenecks

1. **Range Exhaustion (Out-of-Range Risk):**
   - In CLMM pools, when price $P$ moves outside $[P_a, P_b]$, the position converts 100% into the depreciating asset and earns exactly zero fees until price re-enters the interval.
   - Passive LPs incur substantial opportunity costs and asymmetric downside exposure during trending market conditions.

2. **The Volatility-Spread Dilemma:**
   - Narrow price ranges yield maximum fee velocity during range-bound regimes but get liquidated/exhausted quickly during high-volatility spikes.
   - Broad ranges prevent out-of-range events but dilute fee yield to near-traditional AMM levels.

3. **Manual Execution Latency:**
   - Tracking tick movements across multiple Solana DEX pools manually requires constant on-chain monitoring and frequent manual transaction signing, resulting in suboptimal entry and exit execution.

---

## Multi-Tier Production Architecture

YieldSense coordinates four specialized services into a continuous, low-latency analytics and execution pipeline:

```mermaid
flowchart TD
    subgraph TIER1["Tier 1: Client Application (Firebase Hosting)"]
        WEB["React 19 Web Application<br/><code>https://yieldsense-app.web.app</code>"]
        WALLET["Solana Wallet Standard<br/>(Phantom / Solflare)"]
        WEB <--> WALLET
    end

    subgraph TIER2["Tier 2: Backend Protocol Gateways (Render.com)"]
        BACKEND["Whirlpool Position Manager & Real-Time WebSocket<br/><code>https://yieldsense-backend-a8c2.onrender.com</code><br/>Docker: markmayandi/yieldsense-backend:latest"]
        TRADING["Trading & Swap Aggregation API<br/><code>https://yieldsense-trading-api-a8c2.onrender.com</code><br/>Docker: markmayandi/yieldsense-trading-api:latest"]
    end

    subgraph TIER3["Tier 3: Quantitative ML & Volatility Microservice (Railway.app)"]
        ML["FastAPI ML Inference Container<br/><code>https://yieldsense-ml-api-production.up.railway.app</code><br/>Docker: markmayandi/yieldsense-ml-api:latest"]
        subgraph ENGINES["Engines Running Inside ML Container"]
            GARCH["GARCH(1,1) Volatility Estimator"]
            LSTM["Bi-LSTM Price Bounds Regressor"]
            FINBERT["FinBERT ONNX News Sentiment Analyzer"]
            STAKING["LST Staking APY Aggregator (JupSOL)"]
        end
        ML --- ENGINES
    end

    subgraph TIER4["Tier 4: Solana Mainnet Protocol"]
        RPC["Solana Mainnet RPC (Helius)"]
        ORCA["Orca Whirlpools CLMM Contracts"]
    end

    WEB <-->|HTTPS / WSS| BACKEND
    WEB <-->|HTTPS| TRADING
    WEB <-->|HTTPS| ML
    BACKEND <-->|RPC| ORCA
    TRADING <-->|Quote & Route| RPC
```

---

## Quantitative & Mathematical Methodology

### 1. Concentrated Liquidity Tick Mathematics
For an Orca Whirlpool with lower bound price $P_a$ and upper bound price $P_b$, the virtual liquidity $L$ supported by token amounts $\Delta x$ and $\Delta y$ satisfies:

$$\Delta x = L \left( \frac{1}{\sqrt{P}} - \frac{1}{\sqrt{P_b}} \right), \quad \Delta y = L \left( \sqrt{P} - \sqrt{P_a} \right)$$

The real capital efficiency multiplier $E$ relative to a standard $x \cdot y = k$ invariant is defined as:

$$E = \frac{1}{1 - \left( \frac{P_a}{P_b} \right)^{1/4}}$$

YieldSense evaluates this multiplier across tick steps ($\text{tick\_spacing} \in \{1, 8, 64, 128\}$) to maximize fee capture per unit of committed capital.

### 2. GARCH(1,1) Volatility Modeling
Short-term conditional return variance $\sigma_t^2$ is estimated using a generalized autoregressive conditional heteroskedasticity formulation:

$$\sigma_t^2 = \omega + \alpha \epsilon_{t-1}^2 + \beta \sigma_{t-1}^2$$

- **Constraint:** $\alpha + \beta < 1$ ensuring mean-reversion stability.
- **Dynamic Band Sizing:** Position width is scaled dynamically with conditional standard deviation $\sigma_t$:
  $$[P_a, P_b] = \left[ P_t \cdot \exp(-k \cdot \sigma_t \sqrt{\Delta t}), \; P_t \cdot \exp(k \cdot \sigma_t \sqrt{\Delta t}) \right]$$
  where $k$ is optimized based on user-selected risk profile (Aggressive, Moderate, Conservative).

### 3. Impermanent Loss Formulation in Range
When the price moves from entry price $P_0$ to current price $P$, the value of the concentrated position $V(P)$ relative to a simple hold strategy $V_{\text{hold}}(P)$ within range is given by:

$$\text{IL}(P) = \frac{2 \sqrt{P/P_0} - 1 - P/P_0}{(1 - \sqrt{P_a/P_0}) + \frac{P}{P_0}(1 - \sqrt{P_0/P_b})}$$

YieldSense computes the exact breakeven duration $\tau_{\text{be}}$ where cumulative fees offset maximum projected impermanent loss:

$$\tau_{\text{be}} = \frac{|\text{IL}(P)|}{\text{Fee APR} / 365}$$

---

## Supported Pools & Fee Tiers

| Pool Pair | Tick Spacing | Fee Tier | Strategy Focus | Status |
| :--- | :---: | :---: | :--- | :--- |
| **SOL / USDC** | 1 | 0.01% | High-volume stable peg / delta hedging | Active |
| **SOL / USDC** | 8 | 0.04% | Core algorithmic market making | Active |
| **JupSOL / SOL** | 1 | 0.01% | LST arbitrage and basis compounding | Active |
| **SOL / PENGU** | 64 | 0.30% | High-volatility fee capture | Active |
| **JUP / SOL** | 64 | 0.30% | Ecosystem momentum positioning | Active |

---

## Production API Reference

### 1. Position Management API (`https://yieldsense-backend-a8c2.onrender.com`)

| Endpoint | Method | Description | Sample Request | Key Response |
| :--- | :---: | :--- | :--- | :--- |
| `/health` | `GET` | Service health check and RPC status | `GET /health` | `status: "ok"` |
| `/api/positions/{wallet}` | `GET` | Retrieves active user Whirlpool positions | `GET /api/positions/9xQ...` | Position NFTs, tick lower, tick upper, liquidity |
| `/api/position/create-or-deposit`| `POST` | Builds unsigned transaction for Whirlpool deposit | `{"wallet": "...", "amountA": "1.5"}` | `serializedTransaction` (base64) |
| `/api/pool/{address}` | `GET` | Fetches live Whirlpool reserves and current tick | `GET /api/pool/HJP...` | Pool token reserves, current price, fee growth |
| `/api/pool/{address}/liquidity` | `GET` | Retrieves discrete tick array liquidity distribution | `GET /api/pool/HJP.../liquidity` | Array of tick indices and active liquidity depth |

### 2. Trading Aggregator API (`https://yieldsense-trading-api-a8c2.onrender.com`)

| Endpoint | Method | Description | Sample Request | Key Response |
| :--- | :---: | :--- | :--- | :--- |
| `/health` | `GET` | Trading service health check | `GET /health` | `status: "ok"` |
| `/trade/quote` | `GET` | Fetches optimal swap quote across Jupiter / Orca | `GET /trade/quote?inputMint=...` | `route`, `inAmount`, `outAmount`, `priceImpact` |
| `/trade/build` | `POST` | Serializes transaction for swap route execution | `{"inputMint": "...", "amount": "..."}` | `tx` (base64 unsigned transaction) |

### 3. Quantitative ML Engine (`https://yieldsense-ml-api-production.up.railway.app`)

| Endpoint | Method | Description | Sample Request | Key Response |
| :--- | :---: | :--- | :--- | :--- |
| `/api/health` | `GET` | Health check for ONNX volatility and FinBERT models | `GET /api/health` | `models.volatility: true`, `models.sentiment: true` |
| `/api/farming/quick-analysis`| `POST` | Real-time volatility bounds and safety conviction | `{"token_a": "sol", "token_b": "usdc"}` | `bounds_a`, `bounds_b`, `safety_score`, `signal` |
| `/api/news/{token}` | `GET` | FinBERT sentiment analysis of CryptoPanic feeds | `GET /api/news/sol` | `net_sentiment`, `trend: "bullish"`, `headlines` |
| `/api/staking/apy` | `GET` | Live staking APYs for Solana LSTs (JupSOL, mSOL) | `GET /api/staking/apy` | `lsts.jupSOL.total_apy`, `source` |

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Interface** | React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide Icons |
| **Backend Orchestrator** | Node.js, Express, TypeScript, WebSocket |
| **Quantitative ML** | Python 3.10+, FastAPI, NumPy, Pandas, Scikit-learn, ONNX Runtime, FinBERT |
| **Blockchain Infrastructure** | Solana Web3.js, Orca Whirlpools TypeScript SDK, Anchor Framework |
| **Real-Time Storage** | Firebase Firestore, Redis |
| **Alert Infrastructure** | Telegram Bot API, Firebase Cloud Functions |
| **Production Hosting** | Firebase Hosting (Frontend), Render.com (Backend & Trading), Railway.app (ML Container) |

---

## Installation & Local Development

### Prerequisites
- Node.js 18.x or 20.x
- Python 3.10+
- Rust & Cargo (if compiling Anchor contracts locally)
- Solana CLI tools (v1.18+)

### 1. Clone Repository
```bash
git clone https://github.com/Manimaran-tech/stable_yeildsense.git
cd stable_yeildsense
```

### 2. Install Dependencies
```bash
# Root and frontend dependencies
npm install
cd whirlpool-dashboard && npm install
cd ../server && npm install

# Python ML dependencies
cd ../ml-api
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create `.env` inside `server/` and `ml-api/`:
```env
# Server (.env)
PORT=3001
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
FIREBASE_PROJECT_ID=yieldsense-app
TELEGRAM_BOT_TOKEN=your_bot_token

# ML API (.env)
PORT=8000
REDIS_URL=redis://localhost:6379
```

### 4. Launch Services
```powershell
# Windows PowerShell automated orchestrator
powershell -ExecutionPolicy Bypass -File start_services.ps1
```

---

## Security & Non-Custodial Architecture

- **Client-Side Key Management:** Private keys and seed phrases are never ingested, transmitted, or stored on YieldSense servers. All transactions are compiled as serialized payloads and returned to client wallets (Phantom, Solflare) for cryptographic signing.
- **Slippage Protection:** All position creation transactions enforce rigorous on-chain `slippage_tolerance` parameters to eliminate sandwich attacks and front-running on decentralized exchanges.
- **Deterministic Program Invocations:** On-chain calls interact directly with audited Orca Whirlpool protocol smart contracts on Solana mainnet.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
Underlying Orca Whirlpools contracts and SDKs are subject to their respective licenses from Orca Management Company S.A.
