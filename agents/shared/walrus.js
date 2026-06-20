/**
 * walrus.js — store agent artifacts (analysis reports) on Walrus and read images back.
 *
 * Uses the Walrus testnet HTTP publisher/aggregator for the agent layer (no signer needed
 * for report artifacts). The core station pipeline uses the Walrus SDK (on-chain Blob
 * objects + certificates); reports here are lighter-weight derived artifacts.
 */

import "./env.js";

const PUBLISHER = process.env.WALRUS_PUBLISHER || "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = process.env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space";

/** Upload a JSON-serializable artifact. Returns { blobId, url }. */
export async function uploadArtifact(obj, epochs = 5) {
  const body = Buffer.from(JSON.stringify(obj));
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Walrus upload failed ${res.status}`);
  const json = await res.json();
  const blobId = json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
  if (!blobId) throw new Error(`Walrus upload: no blobId in ${JSON.stringify(json)}`);
  return { blobId, url: `${AGGREGATOR}/v1/blobs/${blobId}` };
}

/** Download a blob (e.g. a merged image) by id. Returns a Buffer. */
export async function downloadBlob(blobId) {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus download failed ${res.status} for ${blobId}`);
  return Buffer.from(await res.arrayBuffer());
}

export function blobUrl(blobId) {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}
