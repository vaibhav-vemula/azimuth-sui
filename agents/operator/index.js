/**
 * Operator Agent runner.
 *
 * One planning cycle: predict upcoming passes → recall history → decide → act
 * (optional on-chain heartbeat) → simulate/record outcomes back into memory.
 * Run repeatedly (or via the orchestrator) to watch decisions improve as memory grows.
 */

import { createMemory } from "../shared/memory.js";
import { predictUpcomingPasses } from "../shared/passes.js";
import { chainReady, submitHeartbeat } from "../shared/chain.js";
import { planPasses, simulateOutcome, recordOutcome } from "./agent.js";

export async function runOperatorCycle({ stationId, count = 5, act = true, simulate = true } = {}) {
  const id = stationId || process.env.STATION_ID || "station-a";
  const memory = await createMemory(id);
  const shared = await createMemory(process.env.MEMWAL_NAMESPACE || "azimuth-net");

  console.log(`\n🛰️  Operator Agent [${id}] — memory backend: ${memory.backend}`);

  const passes = predictUpcomingPasses(id, count);
  const { plan, usedLLM } = await planPasses({ stationId: id, memory, passes });
  console.log(`   planner: ${usedLLM ? "LLM" : "heuristic"}`);

  const byId = Object.fromEntries(passes.map((p) => [p.id, p]));
  for (const d of plan.sort((a, b) => b.priority - a.priority)) {
    const p = byId[d.passId];
    if (!p) continue;
    const tag = d.attempt ? "ATTEMPT" : "skip   ";
    console.log(`   [${tag}] P${d.priority} ${p.satellite} @${p.maxElevation}° — ${d.reason}`);
  }

  // Act on-chain (prove the agent does something consequential) — optional.
  if (act && chainReady) {
    const hb = await submitHeartbeat();
    console.log(`   heartbeat: ${hb.ok ? hb.digest : "skipped (" + hb.reason + ")"}`);
  }

  // Close the loop: record outcomes for attempted passes so memory compounds.
  if (simulate) {
    for (const d of plan.filter((x) => x.attempt)) {
      const p = byId[d.passId];
      if (!p) continue;
      const outcome = simulateOutcome(p);
      const text = await recordOutcome({ memory, shared, stationId: id, pass: p, outcome });
      console.log(`   remembered: ${text}`);
    }
  }

  return { plan, passes };
}

// Allow `node operator/index.js` directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runOperatorCycle().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
