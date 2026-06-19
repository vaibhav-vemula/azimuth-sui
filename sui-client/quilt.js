/**
 * quilt.js — Batch many small RF packets into one Walrus Quilt.
 *
 * A satellite pass produces dozens/hundreds of tiny packets. Storing each as its
 * own blob wastes the erasure-coding overhead Walrus pays per blob, so we pack a
 * whole pass into ONE Quilt and address individual packets by identifier.
 *
 * NOTE: the Quilt SDK surface has shifted across @mysten/walrus versions. This
 * uses `writeQuilt`; if your pinned version differs, adjust here only.
 */

import { walrusClient, keypair, WALRUS_EPOCHS } from "./config.js";

/**
 * packets: { "0": "<base64>", "1": "<base64>", ... } (as produced by azimuth_station.py)
 * Returns { quiltId, patches: [{ identifier, patchId }] }.
 */
export async function uploadPacketsAsQuilt(passId, packets, { epochs = WALRUS_EPOCHS } = {}) {
  const blobs = Object.entries(packets).map(([idx, b64]) => ({
    identifier: `${passId}:${idx}`,
    contents: new Uint8Array(Buffer.from(b64, "base64")),
    tags: { passId, packetIndex: idx },
  }));

  const result = await walrusClient.writeQuilt({
    blobs,
    epochs,
    deletable: false,
    signer: keypair,
  });

  // Normalize across SDK shapes.
  const quiltId = result.blobId ?? result.quiltId ?? null;
  const patches =
    (result.blobs ?? result.patches ?? []).map((p) => ({
      identifier: p.identifier,
      patchId: p.quiltPatchId ?? p.patchId ?? p.id ?? null,
    })) ?? [];

  console.log(`[QUILT] Stored ${blobs.length} packets for pass ${passId.slice(0, 10)} → quilt ${quiltId}`);
  return { quiltId, patches };
}

/** Read a single packet back from a quilt patch id. Returns a Buffer. */
export async function readQuiltPatch(patchId) {
  if (typeof walrusClient.readQuiltPatch === "function") {
    const bytes = await walrusClient.readQuiltPatch({ patchId });
    return Buffer.from(bytes);
  }
  // Fallback: some versions expose getFiles/readBlob by quilt id.
  throw new Error("readQuiltPatch: not available in this SDK version");
}
