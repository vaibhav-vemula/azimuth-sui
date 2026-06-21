# 🚀 Azimuth — Two-Node Deployment Runbook (Mac + Raspberry Pi)

End-to-end setup for running Azimuth across **2 nodes**. Steps are tagged **[MAC]**, **[PI]**, or
**[BOTH]**. Deeper reference: [`SETUP.md`](docs/SETUP.md) · [`agents/README.md`](agents/README.md).

> **Key fact:** the two stations **coordinate through Sui events + Walrus**, not a direct network
> link. The Pi and the Mac do **not** need to be on the same Wi-Fi or talk to each other — each just
> needs **internet** and **its own Sui keypair**. That's the DePIN design.

---

## 0. Roles (who runs what)

| | **Mac** (`station-a`, primary) | **Raspberry Pi** (`station-b`) |
|---|---|---|
| Owner/deployer (publish + init) | ✅ (once) | — |
| Sui station service (`sui-client`) | ✅ `IS_PRIMARY=true` (runs the merger) | ✅ `IS_PRIMARY=false` |
| Hardware capture (`azimuth_station.py`) | optional / simulated | ✅ real RTL-SDR / LoRa |
| Dashboards (`:3000`, `:3001`) | ✅ | — |
| Agents (Claude + MemWal) | ✅ | — |

Rationale: the Mac is the always-on, resourceful node (deploy, merge, dashboards, AI agents); the
Pi is the field sensor doing real capture. You'll create **3 Sui keypairs**: `owner`, `station-a`,
`station-b`.

---

## 1. [BOTH] Install prerequisites

**[BOTH] Node 20.19+ (or 22 LTS)** — Azimuth uses features that warn on 20.10.
```bash
node --version   # must be >= 20.19
# Pi/Linux: use nvm  →  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 22
# Mac: brew install node   (or nvm)
```

**[MAC] Sui CLI + git + jq**
```bash
brew install sui jq git
sui --version
```

**[PI] Python + radio deps** (for the receiver)
```bash
sudo apt update && sudo apt install -y python3 python3-pip
pip3 install pyserial pillow pygame
# plus your SDR stack (rtl-sdr / the LoRa USB bridge your station uses)
```

**[BOTH] Clone the repo**
```bash
git clone <your-repo-url> azimuth && cd azimuth
git checkout sui-walrus
```

---

## 2. [MAC] Create wallets + fund them

```bash
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet

# Create 3 addresses (note each printed address):
sui client new-address ed25519 owner
sui client new-address ed25519 station-a
sui client new-address ed25519 station-b

# Fund each with testnet SUI (run faucet while each is active, or use the web faucet):
sui client switch --address owner     && sui client faucet
sui client switch --address station-a && sui client faucet
sui client switch --address station-b && sui client faucet

# Get WAL (Walrus storage) for whoever uploads blobs (station-a, station-b):
#   walrus get-wal     (or the Walrus testnet faucet)

# Export the bech32 secret keys (suiprivkey1…) — you'll paste these into .env files:
sui keytool export --key-identity owner
sui keytool export --key-identity station-a
sui keytool export --key-identity station-b
```

> Keep the three `suiprivkey1…` strings handy. `station-b`'s key goes to the **Pi**.

---

## 3. [MAC] Publish the Move package (once)

```bash
cd move/scripts && ./publish.sh
```
Copy the printed IDs — you'll reuse them on **both** nodes:
```
PACKAGE_ID=0x…
REGISTRY_ID=0x…
ADMIN_CAP_ID=0x…
ACCESS_REGISTRY_ID=0x…
TREASURY_CAP_ID=0x…
```

---

## 4. [MAC] Initialize the network + register both stations

```bash
cd move/scripts
cp .env.example .env
# Edit .env:
#   SUI_PRIVATE_KEY = <owner key>
#   PACKAGE_ID / REGISTRY_ID / TREASURY_CAP_ID / ADMIN_CAP_ID = from step 3
#   STATIONS = <station-a address>,<station-b address>
npm install
node setup.mjs        # funds reward pool + starts PoA epochs + mints stake to both stations

# Register station-a (its key) then station-b (its key):
# edit .env → SUI_PRIVATE_KEY=<station-a key>, LOCATION="New York, USA"
node register.mjs
# edit .env → SUI_PRIVATE_KEY=<station-b key>, LOCATION="London, UK"
node register.mjs
```

(Optional identity: buy `name.sui` names at https://suins.io and point them at the station
addresses — the dashboards resolve them automatically.)

---

## 5. [MAC] Run Station A (primary) + sui-client

```bash
cd sui-client
cp .env.example .env
# Edit .env:
#   SUI_PRIVATE_KEY   = <station-a key>
#   PACKAGE_ID / REGISTRY_ID / ACCESS_REGISTRY_ID = from step 3
#   IS_PRIMARY        = true        ← the merger runs here
npm install --legacy-peer-deps
node index.js
```
Leave it running. It heartbeats, submits/verifies proofs, cranks epochs, and **merges** images.

**Feeding Station A captures (pick one):**
- Real hardware on the Mac (if you have an SDR), OR
- **Simulate** a reception (no hardware): drop a `ground_station/reception_event.json` — see step 7.

---

## 6. [PI] Run Station B + the real receiver

On the Raspberry Pi (`station-b`):
```bash
cd azimuth/sui-client
cp .env.example .env
# Edit .env:
#   SUI_PRIVATE_KEY   = <station-b key>     ← the Pi holds ONLY station-b's key
#   PACKAGE_ID / REGISTRY_ID / ACCESS_REGISTRY_ID = same IDs from step 3
#   IS_PRIMARY        = false
npm install --legacy-peer-deps
node index.js
```

In a second terminal on the Pi, the hardware receiver:
```bash
cd azimuth/ground_station
python3 azimuth_station.py                 # with display
# or headless on a specific serial port:
python3 azimuth_station.py --no-ui /dev/ttyACM0
```
The receiver writes `reception_event.json` (the Pi's `sui-client` picks it up → uploads packets to
Walrus → `submit_porx`) and reads `sui_state.json` for its status panel.

---

## 7. Getting a merged image (needs ≥2 stations on the same pass)

A merge happens when **two** stations submit for the **same `passId`**. Options:

- **Real:** both stations capture the same satellite pass (the `passId` is derived from pass time).
- **Demo without 2 antennas:** write the **same** `reception_event.json` on **both** nodes (same
  `passId`, each with its own packet subset). Example file:
  ```json
  {
    "passId": "0x<64 hex>",
    "packetCount": 8, "totalPackets": 10,
    "packetHashes": ["0x…"], "packetBytes": { "0": "<base64>", "1": "<base64>" },
    "avgRssi": -700, "avgSnr": 90, "timestamp": "2026-01-01T000000"
  }
  ```
  Station A (primary) sees both `PoRxSubmitted` events → merges → `record_image` → emits
  `ImageMerged`. The image lands on Walrus with an on-chain certificate.

---

## 8. [MAC] Dashboards

```bash
# Station ops (:3000)
cd dashboard
# .env.local → NEXT_PUBLIC_PACKAGE_ID, NEXT_PUBLIC_REGISTRY_ID
npm install && npm run dev

# Image gallery + Agent Intelligence panel (:3001)
cd ../image-dashboard
# .env.local → NEXT_PUBLIC_PACKAGE_ID
npm install && npm run dev
```
Open http://localhost:3000 (enter a station address or `name.sui`) and http://localhost:3001.

---

## 9. [MAC] Agents (Claude + MemWal)

```bash
cd agents
cp .env.example .env
# Edit .env:
#   ANTHROPIC_API_KEY = sk-ant-…                         (real Claude agents)
#   MEMWAL_KEY / MEMWAL_ACCOUNT_ID / MEMWAL_SERVER_URL   (from https://memory.walrus.xyz/)
#   PACKAGE_ID / REGISTRY_ID                             (so the Analyst reads real ImageMerged)
#   STATION_IDS = station-a,station-b
npm install --legacy-peer-deps
npm install @mysten/seal --legacy-peer-deps             # MemWal runtime dep

npm run demo      # scripted: memory compounds → coordination → analysis
npm run watch     # LIVE: plan once, then auto-analyze each new merged image
npm run verify    # independent verifiability proof of a memory blob on Walrus
```
With no keys it still runs (heuristics + local memory). With keys it's fully real.

---

## 10. Health checks (per node)

| Check | Expect |
|---|---|
| **[MAC/PI]** `node sui-client/index.js` startup | "Registered: <location> \| active: true" |
| **[MAC]** station-a logs | `[MERGE] Primary station — merger started` |
| **[PI]** after a reception | `[PORX] Proof submitted` + a Walrus blob id |
| **[MAC]** agents | `memory backend: memwal` and `planner: LLM` |
| **[MAC]** `npm run verify` | byte-identical blob across two public aggregators |
| **[MAC]** gallery `:3001` | merged image + "verifiable memory on Walrus" report link |

---

## 11. Troubleshooting (the gotchas we actually hit)

- **`npm install` ERESOLVE** → always use `--legacy-peer-deps` in `agents/` and `sui-client/`
  (MemWal's Seal peer wants `@mysten/sui` v2).
- **MemWal "Invalid URL"** → your `MEMWAL_SERVER_URL` value must be just `https://relayer.memory.walrus.xyz`
  (no duplicated `MEMWAL_SERVER_URL=` prefix, no `/version` suffix).
- **MemWal "Cannot find package '@mysten/seal'"** → `npm install @mysten/seal --legacy-peer-deps` in `agents/`.
- **`temperature is deprecated for this model`** → keep `AZIMUTH_MODEL_REASON=claude-sonnet-4-6`
  (Opus 4.8 needs a newer AI SDK than the pinned v4).
- **Agents say "chain not configured"** → `PACKAGE_ID`/`REGISTRY_ID` in `agents/.env` are still
  `0x…` placeholders; paste the real IDs from step 3.
- **`EBADENGINE` warnings** → upgrade to Node 20.19+ / 22.
- **PoRx never pays** → a *second* active station must `verify_porx`; make sure both nodes' `sui-client` are running.
- **No merged image** → you need ≥2 stations on the same `passId` (step 7).
- **Walrus upload fails** → the uploading station needs **WAL** (step 2).
- **Pi serial port** → pass the right device, e.g. `python3 azimuth_station.py --no-ui /dev/ttyACM0`
  (`ls /dev/ttyACM* /dev/ttyUSB*`).

---

## 12. One-glance startup order

1. **[MAC]** steps 2–4 (once): wallets → publish → init → register both stations.
2. **[MAC]** `sui-client` (station-a, `IS_PRIMARY=true`).
3. **[PI]** `sui-client` (station-b) + `azimuth_station.py`.
4. Trigger captures (real, or simulated `reception_event.json` on both) → merge happens on the Mac.
5. **[MAC]** dashboards + agents (`npm run watch`).
6. **[MAC]** `npm run verify` for the verifiability proof.
