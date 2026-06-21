# 🤖 Path B — Azimuth Agents: an agentic ground-station network with verifiable memory on Walrus

> **Goal:** make Azimuth fit the **actual** Walrus track problem statement —
> *"Walrus as a Verifiable Data Platform for AI"* — by adding a genuine **multi-agent
> system with persistent, verifiable memory on Walrus + MemWal**, built on top of the
> Sui/Walrus foundation already in this repo.

This is **not** a bolt-on. Azimuth produces a continuous stream of *real-world* sensor data
(satellite RF + reconstructed imagery). That is exactly the kind of long-running, artifact-rich,
multi-actor workflow the track wants agents to reason over — and "memory grounded in real
hardware data" is our unfair advantage over toy chatbots.

---

## 0. The reframe (one paragraph for judges)

> Azimuth is a decentralized network of real satellite ground stations. **Azimuth Agents** turns
> each station and the network itself into an **agentic system**: autonomous **Operator Agents**
> learn, over many sessions, which satellite passes are worth attempting; a **Coordinator Agent**
> negotiates and delegates coverage across stations to maximize combined image recovery; and an
> **Analyst Agent** turns reconstructed images into reusable intelligence reports. All of their
> memory — pass histories, station skill profiles, negotiation state, and analysis artifacts —
> lives in **Walrus via MemWal**: persistent across sessions, verifiable (tamper-evident),
> portable across models, and **shared** between agents through a common memory pool. Sui handles
> ownership/access and settles the rewards; **Seal** keeps sensitive memory private.

---

## 1. How every track requirement is satisfied

| Track asks for… | Azimuth Agents delivers | Where |
|---|---|---|
| **Functional AI agents / agentic workflows** | 3 cooperating agents (Operator, Coordinator, Analyst) running real loops | `agents/` |
| **Long-term memory (persistent, verifiable)** | Operator Agents store pass outcomes + station skill profiles in **MemWal**; `recall` before each decision | `agents/operator/` |
| **Persistent data & file access via Walrus** | Raw packets, merged images, and analysis reports are Walrus blobs (already wired) | existing `sui-client/`, new `agents/analyst/` |
| **Multi-agent coordination (negotiation, delegation)** | Coordinator assigns stations to passes / packet ranges to maximize recovery, reading shared memory | `agents/coordinator/` |
| **Artifact-driven workflows (generate/store/reuse files)** | Analyst generates structured imagery reports → Walrus → reused as memory next run | `agents/analyst/` |
| **Long-running workflows tracking state over time** | Continuous monitoring: agents run per-pass, accumulating state across days | all agents |
| **Cross-agent / cross-tool memory sharing** | Shared MemWal namespace = the "network brain"; all agents read/write it | `agents/shared/memory.js` |
| **Integrations & tooling for Walrus/MemWal** | A reusable **MemWal adapter for DePIN sensor agents** + Vercel AI SDK integration | `agents/shared/`, optional `packages/memwal-depin` |
| **Privacy** | Sensitive station memory + premium reports encrypted with **Seal** | reuse `access_policy.move`, `sui-client/seal.js` |
| **"Working systems, not demos"** | Agents act on real RF hardware data and settle real on-chain rewards | end-to-end |

---

## 2. Architecture (builds on what already exists)

```
        ┌────────────────────── MemWal (Walrus Memory) ──────────────────────┐
        │  shared namespace "azimuth-net":  station skill profiles · pass     │
        │  outcomes · negotiation state · report index   (verifiable, shared) │
        └────────▲───────────────────▲───────────────────▲───────────────────┘
                 │ remember/recall    │                   │
   ┌─────────────┴───┐   ┌────────────┴───────┐   ┌───────┴────────────┐
   │ Operator Agent  │   │ Coordinator Agent  │   │  Analyst Agent     │
   │ (1 per station) │   │ (network)          │   │  (network)         │
   │ • plan passes   │   │ • assign coverage  │   │ • vision analysis  │
   │ • learn quality │   │ • delegate tasks   │   │ • write reports →  │
   │ • act via tools │   │ • negotiate        │   │   Walrus artifacts │
   └───────▲─────────┘   └─────────▲──────────┘   └─────────▲──────────┘
           │ tools (function-calling)                       │
           ▼                                                ▼
   ┌──────────────────────────── existing layer ───────────────────────────┐
   │ sui-client/  (heartbeat, submit_porx, record_image, Walrus upload)     │
   │ ground_station/azimuth_station.py  (real RF capture)                   │
   │ move/azimuth  (orbital_vault: staking, PoA/PoRx, rewards, ImageCapture)│
   │ Walrus (blobs + certificates) · Seal (privacy) · Sui (ownership)       │
   └────────────────────────────────────────────────────────────────────────┘
```

The **agents are the new top layer**; everything below is the system already built in this repo.
Agents act on the world through **tools** that call the existing `sui-client` functions.

---

## 3. The agents in detail

All agents are built with the **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`, model: Claude —
Opus 4.8 for reasoning, Sonnet 4.6 for cheaper loops) and the **MemWal `/ai` middleware** so
recall/capture happen automatically around model calls.

### 3.1 Operator Agent (`agents/operator/`) — long-term memory
- **Runs:** once per upcoming pass (cron/loop) on each station.
- **Decision:** "Should this station attempt pass X, and with what config?" based on learned history.
- **Memory (MemWal, per-station + shared):**
  - `remember`: after each reception → `{ satellite, elevationDeg, localTime, rssi, snr, packetsRecovered, totalPackets, outcome }`.
  - `recall`: before planning → semantic query "best results for <satellite> at low elevation in the evening" to bias the schedule.
  - Over days, the agent measurably improves pass selection — the track's "agents become more useful when they remember and build over time."
- **Tools:** `getUpcomingPasses()`, `submitHeartbeat()`, `submitPoRx()` (wrap `sui-client/sui.js`).

### 3.2 Coordinator Agent (`agents/coordinator/`) — multi-agent coordination
- **Runs:** before each shared pass that ≥2 stations could see.
- **Behavior:** reads each Operator's **shared** skill profile from MemWal, then **negotiates/delegates**:
  assigns each station a role (e.g., station A covers the AOS half, station B the LOS half) to
  maximize combined packet recovery and avoid redundant capture.
- **Memory:** `remember` negotiation outcomes + realized recovery → learns which station pairings
  work; `recall` to inform the next assignment. This is the explicit "negotiation / task
  delegation / step-by-step execution across agents" bullet.
- **Output:** a coverage plan published to the shared namespace (and optionally anchored on Sui).

### 3.3 Analyst Agent (`agents/analyst/`) — artifact-driven workflows
- **Trigger:** the existing `ImageMerged` Sui event (a new merged image exists on Walrus).
- **Behavior:** downloads the image from Walrus → runs **vision analysis** (Claude multimodal):
  cloud cover %, anomaly/feature detection (storm, wildfire, ice), quality score.
- **Artifact:** writes a structured **report** (JSON + optional annotated image) → **Walrus blob**;
  indexes it in MemWal. Next runs `recall` prior reports to do **temporal comparison**
  ("how has this region changed vs. last week's capture?"). This is "generate, store, and reuse
  files like datasets, logs, reports."
- **High-value loop:** if the analyst flags a capture as important, it triggers
  `renew_capture`/`high_value` so Walrus retains it longer (ties back to programmable storage).

### 3.4 Shared memory & tooling (`agents/shared/`)
- `memory.js` — thin wrapper over **MemWal** (`MemWal.create({ key, accountId, serverUrl, namespace })`)
  exposing `remember`, `recall`, `restore`, plus a shared-pool helper for cross-agent reads.
- `tools.js` — Vercel AI SDK `tool()` definitions bridging to `sui-client` + Walrus.
- **Optional tooling deliverable (judges love tooling):** `packages/memwal-depin/` — a small,
  reusable **"MemWal adapter for DePIN sensor agents"**: standardizes how a physical-sensor agent
  records observations as verifiable memory + reloads them. This directly answers the track's
  "integrations and tooling that make it easier for developers to adopt Walrus/MemWal."

---

## 4. Tech stack (new vs. reused)

| Concern | Choice |
|---|---|
| Agent runtime | **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`) — function-calling agents |
| Model | **Claude Opus 4.8** (reasoning/negotiation), **Sonnet 4.6** (cheap loops), Claude vision for imagery |
| Agent memory | **MemWal** `@mysten-incubation/memwal` (+ `/ai` middleware), delegate key from the MemWal Playground |
| Artifact storage | **Walrus** (already wired in `sui-client/walrus.js`) |
| Privacy | **Seal** (`access_policy.move`, `sui-client/seal.js`) |
| Ownership / settlement | **Sui** Move package `azimuth::orbital_vault` (already built) |
| Real data source | `ground_station/azimuth_station.py` (unchanged) |

**Reused as-is:** the entire Move package, `sui-client`, Walrus/Seal integration, both dashboards.
**New:** `agents/` (operator, coordinator, analyst, shared), optional `packages/memwal-depin`,
a small dashboard panel to visualize agent memory + reports.

---

## 5. Implementation phases

### Phase 0 — MemWal spike (½ day)
- [ ] Create a MemWal Playground account + **delegate key** + account id; note the relayer `serverUrl`.
- [ ] `agents/shared/memory.js`: `remember` a test fact, `recall` it back. Confirm encryption + verifiability.

### Phase 1 — Operator Agent + tools (2 days)
- [ ] `agents/shared/tools.js` wrapping `sui-client` (heartbeat, submit_porx) + a pass-prediction stub.
- [ ] Operator loop with Vercel AI SDK + MemWal `/ai` middleware; remember/recall pass outcomes.
- [ ] Demonstrate improvement: seed history, show the agent's pass choices change as memory grows.

### Phase 2 — Analyst Agent (artifacts) (2 days)
- [ ] Subscribe to `ImageMerged` events; download image from Walrus.
- [ ] Claude vision analysis → structured report → upload report to Walrus → index in MemWal.
- [ ] Temporal comparison using `recall` of prior reports; mark `high_value` to renew storage.

### Phase 3 — Coordinator Agent (multi-agent) (2 days)
- [ ] Read Operators' shared skill profiles; produce a coverage plan via negotiation prompt.
- [ ] Publish plan to shared namespace; Operators consume it; record realized recovery as memory.

### Phase 4 — Tooling + UI + polish (1–2 days)
- [ ] Optional `packages/memwal-depin` adapter + README (the tooling track angle).
- [ ] Dashboard panel: live agent memory feed, coverage plans, and analyst reports (with Walrus links).
- [ ] (Stretch) ship the `oc-memwal` OpenClaw plugin path or a Vercel AI SDK sample.

### Phase 5 — Submission (1 day)
- [ ] Rewrite `README.md` around the **agentic** story (memory + coordination + artifacts).
- [ ] 2–3 min demo video: real capture → agents decide/coordinate → image analyzed → memory persists
      and improves the next run.

---

## 6. Demo script (what wins)

1. **Memory that compounds:** run an Operator Agent cold, then after seeded history — show it
   making *better* pass decisions, with the `recall` results on screen (verifiable, from Walrus).
2. **Multi-agent coordination:** Coordinator splits a pass between two stations; show combined
   recovery beat either station alone — decision + rationale pulled from shared memory.
3. **Artifact reuse:** Analyst produces a report on Walrus, then on the next pass *compares* to the
   prior report it recalled — "cloud cover up 18% vs. last week."
4. **Verifiable + private:** open the Walrus blob + Sui object for a memory; show a Seal-gated
   private memory that only the owner agent can decrypt.
5. **Grounded in reality:** all of it driven by the real RF hardware capture, not synthetic data.

---

## 7. Judging scorecard (this track's criteria)

| What judges want | How we hit it |
|---|---|
| Agents more useful because they remember & build over time | Operator/Analyst measurably improve via MemWal recall |
| Workflows improve when data is shared, durable, portable | Shared MemWal namespace + Walrus artifacts across agents |
| Move beyond fragile, siloed memory | Memory is verifiable, owned via Sui, portable across models |
| Working systems, not demos | Real hardware data + real on-chain settlement |
| Walrus/MemWal used deeply | Memory (MemWal) + artifacts (Walrus) + privacy (Seal) + ownership (Sui) |
| Developer tooling | Optional reusable MemWal-DePIN adapter |

---

## 8. Honest risks & mitigations

- **MemWal is beta.** APIs (`remember`/`recall`/`restore`, relayer) may shift; isolate all MemWal
  calls in `agents/shared/memory.js` so changes are one-file. Have a local-JSON fallback for the demo.
- **"Agentic" must be real, not a prompt wrapper.** The agents must take *consequential actions*
  (pass selection, coverage assignment, storage retention) whose outcomes feed back into memory —
  otherwise it reads as a chatbot. Keep the feedback loop front-and-center in the demo.
- **Scope.** Phases 1 + 2 (Operator memory + Analyst artifacts) are the must-win core; Coordinator
  (Phase 3) is the differentiator; tooling (Phase 4) is stretch. Ship in that order.
- **Cost/latency.** Use Sonnet 4.6 for high-frequency loops, Opus 4.8 only for negotiation/analysis.
- **Two-track temptation:** you can still enter Azimuth-as-DePIN in **Explorations** with the
  current build; this agentic layer is what makes it a *Walrus-track* contender.

---

## 9. References

- Walrus Memory (MemWal) product — https://walrus.xyz/products/walrus-memory/
- MemWal GitHub — https://github.com/MystenLabs/MemWal
- MemWal SDK API reference — https://docs.wal.app/walrus-memory/sdk/api-reference
- Walrus docs — https://docs.wal.app/
- Seal docs — https://seal-docs.wal.app/
- Vercel AI SDK — https://sdk.vercel.ai/
- Sui Overflow — https://overflow.sui.io/

---

*Net: keep the entire Sui + Walrus foundation already built; add a real multi-agent system whose
verifiable, shared memory lives on Walrus via MemWal. That is the Walrus track's actual ask — and
Azimuth's real-world data makes the memory worth having.*
