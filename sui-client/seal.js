/**
 * seal.js — client-side Seal encryption for premium (full-res / raw) captures.
 *
 * Encrypted bytes are uploaded to Walrus; only an address that passes
 * `azimuth::access_policy::seal_approve` for the pass can decrypt. Identity = the pass_id.
 *
 * @mysten/seal 0.4.x dropped `getAllowlistedKeyServers`, so testnet key-server object ids
 * are provided here (overridable via SEAL_KEY_SERVER_IDS). API: SealClient({ serverConfigs })
 * + encrypt({ threshold, packageId, id, data }).
 */

import { SealClient } from "@mysten/seal";
import { suiClient, PACKAGE_ID, SEAL_THRESHOLD } from "./config.js";

// Verified testnet Seal key server. Override/extend with SEAL_KEY_SERVER_IDS.
// (The 0xb012… "committee" server needs an extra aggregatorUrl; we use the plain
// independent server for a simple threshold-1 setup.)
const DEFAULT_TESTNET_KEY_SERVERS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
];

function keyServerIds() {
  const fromEnv = (process.env.SEAL_KEY_SERVER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_TESTNET_KEY_SERVERS;
}

let _client = null;
function client() {
  if (_client) return _client;
  _client = new SealClient({
    suiClient,
    serverConfigs: keyServerIds().map((objectId) => ({ objectId, weight: 1 })),
    verifyKeyServers: false,
  });
  return _client;
}

function hexFromPassId(passId) {
  return passId.startsWith("0x") ? passId.slice(2) : passId;
}

/** Encrypt `data` so only an address passing the access policy for `passId` can decrypt. */
export async function encryptForPass(passId, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(Buffer.from(data));
  const ids = keyServerIds();
  const threshold = Math.min(SEAL_THRESHOLD, ids.length); // never exceed available servers
  const { encryptedObject } = await client().encrypt({
    threshold,
    packageId: PACKAGE_ID,
    id: hexFromPassId(passId),
    data: bytes,
  });
  return encryptedObject;
}
