/**
 * imageMerger.js — Primary station: merge packets from all stations and anchor
 * the reconstructed image to Walrus + Sui.
 *
 * Flow (IS_PRIMARY only):
 *   1. Poll `PoRxSubmitted` events (replaces Hedera HCS polling)
 *   2. When ≥2 stations posted for the same passId, download each station's
 *      packet JSON from Walrus (by blob id from the event)
 *   3. Merge packet sets (union by index), reconstruct the JPEG
 *   4. Upload the merged JPEG to Walrus (on-chain Blob + certificate)
 *   5. Call `orbital_vault::record_image` to anchor it
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IS_PRIMARY, POLL_INTERVAL, WALRUS_EPOCHS } from "./config.js";
import { uploadToWalrus, downloadFromWalrus } from "./walrus.js";
import { queryEvents, callRecordImage, bytesToHex } from "./sui.js";
import { acquireLock, releaseLock } from "./lock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MERGER_STATE_FILE = path.resolve(__dirname, "merger_state.json");

function loadState() {
  try {
    const p = JSON.parse(fs.readFileSync(MERGER_STATE_FILE, "utf-8"));
    return { mergedPasses: new Set(p.mergedPasses || []), cursor: p.cursor || null };
  } catch {
    return { mergedPasses: new Set(), cursor: null };
  }
}

let { mergedPasses, cursor } = loadState();
const passAnnouncements = {}; // passId -> [{ station, walrusBlobId }]
let pollTimer = null;

function saveState() {
  try {
    const tmp = MERGER_STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ mergedPasses: [...mergedPasses], cursor }, null, 2));
    fs.renameSync(tmp, MERGER_STATE_FILE);
  } catch (err) {
    console.error(`[MERGE] state save failed: ${err.message}`);
  }
}

/** Union packet maps by index — first-seen value wins. */
function mergePackets(...maps) {
  const merged = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) if (!(k in merged)) merged[k] = v;
  return merged;
}

/** Reconstruct a JPEG buffer; zero-fill missing packets with average size. */
function reconstructJpeg(packets, totalPackets) {
  const chunks = [];
  let avg = 0, n = 0;
  for (const b64 of Object.values(packets)) { avg += Buffer.from(b64, "base64").length; n++; }
  if (n > 0) avg = Math.floor(avg / n);
  for (let i = 0; i < totalPackets; i++) {
    const b64 = packets[String(i)];
    chunks.push(b64 ? Buffer.from(b64, "base64") : Buffer.alloc(avg, 0));
  }
  return Buffer.concat(chunks);
}

async function tryMerge(passId) {
  const entries = passAnnouncements[passId];
  if (!entries || entries.length < 2 || mergedPasses.has(passId)) return;
  mergedPasses.add(passId);
  console.log(`\n[MERGE] Merging ${entries.length} stations for pass ${passId.slice(0, 10)}…`);

  try {
    const maps = [];
    let totalPackets = 0;
    for (const e of entries) {
      console.log(`[MERGE]   download ${e.walrusBlobId} (${e.station.slice(0, 10)}…)`);
      const buf = await downloadFromWalrus(e.walrusBlobId);
      const json = JSON.parse(buf.toString("utf-8"));
      maps.push(json.packets || {});
      totalPackets = Math.max(totalPackets, json.totalPackets || 0);
    }
    const merged = mergePackets(...maps);
    const recovered = Object.keys(merged).length;
    console.log(`[MERGE] Recovered ${recovered}/${totalPackets} packets`);

    const jpeg = reconstructJpeg(merged, totalPackets);
    // Per-pass marker after JPEG EOI → unique content-addressed blob id each pass.
    const upload = Buffer.concat([jpeg, Buffer.from(`\n<!--azimuth:${passId}:${Date.now()}-->`)]);

    const highValue = totalPackets > 0 && recovered / totalPackets >= 0.95;
    await acquireLock();
    let blob;
    try {
      blob = await uploadToWalrus(upload, { epochs: WALRUS_EPOCHS, deletable: highValue });
      console.log(`[MERGE] Merged image → blob ${blob.blobId} (obj ${blob.blobObjectId ?? "?"})`);
      await callRecordImage({
        passId,
        walrusBlobId: blob.blobId,
        blobObjectId: blob.blobObjectId,
        certifiedEpoch: blob.certifiedEpoch,
        recovered,
        total: totalPackets,
        highValue,
      });
      console.log(`[MERGE] Recorded on-chain ✓`);
    } finally {
      releaseLock();
    }
    saveState();
  } catch (err) {
    console.error(`[MERGE] Failed: ${err.message}`);
    mergedPasses.delete(passId); // allow retry
  }
}

function handleEvent(j) {
  const passId = bytesToHex(j.pass_id);
  const station = j.station;
  const walrusBlobId = j.walrus_blob_id;
  if (!passId || !walrusBlobId) return;
  if (!passAnnouncements[passId]) passAnnouncements[passId] = [];
  if (passAnnouncements[passId].some((e) => e.station === station)) return;
  passAnnouncements[passId].push({ station, walrusBlobId });
  console.log(`[MERGE] ${station.slice(0, 10)}… announced pass ${passId.slice(0, 10)}… (${passAnnouncements[passId].length})`);
  tryMerge(passId).catch((e) => console.error("[MERGE]", e.message));
}

export function startMerger() {
  if (!IS_PRIMARY) {
    console.log("[MERGE] Not primary — merger disabled");
    return;
  }
  console.log("[MERGE] Primary station — merger started");
  const poll = async () => {
    try {
      const { data, nextCursor, hasNextPage } = await queryEvents("PoRxSubmitted", cursor, 50);
      for (const ev of data) if (ev.parsedJson) handleEvent(ev.parsedJson);
      if (nextCursor) { cursor = nextCursor; saveState(); }
      if (hasNextPage) poll();
    } catch (err) {
      console.error(`[MERGE] poll failed: ${err.message}`);
    }
  };
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL);
}

export function stopMerger() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
