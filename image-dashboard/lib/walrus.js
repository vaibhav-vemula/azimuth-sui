/**
 * walrus.js — Fetch merged satellite images from Sui + Walrus.
 *
 * Replaces arweave.js (which scanned Hedera HCS for "merged-image" messages).
 * We now read `orbital_vault::ImageMerged` events from Sui: each carries the
 * Walrus blob id + the on-chain ImageCapture object that holds the availability
 * certificate. Images are fetched from the Walrus aggregator (proxied for inline
 * display), and we link to the capture object as visible proof of availability.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID;
const MOD = `${PACKAGE_ID}::orbital_vault`;
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const SUIVISION_OBJ = "https://testnet.suivision.xyz/object";

let _client = null;
function client() {
  if (!_client) _client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  return _client;
}

function bytesToHex(bytes) {
  if (typeof bytes === "string") return bytes.startsWith("0x") ? bytes : "0x" + bytes;
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchImages() {
  if (!PACKAGE_ID || PACKAGE_ID.startsWith("0x...")) return [];
  try {
    const res = await client().queryEvents({
      query: { MoveEventType: `${MOD}::ImageMerged` },
      order: "descending",
      limit: 100,
    });

    return res.data.map((ev) => {
      const j = ev.parsedJson || {};
      const walrusBlobId = j.walrus_blob_id;
      const captureId = j.capture_id;
      const recovered = j.recovered != null ? Number(j.recovered) : null;
      const total = j.total != null ? Number(j.total) : null;
      return {
        blobId: walrusBlobId,
        walrusBlobId,
        captureId,
        captureUrl: captureId ? `${SUIVISION_OBJ}/${captureId}` : null,
        storageProvider: "walrus",
        imageUrl: `/api/blob/${walrusBlobId}`,
        walrusUrl: `${WALRUS_AGGREGATOR}/v1/blobs/${walrusBlobId}`,
        passId: j.pass_id ? bytesToHex(j.pass_id) : null,
        recovered,
        total,
        completeness: recovered && total ? Math.round((recovered / total) * 100) : null,
        stations: j.submitter ? [j.submitter] : [],
        timestamp: ev.timestampMs ? new Date(Number(ev.timestampMs)) : new Date(),
        digest: ev.id?.txDigest || null,
      };
    });
  } catch {
    return [];
  }
}
