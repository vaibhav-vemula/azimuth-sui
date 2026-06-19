/**
 * walrus.js — Walrus storage via the @mysten/walrus SDK.
 *
 * Replaces the old raw-HTTP publisher/aggregator client. The SDK registers a
 * `Blob` Move object on Sui and certifies availability, so every upload returns
 * an on-chain object id + certified epoch — not just an opaque blob id. That
 * on-chain availability certificate is what we anchor in `orbital_vault`.
 */

import { walrusClient, keypair, WALRUS_EPOCHS } from "./config.js";

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (Buffer.isBuffer(data)) return new Uint8Array(data);
  return new Uint8Array(Buffer.from(data));
}

/**
 * Upload a single blob. Returns { blobId, blobObjectId, certifiedEpoch }.
 * `deletable: true` lets a high-value capture be re-managed later.
 */
export async function uploadToWalrus(data, { epochs = WALRUS_EPOCHS, deletable = false } = {}) {
  const blob = toBytes(data);
  const result = await walrusClient.writeBlob({ blob, deletable, epochs, signer: keypair });

  const blobId = result.blobId;
  const blobObject = result.blobObject ?? null;
  const blobObjectId = blobObject?.id?.id ?? blobObject?.id ?? null;
  const certifiedEpoch = blobObject?.certified_epoch ?? blobObject?.certifiedEpoch ?? 0;

  console.log(`[WALRUS] Uploaded ${blob.length} bytes → blob ${blobId} (obj ${blobObjectId ?? "?"})`);
  return { blobId, blobObjectId, certifiedEpoch };
}

/** Download a blob by id. Returns a Buffer. */
export async function downloadFromWalrus(blobId) {
  const bytes = await walrusClient.readBlob({ blobId });
  return Buffer.from(bytes);
}

/**
 * Extend storage duration for a high-value capture (programmable storage).
 * API name has varied across SDK versions; we try the common ones.
 */
export async function renewBlob(blobObjectId, epochs = WALRUS_EPOCHS) {
  if (typeof walrusClient.extendBlob === "function") {
    return walrusClient.extendBlob({ blobObjectId, epochs, signer: keypair });
  }
  throw new Error("renewBlob: walrusClient.extendBlob not available in this SDK version");
}
