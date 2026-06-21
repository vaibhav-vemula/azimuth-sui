/**
 * walrus.js — Walrus blob storage via the testnet HTTP publisher/aggregator.
 *
 * The publisher performs the on-chain registration + certification and returns the
 * `blobObject` (its Sui object id + certified epoch), so we still anchor real on-chain
 * availability — without depending on the Walrus SDK (which is tied to a specific
 * @mysten/sui major). Returns `{ blobId, blobObjectId, certifiedEpoch }`.
 */

import { WALRUS_EPOCHS } from "./config.js";

const PUBLISHER = process.env.WALRUS_PUBLISHER || "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = process.env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space";

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(data);
}

/** Upload bytes. Returns { blobId, blobObjectId, certifiedEpoch }. */
export async function uploadToWalrus(data, { epochs = WALRUS_EPOCHS, deletable = false } = {}) {
  const body = toBuffer(data);
  const url = `${PUBLISHER}/v1/blobs?epochs=${epochs}${deletable ? "&deletable=true" : ""}`;
  const res = await fetch(url, { method: "PUT", body });
  if (!res.ok) throw new Error(`Walrus upload failed ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();

  const created = json.newlyCreated?.blobObject;
  const certified = json.alreadyCertified;
  const blobId = created?.blobId ?? certified?.blobId;
  if (!blobId) throw new Error(`Walrus upload: no blobId in ${JSON.stringify(json)}`);
  const blobObjectId = created?.id ?? certified?.blobObjectId ?? null;
  const certifiedEpoch = created?.certifiedEpoch ?? created?.storage?.endEpoch ?? certified?.endEpoch ?? 0;

  console.log(`[WALRUS] Uploaded ${body.length} bytes → blob ${blobId} (obj ${blobObjectId ?? "?"})`);
  return { blobId, blobObjectId, certifiedEpoch };
}

/** Download a blob by id. Returns a Buffer. */
export async function downloadFromWalrus(blobId) {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus download failed ${res.status} for ${blobId}`);
  return Buffer.from(await res.arrayBuffer());
}

export function blobUrl(blobId) {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

/** Extending storage over HTTP isn't supported; use the Walrus CLI (`walrus extend`). */
export async function renewBlob() {
  throw new Error("renewBlob: extend storage via the Walrus CLI (`walrus extend <blobId>`)");
}
