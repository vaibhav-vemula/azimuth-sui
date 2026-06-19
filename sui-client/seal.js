/**
 * seal.js — Client-side Seal encryption for premium (full-res / raw) captures.
 *
 * The encrypted bytes are what get uploaded to Walrus for the premium tier.
 * Decryption happens in the browser (image-dashboard) once the user's wallet
 * passes `azimuth::access_policy::seal_approve` (i.e. they bought access).
 *
 * Identity = the pass_id bytes, so `seal_approve(id, ...)` can gate per pass.
 */

import { SealClient, getAllowlistedKeyServers } from "@mysten/seal";
import { suiClient, PACKAGE_ID, NETWORK, SEAL_THRESHOLD } from "./config.js";

let _client = null;
function client() {
  if (_client) return _client;
  const serverObjectIds = getAllowlistedKeyServers(NETWORK);
  _client = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({ objectId: id, weight: 1 })),
    verifyKeyServers: false,
  });
  return _client;
}

function hexFromPassId(passId) {
  return passId.startsWith("0x") ? passId.slice(2) : passId;
}

/**
 * Encrypt `data` so it can only be decrypted by an address that passes the
 * access policy for `passId`. Returns the encrypted Uint8Array to store on Walrus.
 */
export async function encryptForPass(passId, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(Buffer.from(data));
  const { encryptedObject } = await client().encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PACKAGE_ID,
    id: hexFromPassId(passId),
    data: bytes,
  });
  return encryptedObject;
}
