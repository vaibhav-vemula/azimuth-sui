#!/usr/bin/env node
/**
 * Azimuth Sui Client — main entry point.
 *
 * Runs on the Raspberry Pi alongside azimuth_station.py. Manages:
 *   - Heartbeats (PoA)
 *   - PoRx proof submission + peer verification on reception
 *   - On-chain state polling + the PoA epoch crank
 *   - Image merge (primary station)
 *   - State file for the Pygame dashboard
 */

import { address, REGISTRY_ID, PACKAGE_ID } from "./config.js";
import { getStation } from "./sui.js";
import { startHeartbeatLoop, stopHeartbeatLoop, getStatus as hbStatus } from "./heartbeat.js";
import { watchForReceptions } from "./proofSubmitter.js";
import { startTracking, stopTracking } from "./eventTracker.js";
import { updateState, startFlushing, stopFlushing, flush } from "./stateWriter.js";
import { startMerger, stopMerger } from "./imageMerger.js";

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║         AZIMUTH SUI CLIENT v1.0          ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Station:  ${address}`);
  console.log(`Package:  ${PACKAGE_ID}`);
  console.log(`Registry: ${REGISTRY_ID}\n`);

  const station = await getStation(address);
  if (!station || !station.registered) {
    console.error("ERROR: Station not registered. Run move/scripts/register_stations first.");
    process.exit(1);
  }
  console.log(`Registered: ${station.location} | active: ${station.active}\n`);

  startHeartbeatLoop();

  startTracking(undefined, (state) => {
    updateState("station", state.station);
    updateState("poa", state.poa);
    updateState("porx", state.porx);
    updateState("heartbeat", hbStatus());

    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, (state.poa?.nextSettlement ?? now) - now);
    const m = Math.floor(remaining / 60), s = remaining % 60;
    process.stdout.write(
      `\r[STATUS] Epoch #${state.poa?.epoch ?? 0} | Next: ${m}m${s}s | HB: ${state.station?.heartbeatCount ?? 0} | PoA: ${state.station?.totalPoaRewards ?? 0} | PoRx: ${state.station?.totalPorxRewards ?? 0}   `
    );
  });

  watchForReceptions((result) => console.log(`\n[PORX] result:`, result));
  startMerger();
  startFlushing(2000);

  updateState("heartbeat", hbStatus());
  flush();
  console.log("\n[READY] All systems running. Ctrl+C to stop.\n");

  process.on("SIGINT", () => {
    console.log("\n\n[SHUTDOWN] Stopping...");
    stopHeartbeatLoop();
    stopTracking();
    stopMerger();
    stopFlushing();
    flush();
    console.log("[SHUTDOWN] Done.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
