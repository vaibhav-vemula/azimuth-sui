#!/usr/bin/env node
/**
 * Azimuth Agents — orchestrator.
 *
 *   node index.js operator      one Operator planning cycle (STATION_ID)
 *   node index.js coordinator   one Coordinator coverage cycle (STATION_IDS)
 *   node index.js analyst       analyze new merged images (or a demo image)
 *   node index.js all           operator (per station) → coordinator → analyst (once)
 *   node index.js watch         plan once, then keep the Analyst live on new images
 *   node index.js demo          scripted narrative showing memory compounding
 */

import "./shared/env.js";
import { runOperatorCycle } from "./operator/index.js";
import { runCoordinatorCycle } from "./coordinator/index.js";
import { runAnalystCycle, runAnalystWatch } from "./analyst/index.js";

const mode = process.argv[2] || "all";
const stationIds = (process.env.STATION_IDS || "station-a,station-b").split(",").map((s) => s.trim());

async function runAll() {
  for (const id of stationIds) await runOperatorCycle({ stationId: id });
  await runCoordinatorCycle({ stationIds });
  await runAnalystCycle();
}

// Live mode: plan once across stations, then keep the Analyst running on new images.
async function runWatch() {
  for (const id of stationIds) {
    try { await runOperatorCycle({ stationId: id }); }
    catch (e) { console.warn(`[watch] operator ${id} failed: ${e.message}`); }
  }
  try { await runCoordinatorCycle({ stationIds }); }
  catch (e) { console.warn(`[watch] coordinator failed: ${e.message}`); }
  await runAnalystWatch({ intervalMs: Number(process.env.WATCH_INTERVAL_MS || 30000) });
}

async function runDemo() {
  console.log("════════════════════════════════════════════════════════════");
  console.log(" AZIMUTH AGENTS — verifiable agent memory on Walrus (MemWal)");
  console.log("════════════════════════════════════════════════════════════");

  console.log("\n▶ Step 1: Operator Agent runs across stations and REMEMBERS outcomes.");
  for (const id of stationIds) await runOperatorCycle({ stationId: id });

  console.log("\n▶ Step 2: Operator Agent runs AGAIN — now it RECALLs the history it just");
  console.log("  wrote and its decisions are informed by past results (memory compounds).");
  for (const id of stationIds) await runOperatorCycle({ stationId: id });

  console.log("\n▶ Step 3: Coordinator Agent reads SHARED skill profiles and negotiates coverage.");
  await runCoordinatorCycle({ stationIds });

  console.log("\n▶ Step 4: Analyst Agent turns a merged image into a report artifact on Walrus,");
  console.log("  recalling prior reports for temporal comparison.");
  await runAnalystCycle();

  console.log("\n✅ Demo complete. Memory persisted (Walrus/MemWal or local .memory/).");
}

const routes = {
  operator: () => runOperatorCycle({ stationId: stationIds[0] }),
  coordinator: () => runCoordinatorCycle({ stationIds }),
  analyst: () => runAnalystCycle(),
  all: runAll,
  watch: runWatch,
  demo: runDemo,
};

const fn = routes[mode];
if (!fn) {
  console.error(`Unknown mode "${mode}". Use: operator | coordinator | analyst | all | demo`);
  process.exit(1);
}
fn().catch((e) => {
  console.error(e);
  process.exit(1);
});
