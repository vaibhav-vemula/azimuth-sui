# 🤖 Azimuth Agents

A multi-agent ground-station network whose **memory lives on Walrus via MemWal** — built for the
Sui Overflow **Walrus track** ("Walrus as a Verifiable Data Platform for AI"). Agents sit on top
of the existing Azimuth Sui/Walrus stack (`move/`, `sui-client/`, dashboards).

## The agents

| Agent | Track requirement | What it does |
|---|---|---|
| **Operator** (`operator/`) | Long-term memory | Recalls past pass outcomes from Walrus/MemWal, decides which passes to attempt, acts, remembers results — improving over sessions. |
| **Coordinator** (`coordinator/`) | Multi-agent coordination | Reads stations' shared skill profiles and negotiates/delegates pass coverage to maximize combined recovery. |
| **Analyst** (`analyst/`) | Artifact-driven workflows | Analyzes merged images (vision), writes report artifacts to Walrus, recalls prior reports for temporal comparison. |

All memory is verifiable + shareable across agents through a common MemWal namespace
(`shared/memory.js`). Without MemWal credentials it transparently uses a local-JSON store with the
same interface, so the whole system runs immediately.

## Run

```bash
cd agents
cp .env.example .env      # optional: add ANTHROPIC_API_KEY, MemWal, PACKAGE_ID/REGISTRY_ID
npm install --legacy-peer-deps   # --legacy-peer-deps: MemWal's Seal peer wants @mysten/sui v2

npm run demo              # scripted narrative: memory compounding → coordination → reports
npm run watch            # LIVE: plan once, then auto-analyze new ImageMerged events
# or individually:
node index.js operator
node index.js coordinator
node index.js analyst        # one pass   (node analyst/index.js --watch for continuous)
node index.js all
```

To use **real Walrus memory** instead of the local-JSON fallback, set `MEMWAL_KEY`
(or `MEMWAL_PRIVATE_KEY`), `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL` from
https://memory.walrus.xyz/ . To use **real Claude** agents, set `ANTHROPIC_API_KEY`.

### Verifiability proof
```bash
npm run verify          # re-fetches the latest report blob from PUBLIC Walrus aggregators
node verify.mjs <blobId>
```
Shows a memory blob is independently retrievable + byte-identical across aggregators (content-addressed,
tamper-evident) — using no Azimuth keys.

### Reusable tooling
Sensor→Walrus-memory recording is factored into **[`../packages/memwal-depin`](../packages/memwal-depin)**,
a standalone adapter any DePIN project can use. The Operator Agent records pass outcomes through it.

### Modes of operation
- **No keys:** runs fully (heuristic planners + local memory + synthetic image) — great for a first look.
- **+ `ANTHROPIC_API_KEY`:** agents are driven by Claude (Vercel AI SDK); Analyst uses Claude vision.
- **+ MemWal env:** memory persists to Walrus (verifiable, shareable, portable).
- **+ `PACKAGE_ID`/`REGISTRY_ID` (+ `SUI_PRIVATE_KEY`):** Analyst reads real `ImageMerged` events
  and the Operator can submit a real on-chain heartbeat.

## How it maps to the existing system
- Operator's on-chain action calls `azimuth::orbital_vault::heartbeat` (the Move package).
- Analyst consumes the `ImageMerged` events emitted by `sui-client/imageMerger.js` and reads the
  merged images from Walrus.
- Report artifacts are stored on Walrus and indexed in MemWal for reuse.

## Files
```
shared/   env, memory (MemWal + local), llm (Claude), chain (Sui), walrus, passes (predictor)
operator/ agent + runner
coordinator/ agent + runner
analyst/  agent + runner
index.js  orchestrator (operator | coordinator | analyst | all | demo)
```

See `../PATH_B_AGENTIC_PLAN.md` for the full design and judging-criteria mapping.
