/**
 * Analyst Agent runner.
 *
 * If Sui is configured: polls ImageMerged events, downloads each new merged image from Walrus,
 * analyzes it, and stores a report artifact. Otherwise runs a demo on a synthetic image so the
 * artifact-driven loop is observable without a live network.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemory } from "../shared/memory.js";
import { chainReady, queryEvents, bytesToHex } from "../shared/chain.js";
import { downloadBlob } from "../shared/walrus.js";
import { analyzeImage, storeReport } from "./agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEN_FILE = path.resolve(__dirname, "../.memory/analyst-seen.json");

function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8"))); } catch { return new Set(); }
}
function saveSeen(set) {
  fs.mkdirSync(path.dirname(SEEN_FILE), { recursive: true });
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...set]));
}

export async function runAnalystCycle() {
  const memory = await createMemory(process.env.MEMWAL_NAMESPACE || "azimuth-net");
  console.log(`\n🛰️  Analyst Agent — memory backend: ${memory.backend}`);

  if (!chainReady) {
    console.log("   chain not configured → demo on a synthetic image");
    const imageBytes = Buffer.from(Array.from({ length: 8192 }, (_, i) => (i * 37) % 256));
    const pass = { id: `DEMO-${Date.now()}`, satellite: "NOAA-19" };
    const { report, usedLLM } = await analyzeImage({ imageBytes, pass, memory });
    const stored = await storeReport({ memory, report, pass, imageBlobId: null });
    console.log(`   ${usedLLM ? "LLM" : "heuristic"} report: ${report.summary}`);
    if (stored.url) console.log(`   report artifact → ${stored.url}`);
    return;
  }

  const seen = loadSeen();
  const { data } = await queryEvents("ImageMerged", { limit: 25 });
  let processed = 0;
  for (const ev of data.reverse()) {
    const j = ev.parsedJson || {};
    const passId = j.pass_id ? bytesToHex(j.pass_id) : ev.id?.txDigest;
    if (!j.walrus_blob_id || seen.has(passId)) continue;

    console.log(`   analyzing merged image for pass ${String(passId).slice(0, 12)}… (blob ${j.walrus_blob_id})`);
    try {
      const imageBytes = await downloadBlob(j.walrus_blob_id);
      const pass = { id: passId, satellite: j.satellite || "unknown" };
      const { report, usedLLM } = await analyzeImage({ imageBytes, pass, memory });
      const stored = await storeReport({ memory, report, pass, imageBlobId: j.walrus_blob_id });
      console.log(`   ${usedLLM ? "LLM" : "heuristic"}: ${report.summary}`);
      if (stored.url) console.log(`   report artifact → ${stored.url}`);
      seen.add(passId);
      processed++;
    } catch (err) {
      console.warn(`   failed: ${err.message}`);
    }
  }
  saveSeen(seen);
  if (processed === 0) console.log("   no new merged images.");
}

/**
 * Continuous watch: poll for new merged images and analyze them automatically.
 * This is what makes the Analyst part of the live loop instead of a manual step.
 */
export async function runAnalystWatch({ intervalMs = 30000 } = {}) {
  console.log(`\n👁  Analyst watch — polling every ${intervalMs / 1000}s (Ctrl+C to stop)`);
  let stop = false;
  process.on("SIGINT", () => { stop = true; console.log("\n[analyst] stopping…"); process.exit(0); });
  // eslint-disable-next-line no-constant-condition
  while (!stop) {
    try { await runAnalystCycle(); } catch (e) { console.error(`[analyst] ${e.message}`); }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const watch = process.argv.includes("--watch");
  (watch ? runAnalystWatch() : runAnalystCycle()).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
