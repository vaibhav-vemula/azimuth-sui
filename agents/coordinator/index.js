/**
 * Coordinator Agent runner.
 *
 * Picks the next upcoming shared pass and negotiates a coverage plan across stations using
 * their shared skill profiles, then publishes the plan to shared memory.
 */

import { createMemory } from "../shared/memory.js";
import { predictUpcomingPasses } from "../shared/passes.js";
import { planCoverage, publishPlan } from "./agent.js";

export async function runCoordinatorCycle({ stationIds, count = 3 } = {}) {
  const ids = stationIds || (process.env.STATION_IDS || "station-a,station-b").split(",").map((s) => s.trim());
  const shared = await createMemory(process.env.MEMWAL_NAMESPACE || "azimuth-net");

  console.log(`\n🛰️  Coordinator Agent — stations [${ids.join(", ")}] — memory: ${shared.backend}`);

  // Use station-a's predicted schedule as the shared pass timeline.
  const passes = predictUpcomingPasses(ids[0], count);

  for (const pass of passes) {
    const plan = await planCoverage({ pass, stationIds: ids, shared });
    console.log(`\n   Pass ${pass.id} (${pass.satellite}, ${pass.maxElevation}°) — ${plan.usedLLM ? "LLM" : "heuristic"}`);
    for (const a of plan.assignments) console.log(`     ${a.stationId} → ${a.role}  (${a.reason})`);
    const text = await publishPlan(shared, pass, plan);
    console.log(`   published: ${text}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCoordinatorCycle().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
