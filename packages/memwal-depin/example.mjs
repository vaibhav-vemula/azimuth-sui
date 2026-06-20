/**
 * Runnable example (no credentials): uses a trivial in-memory backend to show the adapter.
 *   node example.mjs
 * Swap `mem` for `await memwalBackend({...})` to persist on real Walrus memory.
 */
import { createSensorRecorder, observationText } from "./index.js";

// Minimal backend implementing the { remember, recall } contract.
const store = [];
const mem = {
  backend: "demo",
  async remember(text, metadata = {}) { store.push({ text, metadata }); return { ok: true }; },
  async recall(query, k = 5) {
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
    return store
      .map((e) => ({ ...e, score: terms.reduce((s, t) => (e.text.toLowerCase().includes(t) ? s + 1 : s), 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  },
};

const sensors = createSensorRecorder(mem, { source: "demo-net" });

await sensors.record({ sensorId: "node-42", type: "air-quality", value: 38, unit: "AQI", geo: { lat: 40.71, lon: -74.0 }, note: "evening spike near highway" });
await sensors.record({ sensorId: "node-7", type: "air-quality", value: 12, unit: "AQI", note: "clean morning" });

console.log("canonical text:", observationText({ sensorId: "node-42", type: "air-quality", value: 38, unit: "AQI" }));
console.log("\nrecall 'air quality spikes':");
for (const h of await sensors.recall("air quality spikes near highway")) {
  console.log(`  - ${h.text}  [sensor=${h.metadata.sensorId}, value=${h.metadata.value}]`);
}
