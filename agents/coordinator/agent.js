/**
 * Coordinator Agent — the multi-agent coordination layer.
 *
 * For a pass that multiple stations could see, it reads each station's SHARED skill profile
 * (written by the Operator Agents to the common Walrus/MemWal namespace) and negotiates a
 * coverage plan — delegating roles (which station covers AOS vs LOS) to maximize the combined
 * packet recovery the image merger will achieve. This is the track's "negotiation / task
 * delegation across agents" requirement, using shared, durable memory.
 */

import { z } from "zod";
import { generateObject } from "ai";
import { hasLLM, reasoningModel } from "../shared/llm.js";

const PlanSchema = z.object({
  assignments: z.array(
    z.object({
      stationId: z.string(),
      role: z.enum(["AOS", "LOS", "FULL", "STANDBY"]),
      reason: z.string(),
    })
  ),
  rationale: z.string(),
});

/** Build per-station profiles for a satellite from pre-recalled shared-memory hits (no I/O). */
function gatherProfiles(profileHits, satellite, stationIds) {
  return stationIds.map((stationId) => {
    const sh = (profileHits || []).filter(
      (h) => h.metadata?.stationId === stationId &&
        (!h.metadata?.satellite || h.metadata.satellite === satellite)
    );
    const ratios = sh.map((h) => h.metadata?.recoveredRatio).filter((r) => typeof r === "number");
    const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
    return { stationId, avgRecovery: avg, samples: ratios.length, notes: sh.map((h) => h.text) };
  });
}

/** One recall of all station skill profiles (call once per coordinator run, reuse per pass). */
export async function loadProfileHits(shared) {
  return shared.recall("skill profile station satellite recovery", 50);
}

export async function planCoverage({ pass, stationIds, profileHits }) {
  const profiles = gatherProfiles(profileHits, pass.satellite, stationIds);

  if (hasLLM) {
    const prompt = [
      `You are the network coordinator for the Azimuth ground-station network.`,
      `A ${pass.satellite} pass (maxElev ${pass.maxElevation}°, ~${Math.round(pass.durationSec / 60)} min) is coming up.`,
      `Assign each station a role to MAXIMIZE combined packet recovery and avoid redundant capture.`,
      `Roles: AOS (cover acquisition-of-signal half), LOS (cover loss-of-signal half), FULL, or STANDBY.`,
      `Prefer splitting a strong pass between the two best stations; use FULL only if one station dominates.`,
      ``,
      `Station skill profiles (recalled from shared verifiable memory):`,
      ...profiles.map(
        (p) =>
          `- ${p.stationId}: avgRecovery ${p.avgRecovery == null ? "unknown" : Math.round(p.avgRecovery * 100) + "%"} (${p.samples} samples)`
      ),
    ].join("\n");

    try {
      const { object } = await generateObject({ model: reasoningModel(), schema: PlanSchema, prompt });
      return { ...object, profiles, usedLLM: true };
    } catch (err) {
      console.warn(`[coordinator] LLM planning failed (${err.message}) → heuristic`);
    }
  }

  // Heuristic: rank by avgRecovery (unknown treated as 0.5), split between top two.
  const ranked = [...profiles].sort(
    (a, b) => (b.avgRecovery ?? 0.5) - (a.avgRecovery ?? 0.5)
  );
  const assignments = ranked.map((p, i) => ({
    stationId: p.stationId,
    role: i === 0 ? "AOS" : i === 1 ? "LOS" : "STANDBY",
    reason:
      p.avgRecovery == null
        ? "no history — assigned by default ordering"
        : `avgRecovery ${Math.round(p.avgRecovery * 100)}% over ${p.samples} samples`,
  }));
  return {
    assignments,
    rationale: `Split the pass between the two highest-recovery stations; others standby.`,
    profiles,
    usedLLM: false,
  };
}

/** Publish the coverage plan to shared memory so Operator Agents can consume it. */
export async function publishPlan(shared, pass, plan) {
  const text =
    `Coverage plan for ${pass.id}: ` +
    plan.assignments.map((a) => `${a.stationId}=${a.role}`).join(", ") +
    `. ${plan.rationale}`;
  await shared.remember(text, {
    type: "coverage-plan",
    passId: pass.id,
    satellite: pass.satellite,
    assignments: plan.assignments,
  });
  return text;
}
