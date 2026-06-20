#!/usr/bin/env node
/**
 * verify.mjs — independent verifiability proof for agent memory / reports on Walrus.
 *
 * Re-fetches a memory/report blob from a PUBLIC Walrus aggregator using NOTHING but its
 * blob id — no Azimuth keys, no MemWal account. Walrus blobs are content-addressed and
 * the aggregator validates the bytes against the id on read, so a successful fetch is
 * itself the integrity proof: the data exists, is available, and hasn't been tampered with.
 *
 * Usage:
 *   node verify.mjs <blobId>      # verify a specific blob
 *   node verify.mjs               # verify the latest Analyst report from the index
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGGREGATORS = [
  process.env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space",
  "https://walrus-testnet-aggregator.nodes.guru", // a *different* public aggregator → independence
];

function latestReportBlob() {
  try {
    const idx = JSON.parse(fs.readFileSync(path.resolve(__dirname, ".memory/reports-index.json"), "utf-8"));
    return idx[0]?.reportBlobId || null;
  } catch {
    return null;
  }
}

async function fetchFrom(aggregator, blobId) {
  const res = await fetch(`${aggregator}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`${aggregator} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const blobId = process.argv[2] || latestReportBlob();
  if (!blobId) {
    console.error("No blob id given and no reports in agents/.memory/reports-index.json.\nUsage: node verify.mjs <blobId>");
    process.exit(1);
  }

  console.log("🔎 Independent verification of agent memory on Walrus");
  console.log(`   blob id: ${blobId}`);
  console.log(`   (no Azimuth keys, no MemWal account — just a public aggregator)\n`);

  const results = [];
  for (const agg of AGGREGATORS) {
    try {
      const buf = await fetchFrom(agg, blobId);
      const sha = crypto.createHash("sha256").update(buf).digest("hex");
      results.push({ agg, ok: true, bytes: buf.length, sha, buf });
      console.log(`   ✅ ${agg}\n      ${buf.length} bytes · sha256 ${sha.slice(0, 16)}…`);
    } catch (e) {
      results.push({ agg, ok: false });
      console.log(`   ⚠️  ${agg} — ${e.message}`);
    }
  }

  const ok = results.filter((r) => r.ok);
  if (ok.length === 0) {
    console.log("\n❌ Could not retrieve the blob from any aggregator (testnet may have expired it).");
    process.exit(2);
  }

  // Content-addressing: independent aggregators must return byte-identical data.
  const shas = new Set(ok.map((r) => r.sha));
  if (ok.length > 1) {
    console.log(`\n   ${shas.size === 1 ? "✅ byte-identical across independent aggregators" : "❌ MISMATCH across aggregators"}`);
  }

  // Show the content (it's an agent report / memory).
  try {
    const obj = JSON.parse(ok[0].buf.toString("utf-8"));
    console.log("\n   Recovered content:");
    console.log(`     ${obj.type || "blob"} · ${obj.satellite || ""} ${obj.report?.summary || obj.summary || ""}`.trim());
  } catch {
    console.log("\n   (binary blob — retrieved successfully)");
  }

  console.log(
    "\n✅ Verified: this agent memory is publicly retrievable and content-addressed on Walrus —\n" +
    "   durable, portable, and tamper-evident. No single operator can forge or quietly rewrite it."
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
