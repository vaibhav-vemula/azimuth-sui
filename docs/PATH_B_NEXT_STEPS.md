# Path B — Verdict, MemWal facts & next steps

Companion to **[PATH_B_AGENTIC_PLAN.md](PATH_B_AGENTIC_PLAN.md)**. This is the short, actionable version.

---

## The verdict (why Path B exists)

The Sui Overflow **Walrus track** is *"Walrus as a Verifiable Data Platform for AI"* — it wants
**AI agents / agentic workflows** with **persistent, verifiable, shareable memory** on Walrus +
**MemWal (Walrus Memory)**.

- **Azimuth as-is does NOT fit this track** (no agents, no agent memory) — it's a satellite-DePIN
  data project. It *would* fit the **Explorations / DePIN** track as-is.
- **Path B** makes it fit by adding a real multi-agent layer whose memory lives on Walrus/MemWal,
  on top of the Sui/Walrus foundation already built (Move package, `sui-client`, Walrus/Seal,
  dashboards) — nothing already built is wasted.

---

## MemWal quickstart facts (from research)

- Package: `@mysten-incubation/memwal` (also `/manual` and `/ai` Vercel AI SDK middleware).
- Init: `MemWal.create({ key, accountId, serverUrl, namespace })`.
- Core ops: **`remember`** (store), **`recall`** (semantic retrieve), **`restore`** (rehydrate).
- You need a **delegate key + account id + relayer URL** from the **MemWal Playground**
  (https://walrus.xyz/products/walrus-memory/ → playground). I cannot create this for you.
- It's **beta** → all MemWal calls will be isolated in `agents/shared/memory.js` with a
  local-JSON fallback so the system runs before MemWal is wired.
- Repo/refs: https://github.com/MystenLabs/MemWal · https://docs.wal.app/walrus-memory/sdk/api-reference

---

## Two decisions for you

1. **MemWal access** — get a Playground delegate key/account, or start now on a local-JSON memory
   fallback and swap MemWal in later? (Recommended: start on the fallback so we don't block.)
2. **Hedge** — also keep the current build submission-ready for **Explorations/DePIN** in parallel,
   or go all-in on Path B?

---

## Immediate next actions (Phase 0 + 1)

- [ ] `agents/` workspace: `package.json` (`ai`, `@ai-sdk/anthropic`, `@mysten-incubation/memwal`), `.env.example`.
- [ ] `agents/shared/memory.js` — MemWal wrapper (`remember`/`recall`/`restore`) + local-JSON fallback.
- [ ] `agents/shared/tools.js` — Vercel AI SDK tools bridging to `sui-client` (heartbeat, submit_porx) + pass prediction.
- [ ] `agents/operator/` — Operator Agent loop: recall history → decide passes → act → remember outcome.
- [ ] Demo: seed history, show pass decisions improve as memory grows.

Then Phase 2 (Analyst artifacts) → Phase 3 (Coordinator multi-agent) → Phase 4 (tooling + UI).

Models: **Claude Sonnet 4.6** for high-frequency loops, **Claude Opus 4.8** for negotiation/vision analysis.
