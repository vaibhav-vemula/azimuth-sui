/**
 * passes.js — upcoming satellite pass predictor.
 *
 * A lightweight, deterministic predictor so agents have real-shaped decisions to make.
 * Swap `predictUpcomingPasses` for an SGP4/TLE implementation for production; the rest of
 * the agent system is unaffected.
 */

const SATELLITES = [
  { name: "NOAA-19", band: "APT", freqMHz: 137.1 },
  { name: "NOAA-18", band: "APT", freqMHz: 137.9125 },
  { name: "NOAA-15", band: "APT", freqMHz: 137.62 },
  { name: "METEOR-M2-3", band: "LRPT", freqMHz: 137.9 },
  { name: "ISS", band: "SSTV", freqMHz: 145.8 },
];

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seeded(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Returns the next `count` passes visible to `stationId`, each with a max elevation,
 * AOS time, duration, and a coarse predicted-SNR prior (the agent refines this with memory).
 */
export function predictUpcomingPasses(stationId, count = 5, fromMs = Date.now()) {
  const passes = [];
  for (let i = 0; i < count; i++) {
    const sat = SATELLITES[i % SATELLITES.length];
    const r1 = seeded(`${stationId}:${sat.name}:${i}:elev`);
    const r2 = seeded(`${stationId}:${sat.name}:${i}:time`);
    const r3 = seeded(`${stationId}:${sat.name}:${i}:dur`);
    const maxElevation = Math.round(15 + r1 * 75); // 15–90°
    const aosMs = fromMs + Math.round((20 + r2 * 600) * 60 * 1000); // 20min–10h out
    const durationSec = Math.round(360 + r3 * 540); // 6–15 min
    passes.push({
      id: `${sat.name}-${new Date(aosMs).toISOString().slice(0, 16)}`,
      satellite: sat.name,
      band: sat.band,
      freqMHz: sat.freqMHz,
      maxElevation,
      aos: new Date(aosMs).toISOString(),
      aosMs,
      durationSec,
      localHour: new Date(aosMs).getHours(),
      // Coarse prior: higher elevation → better expected SNR.
      predictedSnrPrior: Math.round((maxElevation / 90) * 100) / 10,
    });
  }
  return passes.sort((a, b) => a.aosMs - b.aosMs);
}
