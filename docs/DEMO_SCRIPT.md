# 🎬 Azimuth — Demo Video Script (Walrus Track)

**Target length:** 2:45–3:00. **Thesis to land:** *Autonomous agents building a tamper-proof,
shared memory of Earth on Walrus.* The demo is the primary judging artifact — every shot proves a
track requirement with **real output**, not slides.

---

## Pre-flight checklist (record only after all green)

```bash
# 1. Agents configured for REAL run
cd agents && cat .env    # ANTHROPIC_API_KEY ✓  MEMWAL_KEY/ACCOUNT_ID/SERVER_URL ✓
npm install --legacy-peer-deps

# 2. Confirm the real path works (you should see "backend: memwal" + "planner: LLM")
node index.js operator

# 3. Have a memory blob id ready for the verify shot (from the run above / reports-index.json)

# 4. (Best) Move package published + PACKAGE_ID/REGISTRY_ID/STATION_IDS set, with ≥1 merged
#    image on-chain → enables real-image Claude vision. If not done, use the synthetic-image
#    Analyst run and SAY it's a stand-in for the deployed pipeline.

# 5. Dashboards up:  cd image-dashboard && npm run dev    (:3001, Agent Intelligence panel)
#    Station ops:     cd dashboard && npm run dev          (:3000)
```

Record terminal at a large font; pre-clear scrollback before each shot.

---

## Shot list

### 0:00–0:20 — Hook: it's real
- **Visual:** the actual antenna / RTL-SDR + Raspberry Pi (or a real captured satellite image).
- **VO:** "Every day satellites pass overhead and most of their data is lost. Azimuth is a network
  of real ground stations that capture it — and turns that real-world data into something AI agents
  can *remember and trust*."
- *Why:* establishes the unfair advantage (real data) in the first 20 seconds.

### 0:20–0:50 — The problem + the thesis
- **Visual:** one-line architecture (the diagram from the README).
- **VO:** "AI agents forget across sessions and can't share what they learn. The Walrus track is
  about fixing that with verifiable memory. Azimuth's agents store everything they learn on Walrus,
  through MemWal — persistent, shared, and tamper-proof."

### 0:50–1:25 — Memory that compounds (Operator Agent) ⭐
- **Action:** `node agents/index.js operator` (run it **twice**).
- **Visual:** highlight `memory backend: memwal` and `planner: LLM`, then the reasoned ATTEMPT/skip
  decisions, then `remembered: … → Walrus`. On the **second** run, point to a decision that cites
  prior history.
- **VO:** "A real Claude agent decides which passes to attempt — and writes each outcome to Walrus.
  Run it again and it *recalls* what it learned: its memory compounds across sessions."
- *Track box ticked:* long-term verifiable memory.

### 1:25–2:00 — Agents coordinating (Coordinator Agent) ⭐
- **Action:** `node agents/index.js coordinator`.
- **Visual:** `— LLM`, the `station-a → AOS / station-b → LOS` split, and the rationale citing the
  **71% skill profiles read from shared memory**.
- **VO:** "A second agent reads every station's track record from the *shared* Walrus memory and
  negotiates who covers which half of the pass — multi-agent coordination over verifiable data."
- *Track box ticked:* multi-agent coordination + shared memory.

### 2:00–2:30 — Intelligence as artifacts (Analyst + dashboard) ⭐
- **Action:** `node agents/index.js analyst`, then switch to the gallery at `localhost:3001`.
- **Visual:** the **🤖 Agent Intelligence** panel — a report with cloud %, quality, and the
  **"verifiable memory on Walrus ↗"** link; open an image to show the inline analysis.
- **VO:** "The Analyst turns each merged image into an intelligence report, stores it on Walrus, and
  recalls past reports to track how a region changes over time."
- *Track box ticked:* artifact-driven workflows.

### 2:30–2:50 — Why "verifiable" is real ⭐
- **Action:** `npm run verify` (in `agents/`).
- **Visual:** the same blob fetched **byte-identical from two independent public aggregators**, no
  Azimuth keys.
- **VO:** "And it's genuinely verifiable: anyone can re-fetch this memory from public Walrus nodes
  and get the exact same bytes. No operator can forge or quietly rewrite the record."
- *Track box ticked:* verifiable data (the literal theme).

### 2:50–3:00 — Close
- **Visual:** back to the antenna; the pitch line on screen.
- **VO:** "Azimuth — autonomous agents building a verifiable, shared memory of Earth, on Walrus."

---

## Optional 15s b-roll (if room / for the writeup)
- The reusable tooling: `cat packages/memwal-depin/README.md` → "any DePIN project can give its
  agents verifiable Walrus memory in ten lines." (Tooling is an explicit track ask.)

---

## Talking-points cheat sheet (for the submission text)
- **Real-world data** = the moat: memory grounded in physical sensors, not a toy chatbot.
- **MemWal** = the memory is verifiable, shared across agents, portable across models.
- **Verifiable matters because** Azimuth is an *untrusted* DePIN operator network — a node can't
  fake its skill profile or rewrite history.
- **Built to last** = a durable environmental record + a reusable MemWal-DePIN adapter for other builders.

## Do / don't
- ✅ Show real terminal output and the live dashboard. ✅ Keep each shot < 35s. ✅ Say what's real vs. a stand-in.
- ❌ Don't fake the verify step. ❌ Don't claim Analyst real-image vision unless the package is
  published — if not, show the synthetic-image run and note it's a stand-in for the deployed pipeline.
