# 🛰️ Azimuth — How Everything Works

A complete, end-to-end explanation of the system: what each part is, how data flows through it,
and how the pieces connect. Grounded in the actual files in this repo.

> **Companion docs:** [`README.md`](../README.md) (overview) · [`SUI_STACK.md`](SUI_STACK.md)
> (per-technology guide) · [`SETUP.md`](SETUP.md) (deploy/run) ·
> [`PATH_B_AGENTIC_PLAN.md`](PATH_B_AGENTIC_PLAN.md) (the agent design).

---

## 0. The system in one picture

Azimuth has **two layers** that share one Sui + Walrus foundation:

```
┌──────────────────────────────── AGENT LAYER (agents/) ───────────────────────────────┐
│  Operator Agent · Coordinator Agent · Analyst Agent                                    │
│  memory on Walrus via MemWal (verifiable, shared) · Claude via Vercel AI SDK           │
└──────────▲───────────────────────────────────────────────────────────▲───────────────┘
           │ reads events / acts via tools                              │ reads images, writes reports
┌──────────┴───────────────────────── DATA + SETTLEMENT LAYER ──────────┴───────────────┐
│  ground_station/ (real RF capture)  →  sui-client/ (Node service)                      │
│  move/azimuth (Move package: staking, PoA/PoRx, rewards, image records)               │
│  Walrus (blobs + certificates)  ·  Seal (privacy)  ·  Sui (objects, events, coins)    │
│  dashboard/ (station ops)  ·  image-dashboard/ (gallery)                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Data + settlement layer** = the original Azimuth, migrated from Hedera to Sui + Walrus.
  It captures real satellite data, stores it on Walrus, and proves/settles everything on Sui.
- **Agent layer** = the AI agents that sit on top, using **Walrus/MemWal as verifiable memory**
  to plan, coordinate, and analyze. This is what targets the Sui Overflow **Walrus track**.

---

## 1. Component map

| Directory | What it is | Language |
|---|---|---|
| `ground_station/` | Real LoRa/RTL-SDR receiver + Pygame status UI (the hardware) | Python |
| `sui-client/` | Node service per station: heartbeats, proofs, Walrus uploads, image merge | Node (ESM) |
| `move/azimuth/` | Sui Move package: the reward engine + AZM coin + Seal access policy | Move |
| `move/scripts/` | Deploy/init scripts (publish, fund, register) | Node (ESM) |
| `dashboard/` | Station-ops dashboard (reads Sui, dApp Kit wallet, SuiNS) | Next.js |
| `image-dashboard/` | Merged-image gallery (reads Walrus + on-chain certificates) | Next.js |
| `agents/` | The multi-agent system with Walrus/MemWal memory | Node (ESM) |
| `walrus-sites/` | Configs to host the dashboards on Walrus Sites | config |

---

## 2. Data flow #1 — a satellite pass (the core pipeline)

This is what happens, in order, when a satellite flies overhead.

**1) Capture (hardware).** `ground_station/azimuth_station.py` receives JPEG packets over LoRa from
the antenna. When a reception completes it writes **`reception_event.json`** with the packet bytes,
`passId` (sha256 of the pass time), packet hashes, RSSI/SNR, and totals.

**2) Store + prove (sui-client).** `sui-client/proofSubmitter.js` watches for that file. On a new
event it:
   - uploads the station's packet payload to **Walrus** (`walrus.js`, via the Walrus SDK → a Sui
     `Blob` object + availability certificate),
   - also batches the packets into a **Quilt** and stores a **Seal-encrypted** premium copy
     (`quilt.js`, `seal.js`) — non-fatal extras,
   - computes a Merkle root over the packet hashes and calls **`submit_porx`** on the Move package,
     which creates a shared **`PoRxProof`** object and emits a **`PoRxSubmitted`** event carrying the
     Walrus blob id.

**3) Heartbeats (PoA).** In parallel, `sui-client/heartbeat.js` calls **`heartbeat`** on a timer so
the station proves availability. `eventTracker.js` runs the permissionless **`settle_poa_epoch`**
crank when an epoch is due, paying AZM to stations that met the heartbeat threshold.

**4) Cross-verification → payout.** Another station's `proofSubmitter.js` sees the `PoRxSubmitted`
event and calls **`verify_porx`** on the proof. Because a *second* party attests the reception, the
Move code pays the AZM PoRx reward from the registry's pool to the capturing station.

**5) Merge (primary station).** `sui-client/imageMerger.js` (only where `IS_PRIMARY=true`) polls
`PoRxSubmitted` events. When ≥2 stations have data for the same `passId`, it downloads each blob
from Walrus, unions the packets, reconstructs the JPEG, uploads the merged image to Walrus, and
calls **`record_image`** — creating a shared **`ImageCapture`** object that anchors the blob id +
certified epoch, and emitting **`ImageMerged`**.

**6) Display.** `dashboard/` reads the registry/station objects and events to show PoA epochs, PoRx
passes, AZM rewards, and credit score. `image-dashboard/` reads `ImageMerged` events, fetches each
image from Walrus, and links to its **on-chain availability certificate**.

**7) Status loop back to hardware.** `sui-client/stateWriter.js` writes **`sui_state.json`**, which
`azimuth_station.py` reads to render its on-screen status panel.

```
antenna → reception_event.json → sui-client → Walrus(blob+cert) + Sui(PoRxProof, events)
        → verify_porx → AZM paid → merge → Walrus(image) + Sui(ImageCapture/ImageMerged)
        → dashboards + sui_state.json → hardware UI
```

---

## 3. Data flow #2 — the agent layer

The agents consume the pipeline above and add planning/coordination/analysis, with memory on
Walrus/MemWal. Run with `cd agents && node index.js demo` (or `operator|coordinator|analyst|all`).

**Operator Agent** (`agents/operator/`, one per station) — *long-term memory.*
   - `recall`s past pass outcomes for each satellite from memory,
   - decides which upcoming passes to attempt (Claude via Vercel AI SDK, or a heuristic if no key),
   - optionally takes a real on-chain action (`heartbeat`),
   - `remember`s the outcome → next run's decisions are better-informed. Memory **compounds** across
     sessions (the demo shows run-2 decisions citing run-1 history).

**Coordinator Agent** (`agents/coordinator/`) — *multi-agent coordination.*
   - reads each station's **shared** skill profile from the common memory namespace,
   - negotiates a coverage plan (assigns AOS/LOS roles to maximize combined recovery),
   - publishes the plan back to shared memory for Operators to consume.

**Analyst Agent** (`agents/analyst/`) — *artifact-driven workflows.*
   - triggers on `ImageMerged` events, downloads the merged image from Walrus,
   - runs vision analysis (Claude multimodal, or a brightness heuristic),
   - writes a structured **report artifact to Walrus** and indexes it in memory,
   - `recall`s prior reports for temporal comparison ("cloud cover vs. last week").

```
Sui events / Walrus images ─▶ Agents ─▶ decisions + reports
                                  │
                                  ▼
                    MemWal (Walrus Memory): shared, verifiable,
                    portable memory  ◀── compounds every run
```

---

## 4. The Move package (`move/azimuth/sources/`)

The on-chain reward engine, ported from the old Hedera Solidity contract.

- **`orbital_vault.move`** — the core:
  - `StationRegistry` (shared object): AZM reward pool, station table, epoch params.
  - `Station`: stake (`Balance<AZM>`), heartbeat count, reward totals, unstake cooldown.
  - `PoRxProof` (shared): a per-pass proof referencing a Walrus blob id; verified by a second station.
  - `ImageCapture` (shared): a merged image anchored to its Walrus blob id + certified epoch.
  - Entry functions: `register_station`, `heartbeat`, `settle_poa_epoch` (permissionless crank),
    `submit_porx`, `verify_porx`, `record_image`, `request_unstake`/`complete_unstake`, `slash`.
  - Events: `PoRxSubmitted`, `ImageMerged`, `PoAEpochSettled`, `PoAReward`, `HeartbeatEmitted`,
    `PoRxVerified` — these replace Hedera's HCS coordination topic.
- **`azm.move`** — the `Coin<AZM>` reward token (`coin::create_currency`), replacing Hedera HTS.
- **`access_policy.move`** — Seal access control: `buy_access` (pay in SUI) + `seal_approve` (gates
  who can decrypt premium captures).
- **`tests/orbital_vault_tests.move`** — full reward-loop + epoch-timing tests (`sui move test`).

**Why Sui objects, not mappings:** proofs and images are first-class shared objects — discoverable,
composable, and (for `PoRxProof`) mutable by a second station so verification works.

**Why a crank:** Sui has no native scheduler (Hedera had Schedule Service), so `settle_poa_epoch`
is permissionless — anyone can call it once the `Clock` shows the interval elapsed; the `sui-client`
runs it on a timer.

---

## 5. The station service (`sui-client/`)

Each module and its job:

| File | Job |
|---|---|
| `config.js` | Sui client + keypair + Walrus client; reads env (PACKAGE_ID, REGISTRY_ID, …) |
| `sui.js` | Builds/signs/executes PTBs for each entry fn; reads objects + events |
| `walrus.js` | Walrus SDK upload (→ Blob object + certificate), download, renew |
| `quilt.js` | Batches a pass's small packets into one Walrus Quilt |
| `seal.js` | Seal-encrypts the premium (full-res/raw) copy before upload |
| `heartbeat.js` | PoA heartbeat loop |
| `proofSubmitter.js` | Watches `reception_event.json` → upload + `submit_porx`; verifies peers |
| `eventTracker.js` | Reads on-chain state for the dashboard JSON; runs the epoch crank |
| `imageMerger.js` | Primary station: merge ≥2 stations → upload image → `record_image` |
| `stateWriter.js` | Atomically writes `sui_state.json` for the Pygame UI |
| `index.js` | Orchestrates all of the above |
| `lock.js` | Serializes signing from one keypair (avoids gas-coin collisions) |

The contract with the hardware is two JSON files: **`reception_event.json`** (Python → Node) and
**`sui_state.json`** (Node → Python). The Python capture code is otherwise untouched.

---

## 6. How Walrus is used (the track's core)

| Capability | Where | What it does |
|---|---|---|
| On-chain **Blob objects + certificates** | `sui-client/walrus.js`, `record_image` | Uploads register a `Blob` on Sui; the image's blob id + certified epoch are anchored in `ImageCapture` — proof-of-reception backed by proof-of-availability. |
| **Quilt** | `sui-client/quilt.js` | Batches many tiny RF packets into one storage unit. |
| **Storage lifecycle** | `record_image` (`high_value`), `walrus.js` `renewBlob` | High-value captures can be retained/renewed by policy. |
| **Seal** | `access_policy.move`, `sui-client/seal.js` | Encrypts premium data; decryption gated on-chain. |
| **Agent memory** | `agents/shared/memory.js` (MemWal) | Verifiable, shareable agent memory on Walrus. |
| **Report artifacts** | `agents/shared/walrus.js` | Analyst reports stored on Walrus and reused as memory. |
| **Walrus Sites** | `walrus-sites/` | Host the dashboards decentralized. |

---

## 7. The agent internals (`agents/`)

Designed to run at three "power levels," degrading gracefully so it works with zero credentials.

| File | Job |
|---|---|
| `shared/env.js` | Loads `agents/.env` (imported first by every module that reads env) |
| `shared/memory.js` | Memory interface: **MemWal** if configured, else a **local-JSON** store (same `remember`/`recall`/`list` API) |
| `shared/llm.js` | Claude via Vercel AI SDK; `hasLLM` flips agents to heuristic mode when no API key |
| `shared/chain.js` | Sui reads (events, stations) + an optional real action (`heartbeat`) |
| `shared/walrus.js` | Upload report artifacts / download images via Walrus HTTP |
| `shared/passes.js` | Deterministic upcoming-pass predictor (swap for SGP4/TLE in prod) |
| `operator/`, `coordinator/`, `analyst/` | The three agents (each: `agent.js` logic + `index.js` runner) |
| `index.js` | Orchestrator: `operator \| coordinator \| analyst \| all \| demo` |

**Power levels:**
1. **No keys** → heuristic planners + local-JSON memory + synthetic image. Fully runnable.
2. **+ `ANTHROPIC_API_KEY`** → agents driven by Claude (Sonnet 4.6 loops, Opus 4.8 reasoning/vision).
3. **+ MemWal env** → memory persists to Walrus (verifiable/shareable). **+ Sui IDs** → Analyst reads
   real `ImageMerged` events; Operator submits real heartbeats.

> MemWal (`@mysten-incubation/memwal`) is dynamically imported and **not** a hard dependency (its
> Seal peer needs `@mysten/sui` v2, which conflicts with the v1 the rest of the repo uses). Enable
> with `npm install @mysten-incubation/memwal --legacy-peer-deps` + the `MEMWAL_*` env vars.

---

## 8. How the pieces connect (the seams)

| Seam | Mechanism |
|---|---|
| Hardware ↔ station service | `reception_event.json` (in) / `sui_state.json` (out) |
| Station service ↔ chain | Move entry-fn PTBs + reading objects/events (`sui-client/sui.js`) |
| Station ↔ station coordination | Sui **events** (`PoRxSubmitted`, `ImageMerged`) — no central broker |
| Chain ↔ dashboards | `@mysten/sui` reads + `queryEvents`; SuiNS for names |
| Pipeline ↔ agents | Agents read Sui events + Walrus images; act via tools |
| Agent ↔ agent | **Shared MemWal namespace** (skill profiles, coverage plans) |
| Data persistence | **Walrus** for all blobs (packets, images, reports); **Sui** for ownership/proofs |

---

## 9. Configuration reference (env)

- **`sui-client/.env`** — `SUI_PRIVATE_KEY`, `PACKAGE_ID`, `REGISTRY_ID`, `ACCESS_REGISTRY_ID`,
  `IS_PRIMARY`, `RUN_CRANK`, intervals.
- **`move/scripts/.env`** — owner key + the IDs from `publish.sh` + `STATIONS`.
- **`dashboard/.env.local`** — `NEXT_PUBLIC_PACKAGE_ID`, `NEXT_PUBLIC_REGISTRY_ID`.
- **`image-dashboard/.env.local`** — `NEXT_PUBLIC_PACKAGE_ID`.
- **`agents/.env`** — `ANTHROPIC_API_KEY`, `MEMWAL_*`, `PACKAGE_ID`/`REGISTRY_ID`, `STATION_IDS`.

See [`SETUP.md`](SETUP.md) for the exact deploy/run order.

---

## 10. Quick mental model (TL;DR)

- **Sui** = who did what + who gets paid (Move objects, events, AZM coin).
- **Walrus** = the actual bytes (packets, images, reports, agent memory), provably available.
- **Seal** = who may read the private bytes.
- **MemWal** = agents' verifiable, shared memory on Walrus.
- **The agents** = turn the real satellite-data stream into a system that plans, coordinates, and
  learns over time — the Walrus track's "Verifiable Data Platform for AI."
- **The hardware** = the unfair advantage: every byte of memory is grounded in real-world sensor data.
