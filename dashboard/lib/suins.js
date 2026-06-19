/**
 * suins.js — SuiNS name resolution (replaces ens.js / ensWriter.js).
 *
 * Uses SuiClient's built-in name service: forward (name → address) and reverse
 * (address → name). Exports keep the old names so page.js / Header.js are a
 * one-line import swap; `ensName` here just means "the SuiNS name string".
 */

import { getClient, isAddress } from "./sui.js";

/** Accepts a SuiNS name (…​.sui) or a 0x address; returns { address, ensName }. */
export async function resolveInput(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return { address: null, ensName: null };

  if (trimmed.endsWith(".sui")) {
    try {
      const address = await getClient().resolveNameServiceAddress({ name: trimmed });
      return { address: address || null, ensName: address ? trimmed : null };
    } catch {
      return { address: null, ensName: null };
    }
  }

  if (isAddress(trimmed)) {
    const ensName = await reverseName(trimmed);
    return { address: trimmed, ensName };
  }
  return { address: null, ensName: null };
}

async function reverseName(address) {
  try {
    const { data } = await getClient().resolveNameServiceNames({ address, limit: 1 });
    return data && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

/** SuiNS has no Azimuth-specific text records by default — return empty metadata. */
export async function getAzimuthRecords() {
  return null;
}

/** No avatar source for SuiNS here. */
export async function getEnsAvatar() {
  return null;
}
