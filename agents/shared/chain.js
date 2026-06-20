/**
 * chain.js — thin Sui bridge for the agents.
 *
 * Reads on-chain state/events (registry, stations, ImageMerged) and — if a station key is
 * provided — lets the Operator Agent take a real on-chain action (heartbeat). All chain
 * access is optional: if PACKAGE_ID/REGISTRY_ID are unset the helpers no-op so the agents
 * still run in a pure simulation/demo.
 */

import "./env.js";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const NETWORK = process.env.SUI_NETWORK || "testnet";
export const PACKAGE_ID = process.env.PACKAGE_ID;
export const REGISTRY_ID = process.env.REGISTRY_ID;
export const chainReady = !!PACKAGE_ID && !!REGISTRY_ID && !PACKAGE_ID.startsWith("0x...");

let _client = null;
export function client() {
  if (!_client) _client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  return _client;
}

let _keypair = null;
function keypair() {
  if (_keypair) return _keypair;
  const sk = process.env.SUI_PRIVATE_KEY;
  if (!sk) return null;
  _keypair = Ed25519Keypair.fromSecretKey(sk);
  return _keypair;
}

export function bytesToHex(bytes) {
  if (typeof bytes === "string") return bytes.startsWith("0x") ? bytes : "0x" + bytes;
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Query recent events of a given struct (e.g. "ImageMerged", "PoRxSubmitted"). */
export async function queryEvents(structName, { limit = 50, cursor = null } = {}) {
  if (!chainReady) return { data: [], nextCursor: null, hasNextPage: false };
  return client().queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::orbital_vault::${structName}` },
    order: "descending",
    limit,
    cursor,
  });
}

/** All registered station addresses (from the shared registry's station_list). */
export async function listStations() {
  if (!chainReady) return [];
  const obj = await client().getObject({ id: REGISTRY_ID, options: { showContent: true } });
  const list = obj.data?.content?.fields?.station_list;
  return Array.isArray(list) ? list : [];
}

/** Real on-chain action: submit a PoA heartbeat (needs SUI_PRIVATE_KEY). */
export async function submitHeartbeat() {
  if (!chainReady) return { ok: false, reason: "chain not configured" };
  const kp = keypair();
  if (!kp) return { ok: false, reason: "no SUI_PRIVATE_KEY" };
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::orbital_vault::heartbeat`,
    arguments: [tx.object(REGISTRY_ID), tx.object("0x6")],
  });
  const res = await client().signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true } });
  await client().waitForTransaction({ digest: res.digest });
  return { ok: res.effects?.status?.status === "success", digest: res.digest };
}
