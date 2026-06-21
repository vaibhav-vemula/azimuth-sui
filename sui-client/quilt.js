/**
 * quilt.js — batch a pass's many small RF packets into one Walrus Quilt via the
 * testnet publisher's multipart quilt endpoint (`PUT /v1/quilts`). One storage unit
 * for the whole pass instead of one blob per packet. Non-fatal: callers catch failures.
 */

import { WALRUS_EPOCHS } from "./config.js";

const PUBLISHER = process.env.WALRUS_PUBLISHER || "https://publisher.walrus-testnet.walrus.space";

/**
 * packets: { "0": "<base64>", "1": "<base64>", ... } (from azimuth_station.py)
 * Returns { quiltId, patches: [{ identifier, patchId }] }.
 */
export async function uploadPacketsAsQuilt(passId, packets, { epochs = WALRUS_EPOCHS } = {}) {
  const entries = Object.entries(packets);
  if (entries.length === 0) throw new Error("no packets to quilt");

  const form = new FormData();
  for (const [idx, b64] of entries) {
    const bytes = Buffer.from(b64, "base64");
    const identifier = `${passId}:${idx}`;
    form.append(identifier, new Blob([bytes]), identifier);
  }

  const res = await fetch(`${PUBLISHER}/v1/quilts?epochs=${epochs}`, { method: "PUT", body: form });
  if (!res.ok) throw new Error(`Walrus quilt failed ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();

  const quiltId =
    json.blobStoreResult?.newlyCreated?.blobObject?.blobId ??
    json.blobStoreResult?.alreadyCertified?.blobId ??
    json.newlyCreated?.blobObject?.blobId ??
    null;
  const patches = (json.storedQuiltBlobs ?? json.storedQuiltPatches ?? []).map((p) => ({
    identifier: p.identifier,
    patchId: p.quiltPatchId ?? p.patchId ?? null,
  }));

  console.log(`[QUILT] Stored ${entries.length} packets for pass ${passId.slice(0, 10)} → quilt ${quiltId}`);
  return { quiltId, patches };
}
