# AZIMUTH — Decentralized Satellite Ground Station Network

---

## The Problem

Right now, satellites are passing overhead and transmitting data — images, atmospheric readings, environmental signals. Most of it is lost. Not because the hardware to receive it doesn't exist. Because the economic infrastructure to make receiving it worthwhile doesn't exist.

Today's satellite ground station market has four compounding failures:

**1. Corporate gatekeeping.** A handful of companies control the world's ground station networks. They decide who gets access, at what price, and can revoke it at any time. There is no transparency and no open market.

**2. Prohibitive cost.** A professional ground station build costs $100,000+. Cloud alternatives like AWS Ground Station charge per-minute fees ($22/min) that are unreachable for research teams, startups, NGOs, and independent operators. The barrier is not technical — it is financial.

**3. Data loss from single-station coverage.** A satellite passes overhead in minutes. One ground station captures a fraction of transmitted packets — you get a partial image, partial data, gaps you cannot fill. There is no protocol to coordinate multiple receivers into one complete result.

**4. No incentive layer.** Independent operators who could set up a ground station have no reason to. There is no payment, no proof their work happened, and no verifiable record of their contribution. The network never grows because participation is not rewarded.

---

## The Solution

Azimuth is a decentralized satellite ground station network. It turns an RTL radio into economically productive physical infrastructure by connecting it to Hedera's financial layer.

**In one sentence:** anyone can run a ground station, receive real satellite transmissions, submit cryptographic proof of that reception on Hedera, and earn AZM token rewards automatically.

The key insight is that Hedera is not just the deployment chain. It is the coordination layer, the settlement layer, and the credit history layer. The chain is the protocol.

Every reception is permanently anchored on Hedera. Not stored in a server. Not in a database that can be shut down. On-chain, immutable, forever.

---

## Business Use Cases

| Sector | Use Case | Why Azimuth |
|--------|----------|-------------|
| Weather services | Real-time atmospheric and storm data | Dense independent networks provide coverage commercial stations miss |
| Precision agriculture | Crop monitoring via satellite imagery | Low-cost reception nodes in rural areas where data is needed most |
| Disaster response | Infrastructure-independent data relay | Decentralized nodes stay online when centralized systems fail |
| Environmental monitoring | Pollution, deforestation, ocean surface temp | NGOs can run their own nodes at a fraction of $100,000 |
| Academic research | Space science and radio astronomy programs | Universities can participate without enterprise contracts |
| Satellite operators | Ground station coverage as a service | Pay operators per verified pass instead of owning infrastructure |

### Organizations Operating Their Own Satellites

These are smallsat and CubeSat operators — startups, universities, defense contractors, IoT satellite companies — who have launched their own satellites but cannot afford to build a global ground station network to receive their own data. Today they either pay $22/min to AWS Ground Station or $100,000+ to build one station. Azimuth lets them contract coverage from a global network of independent operators who receive their satellite's transmissions and submit cryptographic proof of every packet received — verified on Hedera, paid automatically.

---

## Why Hedera

Traditional DePIN projects deploy on a generic EVM chain because it is convenient. Azimuth is different — Hedera is financially integral to how the network operates.

Hedera provides low-cost, high-throughput infrastructure with native services purpose-built for real-world coordination. That is precisely what Azimuth needs — ground station operators coordinating in real time, settling rewards automatically, and building a permanent on-chain record of their contribution.

| Hedera Property | How Azimuth Uses It |
|-----------------|---------------------|
| **Hedera Consensus Service (HCS)** | Trustless, timestamped coordination between ground stations. Every packet upload announcement and merge result is posted to an HCS topic — no direct station-to-station communication ever occurs. Hedera is the coordination layer. |
| **Hedera Scheduled Transactions (HSS)** | PoA epoch settlements are triggered via on-chain scheduled calls — fully automated, no human in the loop. Reward payouts execute exactly when conditions are met. |
| **EVM Smart Contracts** | OrbitalVault and CreditRegistry are Solidity contracts deployed on Hedera's EVM. Full Hardhat/ethers.js tooling, familiar developer experience. |
| **Low fees (~$0.001/tx)** | Ground stations send heartbeats every 60 seconds and submit proofs after every pass. High-frequency on-chain activity is only viable at Hedera's fee level. |
| **Fast finality (3–5s)** | PoRx verification and AZM payout happen in the same block as the verifier's call — near real-time reward confirmation. |
| **Mirror Node REST API** | Free, unauthenticated queries for HCS messages, token balances, and contract events power both dashboards with no backend infrastructure. |
| **Credit History** | Operators build a permanent on-chain financial identity from their work. High uptime + high reception quality = high credit score = higher rewards. This history is the foundation for hardware financing. |

Using HBAR as the staking token means operators have real economic skin in the game using Hedera's native token. Slash events burn HBAR permanently — an on-chain, irreversible consequence. The network's security is backed by Hedera's own monetary policy.

---

## Proof of Availability (PoA) — Getting Paid to Stay Online

Proof of Availability answers the question: is this ground station actually running and reachable?

Every 60 seconds, each active ground station sends a `heartbeat()` transaction to the OrbitalVault contract on Hedera. The contract records the timestamp and increments the station's heartbeat count for the current epoch.

Every epoch (6 hours in production, 5 minutes in demo), a keeper-triggered `settlePoAEpoch()` call evaluates every registered station:

- Did the station meet the minimum heartbeat threshold this epoch?
- If yes: it is qualified. AZM reward is calculated as `base reward × credit multiplier` and transferred automatically.
- If no: it receives nothing and the miss is recorded in CreditRegistry.

The multiplier is pulled live from `CreditRegistry.getMultiplier()` — a Bronze operator earns 1x, a Platinum operator earns 2x. There is no manual configuration, no administrator decision. The smart contract does it.

`recordEpochParticipation()` is called for every station every epoch — qualified or not — permanently updating their uptime record on Hedera.

---

## Proof of Reception (PoRx) — Getting Paid for Signal

Proof of Reception answers the question: did this ground station actually receive satellite data, and can it prove it cryptographically?

When a satellite pass ends, the ground station Python software hands off received packet data to the Node.js Hedera client, which:

1. Computes `keccak256` of each received packet's bytes
2. Builds a Merkle tree of those hashes
3. Calls `submitPoRx(passId, packetCount, totalPackets, merkleRoot, avgRssi, avgSnr)` on OrbitalVault
4. Calls `claimPoRxReward(passId)` to flag the proof as ready for verification

A peer station — one that also received packets from the same pass — then calls `verifyPoRx(station, passId)`. The contract checks that the verifier also submitted a proof for this pass (they cannot self-verify), marks the proof as verified, and immediately executes the AZM payout.

You cannot fake a valid Merkle root. It requires the actual packet bytes. You cannot construct a valid root without physically receiving the RF signal. Every root is stored on Hedera permanently — the reception happened or it did not. The chain says so.

After payout, `_executePoRxPayout()` calls `CreditRegistry.recordSettlement()` — anchoring the Merkle root, packet count, completeness percentage, and AZM earned as a permanent credit event on Hedera.

---

## The Operator Journey

### Step 1 — Stake and Register

The operator acquires testnet HBAR from the Hedera portal (portal.hedera.com). They call `registerStation(location)` on OrbitalVault, sending exactly 5 HBAR from their own wallet as a stake.

The contract registers them, stores their stake, and calls `CreditRegistry.registerOperator()` — creating their credit profile on Hedera with a timestamp. Their score starts at 0 (Bronze tier).

If they behave dishonestly, 50% of their stake is burned to the dead address and their score is penalized 300 points — an on-chain, irreversible consequence.

### Step 2 — Go Online

The Node.js Hedera client (`hedera-client/index.js`) starts the heartbeat loop (`heartbeat.js`). Every 60 seconds it calls `heartbeat()` on OrbitalVault. The contract records the call and the station is alive on Hedera.

The Python ground station (`ground_station/azimuth_station.py`) opens the USB serial connection to the Heltec ESP32 LoRa receiver and begins listening for incoming packets.

### Step 3 — Receive a Satellite Pass

The satellite (simulated by a second ESP32 transmitter) broadcasts a JPEG image split into 104 numbered LoRa packets at 915 MHz. The receiver captures packets as they arrive and passes them to the Python station software, which reconstructs the image in real time on a UI display.

### Step 4 — Upload and Coordinate

When the pass ends, each station:

- Uploads its raw packet data to Arweave via Irys (`imageMerger.js`) — tagged with pass metadata
- Posts an HCS message: `{ type: "packets", passId, station, arweaveTxId, packetCount }`

The primary station polls the HCS topic via the Hedera Mirror Node, detects when 2+ stations have announced for the same pass, fetches both Arweave datasets, merges the packet sets (union by packet index), reconstructs the highest-quality possible image, uploads it to Arweave, and calls `recordImage(passId, arweaveTxId, recovered, total)` on OrbitalVault.

No direct contact between stations ever occurs. Hedera HCS is the coordination layer.

### Step 5 — Submit PoRx Proof

`proofSubmitter.js` computes the Merkle root of all received packet hashes and calls `submitPoRx()` then `claimPoRxReward()`. The peer station's client detects the event and calls `verifyPoRx()`. AZM is transferred by the contract immediately.

### Step 6 — Credit Score Updates

CreditRegistry records the settlement. The score is recomputed from three on-chain signals:

| Signal | Max Points | Formula |
|--------|-----------|---------|
| Reception quality | 500 | `totalPacketsReceived / totalPacketsPossible × 500` |
| Uptime consistency | 300 | `epochsQualified / epochsTotal × 300` |
| Volume bonus | 200 | `min(passes × 20, 200)` |
| Slash penalty | −300 per slash | Deducted for each slash event |

### Step 7 — Tier Upgrades and Higher Rewards

| Tier | Score | PoA Multiplier |
|------|-------|----------------|
| Bronze | 0–299 | 1.0x |
| Silver | 300–499 | 1.25x |
| Gold | 500–699 | 1.50x |
| Platinum | 700–1000 | 2.0x |

After ~15 passes, a consistently online station crosses 300 points into Silver. From the next epoch settlement, OrbitalVault automatically pays 1.25x base PoA rewards — no manual action required.

The flywheel: better reception → higher score → higher rewards → more hardware → more passes → higher score.

---

## How It Was Built

### Hardware Layer

Two Heltec WiFi LoRa 32 V4 boards (ESP32 + SX1262 LoRa chip). One runs firmware (`azimuth_transmitter/`) that encodes a JPEG into 104 numbered packets and broadcasts them continuously at 915 MHz. The other runs firmware (`azimuth_receiver/`) that listens, decodes packets, and streams them over USB serial to the host computer as JSON lines.

### Ground Station Software (Python)

`ground_station/azimuth_station.py` opens the USB serial port, parses incoming packet JSON, assembles the image buffer, and renders it live in a Pygame window showing received packet count, signal quality (RSSI/SNR), and image reconstruction progress. It writes a state file that the Node.js client reads to trigger proof submission.

### Hedera Client (Node.js)

`hedera-client/index.js` is the main orchestrator. It starts four parallel loops:

- `heartbeat.js` — sends `heartbeat()` every 60 seconds
- `proofSubmitter.js` — watches for completed passes, builds Merkle roots, submits PoRx, claims and auto-verifies
- `imageMerger.js` — polls HCS for packet announcements, downloads from Arweave, merges, uploads final image, records on-chain
- `stateTracker.js` — polls contract state every 10 seconds, checks if PoA epoch is settleable, triggers settlement, writes state to JSON for the dashboard

`config.js` connects to Hedera testnet (`https://testnet.hashio.io/api`, chain ID 296) using ethers.js and the Hedera SDK for native HCS and account operations.

### Smart Contracts (Solidity / Hardhat)

Three contracts deployed to Hedera testnet:

**AzimuthToken.sol** — standard ERC-20, 10,000,000 fixed supply, 0 decimals. Minted entirely to the deployer who funds OrbitalVault with the reward pool.

**CreditRegistry.sol** — the credit layer. Stores `CreditProfile` and `Settlement[]` per operator. Only OrbitalVault can write to it (`onlyVault` modifier). Computes credit score and multiplier as pure view functions from stored on-chain data. Emits `SettlementRecorded` with the Merkle root on every verified reception — permanent, queryable data integrity on Hedera.

**OrbitalVault.sol** — the reward engine. Manages HBAR staking, PoA epoch state, PoRx proof storage, image recording, and AZM payouts. Calls CreditRegistry after every payout. The keeper pattern (`settlePoAEpoch()` callable by anyone once the interval elapses) means epoch settlement is trustless and permissionless.

Deploy order: `AzimuthToken → CreditRegistry → OrbitalVault(token, registry) → registry.setVault(vault)`. All four steps are automated in `contracts/scripts/deploy.js`.

### Two Permanent Storage Systems

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **On-chain** | Hedera EVM + HCS | Coordination, proof, credit history, settlement records — small, structured, permanent |
| **Off-chain** | Arweave via Irys | Raw packet bytes, reconstructed images — large binary, permanent, content-addressed |

---

## Dashboards

### Ground Station Dashboard (Next.js)

`dashboard/` — real-time view of station health, PoA epoch progress, PoRx submissions, credit scores, and Hedera Scheduled Transaction queue. Queries the Hedera Mirror Node and OrbitalVault contract directly — no backend.

### Image Archive Dashboard (Next.js)

`image-dashboard/` — gallery of all merged satellite images recovered by the network. Each image card shows pass ID, packet completeness %, contributing stations, and links to the Arweave permanent record. Data sourced by scanning the HCS coordination topic for `merged-image` messages.

---

## File Structure

```
azimuth/
├── azimuth_transmitter/       # ESP32 satellite simulator firmware
├── azimuth_receiver/          # ESP32 LoRa-to-USB bridge firmware
├── ground_station/            # Python: Pygame dashboard + packet assembly
├── hedera-client/             # Node.js: heartbeat, PoRx, merger, state tracker
│   ├── index.js               # Main orchestrator
│   ├── heartbeat.js           # PoA heartbeat loop
│   ├── proofSubmitter.js      # Merkle root builder + PoRx submit/claim/verify
│   ├── imageMerger.js         # HCS poll → Arweave merge → on-chain record
│   ├── packetPublisher.js     # Arweave upload + HCS announcement
│   ├── stateTracker.js        # Epoch settlement + dashboard state file
│   └── config.js              # Hedera + ethers.js connection
├── contracts/                 # Solidity + Hardhat
│   ├── contracts/
│   │   ├── AzimuthToken.sol
│   │   ├── CreditRegistry.sol
│   │   └── OrbitalVault.sol
│   └── scripts/
│       ├── deploy.js
│       ├── createToken.js
│       ├── createTopic.js
│       ├── registerStations.js
│       ├── fundContract.js
│       ├── checkBalances.js
│       └── initPoAEpoch.js
├── dashboard/                 # Next.js ground station dashboard
├── image-dashboard/           # Next.js image archive dashboard
└── docs/                      # This folder
```

---

## Key Differentiators

| vs. Existing Solutions | Azimuth Advantage |
|------------------------|-------------------|
| AWS Ground Station ($22/min) | Permissionless, pay-per-verified-pass model at a fraction of the cost |
| Helium (coverage proof) | Azimuth proves *actual data reception*, not just RF coverage |
| Filecoin (storage) | Azimuth captures data at the physical layer, not just stores it |
| Single-station setups | No single point of failure — network fills gaps automatically via Arweave + HCS coordination |
| Traditional ground stations | 100x cheaper, permissionless, collaborative redundancy |
