/**
 * Operator Agent — one per ground station. The "long-term memory" agent.
 *
 * Before each planning cycle it RECALLs how past passes for each satellite actually went
 * (stored across sessions on Walrus/MemWal), decides which upcoming passes to attempt, acts,
 * then REMEMBERs the outcome so the next cycle is better-informed. This is the track's core
 * idea: an agent that becomes more useful because it remembers and builds over time.
 */

import { z } from "zod";
import { generateObject } from "ai";
import { createSensorRecorder } from "@azimuth/memwal-depin";
import { hasLLM, fastModel } from "../shared/llm.js";

const DecisionSchema = z.object({
  decisions: z.array(
    z.object({
      passId: z.string(),
      attempt: z.boolean(),
      priority: z.number().min(0).max(10),
      reason: z.string(),
    })
  ),
});

/** ONE recall per cycle → group this station's history by satellite (minimizes relayer calls). */
async function recallBySatellite(memory) {
  const hits = await memory.recall("satellite reception outcome elevation snr packets recovery", 24);
  const bySat = {};
  for (const h of hits) {
    const sat = h.metadata?.satellite || "unknown";
    (bySat[sat] ||= []).push(h);
  }
  return bySat;
}

/** Compact per-satellite history block for the LLM prompt. */
function historyBlocks(bySat, passes) {
  const sats = [...new Set(passes.map((p) => p.satellite))];
  const blocks = [];
  for (const sat of sats) {
    const hits = bySat[sat] || [];
    if (hits.length) blocks.push(`${sat}:\n` + hits.slice(0, 4).map((h) => `  - ${h.text}`).join("\n"));
  }
  return blocks.join("\n") || "(no prior reception history yet)";
}

/** Average recovered-packet ratio recalled for a satellite (for the heuristic path). */
function historyBonus(hits) {
  const ratios = (hits || [])
    .map((h) => h.metadata?.recoveredRatio)
    .filter((r) => typeof r === "number");
  if (!ratios.length) return 0;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length; // 0..1
}

export async function planPasses({ stationId, memory, passes }) {
  const bySat = await recallBySatellite(memory);   // single recall, reused below
  const history = historyBlocks(bySat, passes);

  if (hasLLM) {
    const prompt = [
      `You are the autonomous operator agent for ground station "${stationId}".`,
      `Decide which upcoming satellite passes to attempt to maximize useful image recovery,`,
      `given limited time (passes can overlap) and your RECALLED history of past results.`,
      ``,
      `Recalled history (from verifiable memory on Walrus):`,
      history,
      ``,
      `Upcoming passes:`,
      ...passes.map(
        (p) =>
          `- ${p.id} | sat ${p.satellite} | maxElev ${p.maxElevation}° | localHour ${p.localHour} | priorSNR ${p.predictedSnrPrior}`
      ),
      ``,
      `Return a decision per pass: attempt (bool), priority 0-10, and a short reason that`,
      `references the history when relevant.`,
    ].join("\n");

    try {
      const { object } = await generateObject({ model: fastModel(), schema: DecisionSchema, prompt });
      return { plan: object.decisions, usedLLM: true };
    } catch (err) {
      console.warn(`[operator] LLM planning failed (${err.message}) → heuristic`);
    }
  }

  // Heuristic fallback: prior SNR + recalled historical success (reuses the single recall).
  const plan = [];
  for (const p of passes) {
    const hits = bySat[p.satellite] || [];
    const bonus = historyBonus(hits); // 0..1
    const priority = Math.min(10, Math.round((p.predictedSnrPrior / 10) * 6 + bonus * 4));
    plan.push({
      passId: p.id,
      attempt: priority >= 4,
      priority,
      reason: `priorSNR ${p.predictedSnrPrior}, elev ${p.maxElevation}°` +
        (hits.length ? `, history success ~${Math.round(bonus * 100)}%` : ", no history"),
    });
  }
  return { plan, usedLLM: false };
}

/** Deterministic stand-in for a real reception (so the loop closes without hardware). */
export function simulateOutcome(pass) {
  // Higher elevation → more packets recovered, with mild deterministic noise.
  const base = pass.maxElevation / 90;
  const noise = ((pass.aosMs % 17) / 17 - 0.5) * 0.2;
  const ratio = Math.max(0, Math.min(1, base + noise));
  const totalPackets = 120;
  const packetsRecovered = Math.round(ratio * totalPackets);
  const snr = Math.round((6 + ratio * 9) * 10) / 10;
  return { packetsRecovered, totalPackets, recoveredRatio: Math.round(ratio * 100) / 100, snr };
}

/** Persist a pass outcome to personal memory and refresh the shared station skill profile. */
export async function recordOutcome({ memory, shared, stationId, pass, outcome }) {
  // Record via the reusable DePIN→Walrus-memory adapter (the station is the sensor).
  const recorder = createSensorRecorder(memory, { source: "azimuth-ground-station" });
  const text =
    `Station ${stationId} received ${pass.satellite} at ${pass.maxElevation}° elevation ` +
    `(localHour ${pass.localHour}): recovered ${outcome.packetsRecovered}/${outcome.totalPackets} ` +
    `packets (${Math.round(outcome.recoveredRatio * 100)}%), SNR ${outcome.snr}.`;
  await recorder.record({
    sensorId: stationId,
    type: "satellite-reception",
    value: Math.round(outcome.recoveredRatio * 100),
    unit: "% packets",
    satellite: pass.satellite,
    maxElevation: pass.maxElevation,
    localHour: pass.localHour,
    recoveredRatio: outcome.recoveredRatio,
    snr: outcome.snr,
    note: text,
  });

  if (shared) {
    await shared.remember(
      `Skill profile — station ${stationId} on ${pass.satellite}: ~${Math.round(
        outcome.recoveredRatio * 100
      )}% recovery near ${pass.maxElevation}° elevation.`,
      { type: "skill-profile", stationId, satellite: pass.satellite, recoveredRatio: outcome.recoveredRatio }
    );
  }
  return text;
}
