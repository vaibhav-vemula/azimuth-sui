/**
 * proofSubmitter.js — Submit PoRx proofs and cross-verify peers.
 *
 * Watches ground_station/reception_event.json (written by azimuth_station.py —
 * unchanged), uploads this station's packets to Walrus, submits a PoRx proof
 * referencing the blob, and verifies other stations' proofs so they get paid.
 */

import fs from "node:fs";
import crypto from "node:crypto";
import { EVENT_FILE, address, WALRUS_EPOCHS } from "./config.js";
import { uploadToWalrus } from "./walrus.js";
import { uploadPacketsAsQuilt } from "./quilt.js";
import { encryptForPass } from "./seal.js";
import {
  callSubmitPorx,
  callVerifyPorx,
  queryEvents,
  getProofFlags,
  bytesToHex,
} from "./sui.js";
import { acquireLock, releaseLock } from "./lock.js";

let lastProcessedPass = null;

/** Merkle-ish root: sha256 over the concatenation of packet hash bytes. */
function computePacketMerkle(packetHashes) {
  if (!packetHashes || packetHashes.length === 0) return Buffer.alloc(32, 0);
  const concat = Buffer.concat(
    packetHashes.map((h) => Buffer.from(h.startsWith("0x") ? h.slice(2) : h, "hex"))
  );
  return crypto.createHash("sha256").update(concat).digest();
}

async function submitProof(data) {
  const { passId, packetCount, totalPackets, packetHashes, packetBytes, avgRssi, avgSnr } = data;
  const merkle = computePacketMerkle(packetHashes);

  console.log(`[PORX] Pass ${passId.slice(0, 10)}… ${packetCount}/${totalPackets} packets, RSSI ${avgRssi}, SNR ${avgSnr}`);

  try {
    await acquireLock();

    // 1. Store this station's packet payload on Walrus (single JSON blob — the
    //    merger downloads this to reconstruct the image).
    const payload = { passId, station: address, packetCount, totalPackets, avgRssi, avgSnr, packets: packetBytes };
    const { blobId } = await uploadToWalrus(Buffer.from(JSON.stringify(payload)), { epochs: WALRUS_EPOCHS });
    console.log(`[PORX] Packets stored on Walrus → ${blobId}`);

    // 2. Submit the proof on-chain (emits PoRxSubmitted with the blob id).
    const res = await callSubmitPorx({
      passId,
      packetCount,
      totalPackets,
      merkleBytes: merkle,
      avgRssi,
      avgSnr,
      walrusBlobId: blobId,
    });
    console.log(`[PORX] Proof submitted — ${res.digest}`);
    return { success: true, digest: res.digest, blobId };
  } catch (err) {
    console.error(`[PORX] Failed: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    releaseLock();
  }
}

/** Advanced-Walrus showcase: also batch the packets into a Quilt, and Seal-encrypt
 *  a premium copy. Non-fatal — failures here never block PoRx. */
async function storeAdvanced(data) {
  const { passId, packetBytes } = data;
  try {
    await acquireLock();
    await uploadPacketsAsQuilt(passId, packetBytes);
  } catch (err) {
    console.warn(`[QUILT] skipped: ${err.message}`);
  } finally {
    releaseLock();
  }
  try {
    const raw = Buffer.from(JSON.stringify({ passId, packets: packetBytes }));
    const encrypted = await encryptForPass(passId, raw);
    await acquireLock();
    const { blobId } = await uploadToWalrus(encrypted, { epochs: WALRUS_EPOCHS, deletable: true });
    console.log(`[SEAL] Premium (encrypted) copy stored → ${blobId}`);
  } catch (err) {
    console.warn(`[SEAL] skipped: ${err.message}`);
  } finally {
    releaseLock();
  }
}

/** Verify peers' unverified proofs so they get paid. Driven by PoRxSubmitted events. */
let porxCursor = null;
async function checkAndVerifyPeers() {
  try {
    const { data, nextCursor } = await queryEvents("PoRxSubmitted", porxCursor, 50);
    if (nextCursor) porxCursor = nextCursor;
    for (const ev of data) {
      const j = ev.parsedJson;
      if (!j || j.station === address) continue;
      const proofId = j.proof_id;
      const flags = await getProofFlags(proofId);
      if (flags && !flags.verified) {
        try {
          await acquireLock();
          console.log(`[PORX] Verifying peer proof ${proofId.slice(0, 10)}… (station ${j.station.slice(0, 10)}…)`);
          await callVerifyPorx(proofId);
        } catch (err) {
          console.warn(`[PORX] verify failed: ${err.message}`);
        } finally {
          releaseLock();
        }
      }
    }
  } catch {
    // retry next tick
  }
}

export function watchForReceptions(callback) {
  console.log(`[PORX] Watching ${EVENT_FILE}`);
  let processing = false;

  setInterval(async () => {
    if (processing) return;
    try {
      if (!fs.existsSync(EVENT_FILE)) return;
      const data = JSON.parse(fs.readFileSync(EVENT_FILE, "utf-8"));
      if (data.passId === lastProcessedPass) return;

      processing = true;
      console.log(`[PORX] New reception event detected!`);
      lastProcessedPass = data.passId;
      try { fs.unlinkSync(EVENT_FILE); } catch {}

      const result = await submitProof(data);
      if (callback) callback(result);
      storeAdvanced(data).catch((e) => console.warn(`[ADV] ${e.message}`));
    } catch {
      // file may be mid-write
    } finally {
      processing = false;
    }
  }, 5000);

  setInterval(checkAndVerifyPeers, 30_000);
}

export { computePacketMerkle };
