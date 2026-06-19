# Azimuth DePIN — Setup & Run Guide

Complete step-by-step guide to deploy and run the Azimuth DePIN system on Hedera Testnet.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Python 3 | 3.9+ |
| Pygame | installed (`pip install pygame`) |
| PySerial | installed (`pip install pyserial`) |
| Pillow | installed (`pip install Pillow`) |

Hardware:
- 3x Heltec WiFi LoRa 32 V4
  - **Heltec #1** — Transmitter (satellite simulator)
  - **Heltec #2** — Receiver → USB → Raspberry Pi 5 (**Station A**)
  - **Heltec #3** — Receiver → USB → Mac (**Station B**)
- 1x Raspberry Pi 5
- 1x Mac (or second Pi)
- 2x USB cables

```
                    LoRa 915 MHz
  [Heltec #1 TX] ─────────────────┬──────────────────┐
   (press PRG)                     │                  │
                            [Heltec #2 RX]     [Heltec #3 RX]
                                │ USB                │ USB
                          [Raspberry Pi 5]         [Mac]
                           Station A              Station B
                           hedera-client          hedera-client
                           dashboard              dashboard
```

Both stations independently receive the same LoRa transmission.
This enables **PoRx cross-verification** — each station can verify
the other's reception proof because they both captured the same data.

---

## Step 1: Create TWO Hedera Testnet Accounts

You need **two separate accounts** — one per station — so they can cross-verify each other's PoRx proofs.

1. Go to [https://portal.hedera.com](https://portal.hedera.com)
2. Create **Account A** (for Raspberry Pi station):
   - Note: Account ID, ECDSA Private Key, EVM Address
3. Create **Account B** (for Mac station):
   - Note: Account ID, ECDSA Private Key, EVM Address
4. Both accounts get free testnet HBAR automatically

---

## Step 2: Configure Environment

```bash
cd contracts
cp .env.example .env
```

Edit `.env` with both accounts:
```
# Station A — Raspberry Pi
OPERATOR_ID=0.0.AAAAA
OPERATOR_PRIVATE_KEY=0xSTATION_A_KEY
OPERATOR_EVM_ADDRESS=0xSTATION_A_EVM

# Station B — Mac
STATION_B_ID=0.0.BBBBB
STATION_B_PRIVATE_KEY=0xSTATION_B_KEY
STATION_B_EVM_ADDRESS=0xSTATION_B_EVM
```

---

## Step 3: Install Dependencies

```bash
# Smart contract dependencies
cd contracts
npm install

# Hedera client dependencies
cd ../hedera-client
npm install
```

---

## Step 4: Compile Contracts

```bash
cd contracts
npx hardhat compile
```

You should see: `Compiled 3 Solidity files successfully`

---

## Step 5: Create AZM Token

```bash
cd contracts
node scripts/createToken.js
```

Output will show:
```
AZM Token Created!
  Token ID:     0.0.XXXXX
  EVM Address:  0x...
```

**Add to your `.env`:**
```
AZM_TOKEN_ID=0.0.XXXXX
AZM_TOKEN_EVM=0x...
```

---

## Step 6: Deploy OrbitalVault

```bash
npx hardhat run scripts/deploy.js --network hedera_testnet
```

Output:
```
OrbitalVault Deployed!
  Address: 0x...
```

**Add to your `.env`:**
```
ORBITAL_VAULT_ADDRESS=0x...
```

---

## Step 7: Fund the Contract

Transfer AZM tokens (reward pool) and HBAR (for HSS gas) to the contract:

```bash
node scripts/fundContract.js
```

This transfers:
- 1,000,000 AZM to the reward pool
- 50 HBAR for HSS execution gas

---

## Step 8: Register Both Stations

```bash
node scripts/registerStations.js
```

This registers both Station A (Pi) and Station B (Mac) with the contract.
Both need to be registered so they can submit PoRx proofs and cross-verify each other.

---

## Step 9: Start the PoA Epoch Loop

```bash
# For demo (10-minute epochs instead of 6 hours):
node scripts/initPoAEpoch.js --demo

# For production (6-hour epochs):
node scripts/initPoAEpoch.js
```

**This only runs once.** After initialization, the contract schedules itself automatically via HSS.

---

## Step 10: Configure hedera-client on BOTH Machines

You need a copy of `hedera-client/` on both the Pi and the Mac.

### On Raspberry Pi (Station A):
```bash
cd hedera-client
cp .env.example .env
```
Edit `.env`:
```
OPERATOR_PRIVATE_KEY=0xSTATION_A_KEY
ORBITAL_VAULT_ADDRESS=0xVAULT_ADDRESS
AZM_TOKEN_EVM=0xTOKEN_ADDRESS
HEARTBEAT_INTERVAL_MS=120000
SCHEDULE_POLL_INTERVAL_MS=15000
STATE_FILE=../hedera_state.json
```

### On Mac (Station B):
Copy the `azimuth/` project to your Mac (or clone repo), then:
```bash
cd hedera-client
npm install
cp .env.example .env
```
Edit `.env` — **use Station B's key**:
```
OPERATOR_PRIVATE_KEY=0xSTATION_B_KEY
ORBITAL_VAULT_ADDRESS=0xVAULT_ADDRESS
AZM_TOKEN_EVM=0xTOKEN_ADDRESS
HEARTBEAT_INTERVAL_MS=120000
SCHEDULE_POLL_INTERVAL_MS=15000
STATE_FILE=../hedera_state.json
```

---

## Step 11: Flash the Heltec Boards

1. **Heltec #1 (Transmitter)**: Flash `azimuth_transmitter/azimuth_transmitter.ino`
2. **Heltec #2 (Receiver → Pi)**: Flash `azimuth_receiver/azimuth_receiver.ino`
3. **Heltec #3 (Receiver → Mac)**: Flash `azimuth_receiver/azimuth_receiver.ino` (same sketch)

Connect Heltec #2 to the Pi via USB, Heltec #3 to the Mac via USB.

---

## Step 12: Run the System

### On Raspberry Pi — 2 terminals:

**Terminal 1: Hedera Client**
```bash
cd hedera-client
node index.js
```

**Terminal 2: Dashboard**
```bash
python3 azimuth_station.py
```

### On Mac — 2 terminals:

**Terminal 3: Hedera Client**
```bash
cd hedera-client
node index.js
```

**Terminal 4: Dashboard**
```bash
python3 azimuth_station.py
```

### Transmit — press PRG on Heltec #1

Both stations will:
1. Receive the LoRa packets independently
2. Display the image assembling in real time
3. Send heartbeats to the contract (PoA)
4. Submit PoRx proofs when the image is complete
5. Automatically cross-verify each other's proofs
6. HSS executes the PoRx reward payouts

```
                         [Heltec #1 TX]
                          Press PRG ↓
                     ─── LoRa 915 MHz ───
                    ↙                      ↘
           [Heltec #2 RX]            [Heltec #3 RX]
               │ USB                      │ USB
         [Raspberry Pi]                 [Mac]
          hedera-client               hedera-client
           dashboard                   dashboard
               │                          │
               └──── Hedera Testnet ──────┘
                  heartbeats (PoA)
                  proofs (PoRx)
                  cross-verify ↔
                  auto-payout via HSS
```

---

## How It Works (End to End)

```
 1. Transmitter (Heltec #1) sends JPEG packets over LoRa
 2. Both receivers (Heltec #2 + #3) capture packets independently
 3. Each forwards packets via USB to its host (Pi / Mac)
 4. azimuth_station.py on each machine displays the image progressively
 5. hedera-client on each machine sends heartbeats every 2 min (PoA)
 6. When image is complete, each station writes reception_event.json
 7. hedera-client detects the event, submits PoRx proof to contract
 8. hedera-client claims its PoRx reward (creates HSS schedule)
 9. The OTHER station's hedera-client detects the unverified proof
10. It auto-verifies (signs the HSS schedule) — cross-verification!
11. HSS auto-executes the PoRx reward payout to both stations
12. Every 10 min (demo) or 6h (prod), HSS auto-settles PoA epoch
13. Stations with heartbeats get PoA rewards automatically
```

---

## Verifying On-Chain

### Check contract state via Hardhat console
```bash
cd contracts
npx hardhat console --network hedera_testnet
```

```javascript
const vault = await ethers.getContractAt("OrbitalVault", process.env.ORBITAL_VAULT_ADDRESS);
await vault.poaEpochCount()       // current epoch
await vault.getStationCount()     // registered stations
await vault.getStationInfo("0x...") // station details
```

### Check via Mirror Node
```bash
# Contract info
curl https://testnet.mirrornode.hedera.com/api/v1/contracts/VAULT_ADDRESS

# Recent transactions
curl https://testnet.mirrornode.hedera.com/api/v1/contracts/VAULT_ADDRESS/results?limit=10

# Token balance
curl https://testnet.mirrornode.hedera.com/api/v1/tokens/TOKEN_ID/balances
```

### Check via HashScan
Visit: `https://hashscan.io/testnet/contract/VAULT_ADDRESS`

---

## Demo Checklist

- [ ] Contract deployed on Hedera Testnet
- [ ] AZM token created and funded
- [ ] Station registered
- [ ] PoA epoch loop running (self-scheduling via HSS)
- [ ] Heartbeats being sent (visible on dashboard)
- [ ] PoA epoch settlement executing automatically
- [ ] Image transmitted and received via LoRa
- [ ] PoRx proof submitted after reception
- [ ] PoRx reward claimed and verified
- [ ] Schedule lifecycle visible on dashboard
- [ ] All TX hashes verifiable on HashScan

---

## File Structure

```
azimuth/
├── contracts/
│   ├── hardhat.config.js
│   ├── package.json
│   ├── .env                          ← your credentials
│   ├── contracts/
│   │   ├── OrbitalVault.sol          ← main contract
│   │   └── interfaces/
│   │       ├── IHederaScheduleService.sol
│   │       └── IHRC904.sol
│   └── scripts/
│       ├── createToken.js            ← Step 5
│       ├── deploy.js                 ← Step 6
│       ├── fundContract.js           ← Step 7
│       ├── registerStations.js       ← Step 8
│       └── initPoAEpoch.js           ← Step 9
├── hedera-client/
│   ├── package.json
│   ├── .env                          ← your credentials
│   ├── index.js                      ← main entry (Step 11)
│   ├── config.js
│   ├── abi.js
│   ├── heartbeat.js                  ← PoA heartbeats
│   ├── proofSubmitter.js             ← PoRx proofs
│   ├── scheduleTracker.js            ← Mirror Node polling
│   └── stateWriter.js                ← writes hedera_state.json
├── azimuth_station.py                ← Pygame dashboard (Step 11)
├── azimuth_transmitter/              ← ESP32 transmitter sketch
├── azimuth_receiver/                 ← ESP32 receiver sketch
├── hedera_state.json                 ← runtime (auto-generated)
├── reception_event.json              ← runtime (auto-generated)
├── convert_image.py                  ← JPEG to C header
├── AZIMUTH_DEPIN.md                  ← DePIN architecture doc
├── AZIMUTH_HSS_USECASE.md            ← HSS use case doc
└── SETUP_HEDERA.md                   ← this file
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `STAKE_TRANSFER_FAILED` | Contract needs token association — run `fundContract.js` first |
| `NOT_REGISTERED` | Run `registerStations.js` before starting hedera-client |
| `ALREADY_INITIALIZED` | PoA epoch loop already started — this is expected |
| `SCHEDULE_POA_FAILED` | Contract needs HBAR for gas — send more HBAR to contract |
| No heartbeats showing | Check hedera-client is running and `.env` is correct |
| Dashboard shows "OFFLINE" | Start `node hedera-client/index.js` first |
| Mirror Node errors | Mirror Node has ~5s delay — data will appear shortly |
| Serial port not found | Specify manually: `python3 azimuth_station.py /dev/ttyACM0` |
