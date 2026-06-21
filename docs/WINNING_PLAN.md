# 🏆 Azimuth — Winning Plan (Sui Overflow · Walrus Track)

One committed path. No options. Built to maximize win probability on the **Walrus track**
("Walrus as a Verifiable Data Platform for AI").

---

## The decision

**Commit fully to the Walrus track with the agent + verifiable memory as the star.**
Make the **Analyst Agent the centerpiece**, reframed as:

> **Azimuth — a verifiable, shared memory of Earth, built by an autonomous sensor-agent network.**
> Real ground stations capture satellite imagery; autonomous agents analyze it and accumulate a
> **tamper-proof environmental record on Walrus/MemWal**, recall it to detect change over time, and
> coordinate to fill coverage gaps. The memory is verifiable, shared, portable — and grounded in
> real-world data no software-only team can fake.

This wins because it is **natively** about long-term memory + artifacts + multi-agent + real data +
a durable record, AND it leverages the one thing competitors can't copy: **a physical sensor network
feeding verifiable memory.**

The 12-word pitch judges remember:
**"Autonomous agents building a tamper-proof, shared memory of Earth on Walrus."**

---

## What we cut (focus = winning)

- **Demote** the Operator and Coordinator from "stars" to **supporting evidence** of multi-agent +
  coordination. Keep them, but don't over-invest. The Analyst + verifiable memory is the story.
- **Drop** synthetic-pass-predictor polish and simulated outcomes from the *demo path* — the demo
  uses **real captured images** through the Analyst.
- **Defer** Walrus Sites, SuiNS polish, and the premium-marketplace UI unless time remains.

---

## Division of labor

**You must do (needs your accounts — blocks the "real" demo):**
1. **MemWal Playground** → create account + **delegate key** + account id + relayer URL.
   Put them in `agents/.env` (`MEMWAL_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL`).
   Install: `cd agents && npm install @mysten-incubation/memwal --legacy-peer-deps`.
2. **`ANTHROPIC_API_KEY`** in `agents/.env` (turns agents into real Claude reasoning + vision).
3. **Confirm the submission deadline + rules** (one primary track? video required?) on the official site.
4. **Publish the Move package + run a station** once (or use the simulated reception in SETUP.md) so
   there are real `ImageMerged` events + merged images on Walrus for the Analyst to consume.

**I will build (no credentials needed):**
- Refocus the agent layer on the Analyst "change-detection over time" story.
- **Close the loops** so agents are *used*, not alongside (see Phase 2).
- An **agent-reports panel** in `image-dashboard` (verifiable memory + reports visible).
- A **MemWal-DePIN adapter** package (the track's "tooling" bonus).
- A polished demo script + submission README.

---

## Phases (sequenced, each independently shippable)

### Phase 1 — Make it real (unblocks everything)
- [ ] You: MemWal key + `ANTHROPIC_API_KEY` in `agents/.env`; install memwal.
- [ ] Me: verify agents run on **real MemWal + real Claude** (not fallback); fix any SDK-version drift.
- [ ] Done when: `node index.js analyst` writes a report to Walrus **and** its memory persists in MemWal,
      using Claude vision on a real image.

### Phase 2 — Close the loops (agents become *used*, not detached)
- [ ] Analyst runs **automatically** on new `ImageMerged` events (a small daemon / `sui-client` hook),
      not manual invocation.
- [ ] Memory **visibly compounds**: second analysis of the same region recalls the prior report and
      states the change ("cloud cover +18% vs. last capture").
- [ ] Coordinator's coverage plan is **published and read back** (show the loop closing).
- [ ] Done when: a fresh capture flows hardware → merge → auto-analysis → verifiable memory → recall,
      with no manual agent step.

### Phase 3 — Show it (the dashboard is half the demo)
- [ ] `image-dashboard`: an **"Agent Intelligence"** panel per image — the Analyst report, a link to
      its **Walrus memory blob**, and the **change-vs-prior** note.
- [ ] A small **memory timeline** view: the growing, verifiable environmental record.
- [ ] Done when: a judge can click an image and *see* the verifiable agent memory behind it.

### Phase 4 — Differentiate (built-to-last signals)
- [ ] `packages/memwal-depin/` — a reusable **"MemWal adapter for DePIN sensor agents"** + README:
      standardizes recording sensor observations as verifiable memory. (Track explicitly asks for tooling.)
- [ ] One-paragraph **verifiability proof**: show a memory's Walrus blob can be independently re-fetched
      and re-verified.

### Phase 5 — Win the submission (the demo is the product)
- [ ] **2–3 min demo video**, scripted (below).
- [ ] Rewrite `README.md` around the winning thesis; deployed object IDs + Walrus links + live URLs.
- [ ] Submit under the **Walrus track** before the deadline.

---

## The demo script (your #1 deliverable)

1. **0:00 Hook (real-world edge):** the actual antenna receiving a pass. "This is real satellite data."
2. **0:30 Capture → Walrus → Sui:** image merged, stored on Walrus, anchored on Sui (certificate).
3. **1:00 Agent analyzes:** Claude vision report appears; written to **MemWal (Walrus memory)**.
4. **1:30 Memory compounds:** next capture of the same region — the agent **recalls the prior memory**
   and reports the **change over time**. (This is the money shot for the track.)
5. **2:00 Verifiable + shared:** open the memory's Walrus blob; "tamper-proof, portable, owned by no one —
   and an untrusted operator can't fake it."
6. **2:30 Close:** "Autonomous agents building a verifiable, shared memory of Earth, on Walrus."

---

## Submission checklist (definition of "win-ready")

- [ ] Runs on **real MemWal** (not local fallback) and **real Claude** (not heuristics).
- [ ] Agents are **triggered by the live pipeline** (closed loop), not run by hand.
- [ ] Memory **demonstrably compounds** (recall → change detection) on camera.
- [ ] **Verifiable** angle shown explicitly (re-fetch + re-verify a memory blob).
- [ ] Dashboard surfaces the agent memory/reports.
- [ ] Reusable **MemWal tooling** shipped (bonus).
- [ ] Tight **demo video** + clear README + deployed IDs/links.
- [ ] Deadline + track rules confirmed.

---

## Risk & contingency

- **If you can't get a MemWal key in time:** the whole thesis weakens — escalate this first.
- **If the agent story still feels thin to you:** the safe fallback is the **Explorations/DePIN** track,
  where current Azimuth fits with near-zero reframing. Decide *before* Phase 4 which track you submit to;
  don't split effort across both.
- **MemWal is beta:** all MemWal calls are isolated in `agents/shared/memory.js`; if the SDK breaks,
  the local fallback keeps the system runnable while we fix it.

---

## Start here

Phase 1 is the gate. The moment `agents/.env` has the **MemWal key + `ANTHROPIC_API_KEY`**, everything
downstream becomes "real." In parallel, I can build Phase 2 + 3 (closing the loops + the dashboard
panel) now, since those don't need your credentials.
