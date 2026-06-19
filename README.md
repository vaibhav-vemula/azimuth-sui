<div align="center">

# 🛰️ Azimuth

### Decentralized Satellite Ground Station Network — on Sui + Walrus

**Real hardware ground stations capture real satellite downlinks, store every byte on Walrus, and prove reception + availability on Sui.**

![Sui](https://img.shields.io/badge/Sui-Move-4da2ff?style=flat-square)
![Walrus](https://img.shields.io/badge/Walrus-Blobs%20%2B%20Certificates-22c55e?style=flat-square)
![Seal](https://img.shields.io/badge/Seal-Encrypted%20Premium%20Data-8b5cf6?style=flat-square)
![DePIN](https://img.shields.io/badge/DePIN-Satellite_RF-f59e0b?style=flat-square)

</div>

---

Satellites pass overhead transmitting images and sensor data every day — and most of it is lost, because the **economics** of receiving it are broken. Azimuth turns low-cost, independently-run ground stations into a coordinated network that captures **real satellite downlinks**, merges partial captures from multiple stations into one complete image, stores all data on **Walrus**, and **proves every reception and its data availability on Sui** — paying operators who build a verifiable on-chain credit history from uptime and reception quality.

> **Built for the [Sui Overflow](https://overflow.sui.io/) Walrus track.** The Walrus track is about large, off-chain, **verifiable** data. Azimuth produces real-world data that *must* be stored, proven available, and trustlessly verified — and it uses Walrus's programmable features as the spine of the system, not as a storage afterthought.

---

## Why this is a Walrus project, not a "we uploaded a file" project

Azimuth uses **six** distinct Sui/Walrus data capabilities, each tied to a real product need:

| # | Capability | Where | What it does |
|---|---|---|---|
| 1 | **On-chain Blob objects + availability certificates** | `sui-client/walrus.js`, `orbital_vault.move` | Captures upload via the Walrus SDK (registers a `Blob` object on Sui). The reconstructed image is anchored in an `ImageCapture` object with its blob id + certified epoch — proof-of-reception backed by proof-of-availability. |
| 2 | **Programmable storage lifecycle** | `record_image`, `walrus.js` | High-completeness captures are marked `high_value`; storage can be renewed/extended from policy. |
| 3 | **Quilt batching** | `sui-client/quilt.js` | Dozens of tiny RF packets per pass are batched into one Walrus Quilt instead of many wasteful blobs. |
| 4 | **Seal encryption + on-chain access control** | `access_policy.move`, `sui-client/seal.js` | Full-res / raw captures are Seal-encrypted; `seal_approve` releases decryption only to the capturing station or a buyer who paid via `buy_access` — a decentralized satellite-data marketplace. |
| 5 | **Walrus Sites** | `walrus-sites/` | The dashboards are deployable as Walrus Sites — antenna → UI, fully decentralized. |
| 6 | **Verifiable provenance** | `submit_porx`, events | Anyone can re-fetch a blob from Walrus and re-check the packet Merkle root against the on-chain proof. |

---

## Architecture

```
  ESP32 / RTL-SDR satellite downlink
            │  JPEG packets (RF)
            ▼
  ground_station/azimuth_station.py        ← hardware capture (Pygame UI)
            │  reception_event.json  ▲ sui_state.json
            ▼                        │
  sui-client/  (Node service)        │
   ├─ packets → Walrus (+ Quilt)     │   on-chain Blob objects + certificates
   ├─ submit_porx  → Sui PTB         │   (PoRxSubmitted event carries blob id)
   ├─ heartbeat    → Sui PTB         │   PoA availability
   ├─ verify peers → Sui PTB         │   cross-station verification → reward paid
   ├─ settle_poa_epoch crank         │   (replaces Hedera Schedule Service)
   └─ merge ≥2 stations → Walrus → record_image (ImageCapture anchors blob)
            │
            ▼
  Move package  azimuth::orbital_vault + azm + access_policy   (Sui testnet)
            │
            ▼
  dashboard/ (station ops)   image-dashboard/ (gallery)   → optionally Walrus Sites
```

### What replaced Hedera

| Hedera (old) | Sui / Walrus (now) |
|---|---|
| Solidity `OrbitalVault.sol` | Move package `azimuth::orbital_vault` |
| HTS token (AZM) | `Coin<AZM>` via `coin::create_currency` (`azm.move`) |
| HCS coordination topic | Sui Move **events** (`PoRxSubmitted`, `ImageMerged`, …) |
| Hedera Schedule Service | **Permissionless `settle_poa_epoch` crank** + unstake **cooldown** |
| Walrus via raw HTTP | Walrus **SDK** → on-chain `Blob` objects + certificates, Quilt, Seal |
| Arweave / Irys | **removed** (single storage layer: Walrus) |
| ENS identity | **SuiNS** (built-in `SuiClient` name resolution) |

---

## Repository layout

```
move/azimuth/          Sui Move package (sources/ + tests/)
move/scripts/          deploy + init scripts (publish.sh, setup.mjs, register.mjs)
sui-client/            Node service that runs on each ground station
dashboard/             Next.js station-ops dashboard (Sui reads + dApp Kit wallet)
image-dashboard/       Next.js merged-image gallery (Walrus + on-chain certificates)
ground_station/        Python LoRa/RTL-SDR receiver + Pygame UI (hardware capture)
walrus-sites/          Walrus Sites hosting configs
SUI_WALRUS_PLAN.md     Strategy / winning plan
SETUP.md               Step-by-step deploy + run guide
```

---

## The on-chain model (`azimuth::orbital_vault`)

- **`StationRegistry`** (shared): AZM reward pool, station table, epoch params.
- **`Station`**: stake (`Balance<AZM>`), heartbeats, reward totals, unstake cooldown.
- **`PoRxProof`** (shared object): per-pass packet proof referencing a Walrus blob id; a *second* station calls `verify_porx`, which pays the reward.
- **`ImageCapture`** (shared object): the merged image anchored to its Walrus blob id + certified epoch.
- **Events** replace HCS coordination; the merger and dashboards read them via RPC.
- **PoA epochs** settle through a permissionless `settle_poa_epoch` crank gated by the on-chain `Clock` — the `sui-client` runs it on a timer.

See `move/azimuth/sources/` and `move/azimuth/tests/orbital_vault_tests.move`.

---

## Quick start

Full instructions in **[SETUP.md](SETUP.md)**. In short:

```bash
# 1. Publish the Move package (Sui CLI + funded testnet wallet required)
cd move/scripts && ./publish.sh        # prints PACKAGE_ID, REGISTRY_ID, caps…

# 2. Init: fund the reward pool, start epochs, distribute stake
cp .env.example .env && $EDITOR .env   # paste the IDs
npm i && node setup.mjs

# 3. Each station registers itself (with its own key)
node register.mjs

# 4. Run the station service alongside the hardware capture
cd ../../sui-client && cp .env.example .env && $EDITOR .env && npm i && node index.js
cd ../ground_station && python3 azimuth_station.py

# 5. Dashboards (set NEXT_PUBLIC_PACKAGE_ID / REGISTRY_ID in .env.local first)
cd ../dashboard && npm i && npm run dev            # :3000
cd ../image-dashboard && npm i && npm run dev      # :3001
```

---

## Demo flow (what judges see)

1. A reception fires → packets uploaded to Walrus (+ Quilt); a `Blob` object exists on Sui.
2. `submit_porx` lands; `PoRxSubmitted` event carries the blob id.
3. A second station's `verify_porx` → AZM reward paid (`Coin<AZM>` balance increases).
4. The primary station merges ≥2 stations, uploads the image to Walrus, and `record_image` creates an `ImageCapture` anchoring the blob + certificate.
5. The gallery renders the image from Walrus and links to its **on-chain availability certificate**.
6. Premium raw data is Seal-encrypted; only a station/buyer who passes `seal_approve` can decrypt.

---

## Notes & honest tradeoffs

- **No on-chain scheduler on Sui** → PoA settlement and unstake are permissionless cranks + cooldowns.
- **SDK versions** for `@mysten/walrus` / `@mysten/seal` evolve; Quilt/Seal calls are isolated in `quilt.js` / `seal.js` / `walrus.js` for easy version pinning.
- The Python hardware capture is unchanged except the shared state file name (`sui_state.json`) and a UI label.

---

*One product, two networks doing real work: **Sui** settles and proves it · **Walrus** stores and certifies it.*
