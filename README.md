<div align="center">

# 🛰️ Azimuth

### A verifiable, shared memory of Earth — built by an autonomous sensor-agent network

**Real ground stations capture satellite imagery. Autonomous agents analyze it and accumulate a tamper-proof environmental record on Walrus — memory that's verifiable, shared, portable, and grounded in real-world data.**

![Sui](https://img.shields.io/badge/Sui-Move-4da2ff?style=flat-square)
![Walrus](https://img.shields.io/badge/Walrus-Blobs%20%2B%20Certificates-22c55e?style=flat-square)
![MemWal](https://img.shields.io/badge/MemWal-Agent%20Memory-7c3aed?style=flat-square)
![Seal](https://img.shields.io/badge/Seal-Encrypted%20Premium-8b5cf6?style=flat-square)
![Claude](https://img.shields.io/badge/Agents-Claude%20%C2%B7%20Vercel%20AI%20SDK-d97757?style=flat-square)

**Built for the [Sui Overflow](https://overflow.sui.io/) Walrus track — _"Walrus as a Verifiable Data Platform for AI."_**

</div>

---

## The idea

AI agents are powerful but **forgetful and siloed** — they lose context across sessions and can't share what they learn. The Walrus track asks builders to fix that using **Walrus + MemWal** as a *verifiable* memory layer for agents.

**Azimuth answers with the one thing software-only agents can't fake: real-world data.** A network of real satellite ground stations feeds an autonomous multi-agent system whose memory lives on **Walrus via MemWal**:

- **Operator Agents** learn, across sessions, which satellite passes are worth attempting.
- A **Coordinator Agent** reads each station's *shared* skill profile and negotiates coverage to maximize combined image recovery.
- An **Analyst Agent** turns merged images into intelligence reports, stores them on Walrus, and recalls prior reports to detect change over time.

All of it — pass histories, station skill profiles, coverage plans, analysis reports — is **persistent, shareable, and tamper-evident** on Walrus. A station can't fake its own track record; the environmental record outlives any operator and is owned by no one.

> **12-word pitch:** *Autonomous agents building a tamper-proof, shared memory of Earth on Walrus.*

---

## It actually runs (verified live)

Not slides — real output from the agents on Sui testnet, real Claude, and real MemWal:

**Operator Agent — real Claude planning, memory on Walrus (MemWal):**
```
🛰️  Operator Agent [station-a] — memory backend: memwal
   planner: LLM
   [ATTEMPT] P9 NOAA-15 @76° — Highest priorSNR (8.4) and ~overhead 76° elevation; best candidate
             to establish a baseline. High confidence of clean APT recovery.
   [skip]    ISS @41° — SSTV not weather imagery, below-average SNR, NOAA-15 overlaps 6 min later.
   remembered: Station station-a received NOAA-15 at 76° (91% packets, SNR 14.2)  → Walrus
```

**Coordinator Agent — multi-agent negotiation from shared MemWal profiles:**
```
🛰️  Coordinator Agent — stations [station-a, station-b] — memory: memwal
   Pass NOAA-15 (76°) — LLM
     station-a → AOS  (tied at 71% avg recovery — split to maximize coverage, no redundant capture)
     station-b → LOS  (complements station-a's AOS half across the full 8-min pass)
```

**Verifiability proof — anyone can independently re-fetch a memory:**
```
🔎 blob 9iYp6QSq… — no Azimuth keys, just public aggregators
   ✅ aggregator.walrus-testnet.walrus.space      361 bytes · sha256 c29d7bee…
   ✅ walrus-testnet-aggregator.nodes.guru        361 bytes · sha256 c29d7bee…
   ✅ byte-identical across independent aggregators → durable, portable, tamper-evident
```

---

## How it maps to the Walrus track

| Track asks for… | Azimuth delivers | Where |
|---|---|---|
| **Long-term agent memory (verifiable)** | Operator recalls pass history from **MemWal**; decisions compound across sessions | `agents/operator/` |
| **Multi-agent coordination** | Coordinator negotiates AOS/LOS coverage from **shared** memory | `agents/coordinator/` |
| **Artifact-driven workflows** | Analyst writes intelligence reports to **Walrus**, reuses priors for change detection | `agents/analyst/` |
| **Cross-agent / shared memory** | One shared MemWal namespace = the network's verifiable brain | `agents/shared/memory.js` |
| **Tooling for Walrus/MemWal adoption** | **`@azimuth/memwal-depin`** — reusable DePIN-sensor → Walrus-memory adapter | `packages/memwal-depin/` |
| **Verifiable data** | `npm run verify` re-fetches a memory from public aggregators, byte-identical | `agents/verify.mjs` |
| **Privacy** | Premium captures **Seal-encrypted**, on-chain access policy | `move/.../access_policy.move` |

---

## Architecture

```
┌──────────────────────── AGENT LAYER (agents/) ─────────────────────────┐
│  Operator · Coordinator · Analyst   — Claude via Vercel AI SDK           │
│  memory on Walrus via MemWal (verifiable, shared, portable)             │
└─────────▲──────────────────────────────────────────────▲───────────────┘
          │ reads Sui events / Walrus images              │ writes reports → Walrus
┌─────────┴──────────────── SUI + WALRUS SUBSTRATE ───────┴───────────────┐
│  ground_station/ (real RF capture) → sui-client/ (Node service)         │
│  move/azimuth (staking · PoA/PoRx · rewards · ImageCapture + certs)     │
│  Walrus (blobs + certificates · Quilt · Seal)  ·  Sui (objects, events) │
│  dashboard/ (station ops)  ·  image-dashboard/ (gallery + Agent panel)  │
└──────────────────────────────────────────────────────────────────────────┘
```

The **agents are the star**; the Sui + Walrus pipeline below them is the substrate that produces the real data they remember. (That pipeline is itself a full DePIN system — see [`HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md).)

---

## Quick start — run the agents

```bash
cd agents
cp .env.example .env
npm install --legacy-peer-deps

npm run demo     # scripted: memory compounds → coordination → analysis report
npm run verify   # independent verifiability proof of a memory blob on Walrus
```

Runs immediately with **no credentials** (heuristic planners + local memory). Add keys to go fully real:
- `ANTHROPIC_API_KEY` → real Claude agents (+ vision)
- `MEMWAL_KEY` / `MEMWAL_ACCOUNT_ID` / `MEMWAL_SERVER_URL` (from https://memory.walrus.xyz/) → memory on Walrus
- `PACKAGE_ID` / `REGISTRY_ID` / `STATION_IDS` → Analyst reads real `ImageMerged` events; Operator acts on-chain
- then `npm run watch` — plan once, then auto-analyze every new merged image

The full ground-station + chain + dashboards setup is in [`SETUP.md`](docs/SETUP.md).

---

## Repository layout

```
agents/                The multi-agent system (Operator · Coordinator · Analyst) + verify.mjs
packages/memwal-depin/ Reusable DePIN-sensor → Walrus-memory adapter
move/azimuth/          Sui Move package (staking, PoA/PoRx, rewards, image records, Seal policy)
sui-client/            Node service per station (heartbeats, proofs, Walrus, image merge)
ground_station/        Python LoRa/RTL-SDR receiver + Pygame UI (real hardware capture)
dashboard/             Station-ops dashboard (Sui + dApp Kit + SuiNS)
image-dashboard/       Merged-image gallery + Agent Intelligence panel
walrus-sites/          Walrus Sites hosting configs
```

Key docs: [`HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md) · [`SUI_STACK.md`](docs/SUI_STACK.md) · [`SETUP.md`](docs/SETUP.md) · [`WINNING_PLAN.md`](docs/WINNING_PLAN.md) · [`DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)

---

## Status (honest)

- ✅ **Verified live:** MemWal write/recall, Operator (real Claude + MemWal), Coordinator (negotiation from shared memory), the verifiability proof, the reusable adapter.
- ✅ **Built:** Move package (+ tests), sui-client, both dashboards (Agent Intelligence panel), Quilt/Seal paths.
- ⏳ **Needs the Move package published** for the Analyst's *real-image* Claude vision (set real `PACKAGE_ID`/`REGISTRY_ID`); until then it analyzes a synthetic image but still writes reports to Walrus.
- ⏳ **Submission:** demo video (see [`DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)).

> Notes: Opus 4.8 needs a newer AI SDK than the pinned v4 (it rejects the `temperature` param), so the agents default to **Claude Sonnet 4.6**. MemWal requires `@mysten/seal` at runtime and `--legacy-peer-deps` (its Seal peer wants `@mysten/sui` v2).

---

*One product, three networks doing real work: **Sui** proves it · **Walrus + MemWal** remember it · **the hardware** grounds it in reality.*
