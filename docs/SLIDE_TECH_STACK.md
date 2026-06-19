# Slide — Technology Stack

---

## BUILT ON HEDERA

---

### On-Chain Infrastructure

| | Technology | Role |
|---|---|---|
| ⚡ | **Hedera Smart Contract Service** | Reward engine — staking, PoA/PoRx logic, credit scoring, AZM payouts |
| 📡 | **Hedera Consensus Service (HCS)** | Trustless coordination between ground stations |
| 🕐 | **Hedera Schedule Service (HSS)** | Autonomous epoch settlement — no keeper, no cron job |
| 🔍 | **Hedera Mirror Node** | Powers both dashboards — zero backend infrastructure |

---

### Storage

| | Technology | Role |
|---|---|---|
| 🌐 | **Arweave via Irys** | Permanent storage of raw packets and merged satellite images |

---

### Smart Contracts

| | Technology | Role |
|---|---|---|
| 📄 | **Solidity / Hardhat** | OrbitalVault, CreditRegistry, AzimuthToken |
| 🔗 | **ethers.js + Hedera SDK** | On-chain interactions and HCS messaging |

---

### Hardware

| | Technology | Role |
|---|---|---|
| 📻 | **Heltec WiFi LoRa 32 V4** | ESP32 + SX1262 — satellite transmitter & receiver nodes |
| 🔌 | **915 MHz LoRa** | Real RF signal transmission and reception |

---

### Software

| | Technology | Role |
|---|---|---|
| 🐍 | **Python / Pygame** | Ground station software, live image reconstruction |
| ⚛️ | **Next.js / React** | Ground station dashboard & image archive dashboard |
| 🟢 | **Node.js** | Hedera client — heartbeat, PoRx, merger, state tracker |
