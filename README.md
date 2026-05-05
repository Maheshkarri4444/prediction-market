# 🧠 Prediction Marketplace Protocol

A decentralized prediction marketplace built on Solana, enabling users to create and participate in both **price-based** and **event-based** prediction markets, secured with on-chain logic and DAO governance.

---

## 🧠 About the Project

This project is a fully on-chain **Prediction Marketplace Protocol built on Solana**, supporting both **token price-based markets** (powered by Pyth oracles) and **event-based markets governed by a DAO**.

Users can create markets, provide liquidity, and trade outcome shares dynamically, while event markets are resolved through a **stake-weighted consensus mechanism** with economic incentives for truthful participation. The system combines **AMM-style pricing**, **oracle integration**, and **DAO governance** into a single cohesive protocol.

From a development perspective, this project significantly deepened my understanding of:

- Solana account model and PDA design  
- Secure fund handling and lamports management  
- Anchor framework and instruction architecture  
- Oracle integration (Pyth) and deterministic resolution
- Dealing with Dao and prediction marketplace logic. 
- Designing incentive-compatible systems (staking, slashing, rewards)  
- Building full-stack dApps with real-time state synchronization  

Overall, this project served as a hands-on exploration of building **production-grade Solana protocols**, strengthening both my smart contract and frontend integration skills.

---

## ⚙️ Tech Stack

- **Solana (Rust + Anchor)** — smart contracts & on-chain logic  
- **React + Vite** — frontend UI    
- **Pyth Network** — real-time price oracle feeds  
- **Wallet Adapter** — Phantom wallet integration  

---

## 🏗️ Architecture Overview

The protocol is divided into two core systems:

---

### 📈 Token Prediction Market
#### 📊 Architecture Diagram:
<img width="2560" height="1262" alt="image" src="https://github.com/user-attachments/assets/99a76b0f-f7f7-4cbd-b30f-fbaaacafa0d0" />


- Create markets based on **real-time token prices** (e.g., SOL > $150 at time T)  
- Uses **Pyth oracle feeds** to fetch and verify asset prices on-chain  
- Supports multiple market types (greater than, less than, range, percentage moves)  
- Users place orders and contribute liquidity into option pools  
- Markets are resolved deterministically using oracle price data  

---

### 🗳️ Event Prediction Market (DAO-based)
#### 📊 Architecture Diagram:
<img width="2252" height="1412" alt="image" src="https://github.com/user-attachments/assets/c596e008-cc98-4b2c-95bf-08fa9e5173f8" />


- Users create markets for **real-world events** (e.g., elections, outcomes)  
- DAO participants vote by staking on outcomes  
- Resolution is based on **majority stake consensus + quorum rules**  
- Includes **economic incentives** for honest voting (reward + slashing model)  
- DAO treasury accumulates fees and redistributes rewards  

---

## 🔁 Token Prediction Market — Complete Flow

### 👤 User Flow

- User connects wallet and creates a **user account**
- User is redirected to the **Prediction Marketplace Dashboard**
- User can create a new market by selecting:
  - Question type (e.g., greater than, less than, range, percentage move)
  - Token and target time
  - Options are added explicitly via an **"Add Option"** action in the UI
  - Internally:
    - A **new token mint** is generated for each option
    - A **virtual liquidity of 10 SOL** is automatically assigned (non-claimable)
- A **market creation fee of 0.1 SOL** is paid to initialize the market
- All active markets are visible on the dashboard
- Users can **buy shares (participate)** in any market before the market end time
- After the target time is reached:
  - Any user can trigger **"Resolve Market"**
  - Resolver receives a **0.075 SOL reward**
- Market outcome is determined using **Pyth oracle price feeds**
  - (Currently limited to a few assets on devnet)

---

### 💰 Pricing Mechanism

- Each option starts with a **virtual liquidity of 10 SOL**
  - This is **non-claimable**
  - Used to prevent extreme price swings at initialization

- Token unit:
  - `1 token = 1,000,000 units`

- Price calculation:

  - **Total Pool**  
    = Sum of all options’ (real pool + virtual pool)

  - **Computed Price**
    ```
    computed_price = (selected_option_pool + virtual_pool) * 10^6 / total_pool
    ```

- Cost calculation:
    ```
    required_amount = (computed_price * quantity * lamports_per_sol) / (10^6 * 10^6)
    ```
  - Ensures:
  - Dynamic pricing based on demand
  - Liquidity-sensitive market behavior
  - Smooth price movement due to virtual liquidity

## 🗳️ Event Prediction Market — Complete Flow

### 👤 User Flow

- Users create event markets similar to token markets
- Supports two question types:
  - **Binary** (Yes / No)
  - **Multi-option** (custom option names)
- User creates market and adds options via UI
- Users participate by **placing orders (staking on outcomes)** before event end time
- Market pool grows based on user participation

---

### 🏛️ DAO Participation Flow

- User connects wallet and creates a **DAO user account**
- Upon registration:
  - An **NFT is minted** representing DAO membership
  - Metadata is stored on **IPFS**
  - **0.5 SOL** is charged as creation fee. 
- User is redirected to the **DAO Dashboard**, showing:
  - Total DAO stake
  - User-specific stake and details
- DAO users stake SOL to participate in governance

---

### 🗳️ Voting & Resolution

- All event markets are visible to DAO participants
- After event end time:
  - DAO users **vote on outcomes** using their staked SOL
- Outcome is determined by:
  - **Supermajority of staked votes**
  - **Quorum requirement: ≥ 10% of total DAO stake**
- Once quorum is reached:
  - Any user can **resolve the market**

---

### 💰 Incentive & Reward Mechanism

- **5% of total market pool** is allocated as DAO reward
- Rewards are distributed only to users who voted correctly

- After resolution:
  - DAO voters can **claim back their stake + rewards**
  - Reward formula:
    - Share of **slashed stake from incorrect voters**
    - Share of **5% market reward pool**

- If a user votes incorrectly:
  - Their staked amount is **slashed**

---

### ⚖️ Design Goals

- Ensures **truthful consensus through economic incentives**
- Maintains **liveness via participation rewards**
- Aligns DAO incentives with **correct market resolution**

## 🌐 Deployment
🌐 Live demo: https://solana-prediction-market-five.vercel.app/  
🔧 The protocol will continue to evolve with incremental improvements and new capabilities.
