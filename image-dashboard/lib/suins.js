/**
 * suins.js — reverse SuiNS lookup (address → name) for station image pills.
 * Replaces ens.js. Uses SuiClient's built-in name service.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";

let _client = null;
function client() {
  if (!_client) _client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  return _client;
}

export async function lookupAddress(address) {
  try {
    const { data } = await client().resolveNameServiceNames({ address, limit: 1 });
    return data && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

export async function resolveMany(addresses) {
  const results = {};
  await Promise.all(
    addresses.map(async (addr) => {
      results[addr.toLowerCase()] = await lookupAddress(addr);
    })
  );
  return results;
}
