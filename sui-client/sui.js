/**
 * sui.js — PTB builders and read helpers for the `azimuth::orbital_vault` package.
 *
 * Replaces abi.js + the ethers contract instance. Each entry function is wrapped
 * in a small helper that builds a Transaction, signs with the station keypair,
 * and waits for finality. Reads use getObject / dynamic fields / queryEvents.
 */

import { Transaction } from "@mysten/sui/transactions";
import {
  suiClient,
  keypair,
  address,
  PACKAGE_ID,
  REGISTRY_ID,
  CLOCK_ID,
  SIGNED_OFFSET,
} from "./config.js";

const M = `${PACKAGE_ID}::orbital_vault`;

/** Sign, execute, and wait for a transaction. */
export async function execTx(tx, label = "tx") {
  const res = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });
  await suiClient.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`${label} failed: ${res.effects?.status?.error}`);
  }
  return res;
}

/** Convert a "0x..."-prefixed hex string into a byte array for vector<u8> args. */
export function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

/** Convert a vector<u8> (array of byte numbers, as events return it) to "0x..." hex. */
export function bytesToHex(bytes) {
  if (typeof bytes === "string") return bytes; // already hex
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read a PoRxProof object's verified/paid flags. */
export async function getProofFlags(proofId) {
  const obj = await suiClient.getObject({ id: proofId, options: { showContent: true } });
  const f = obj.data?.content?.fields;
  if (!f) return null;
  return { verified: f.verified, paid: f.paid, station: f.station, passId: bytesToHex(f.pass_id) };
}

// ── Writes (entry functions) ───────────────────────────────────────────────────

export async function callHeartbeat() {
  const tx = new Transaction();
  tx.moveCall({ target: `${M}::heartbeat`, arguments: [tx.object(REGISTRY_ID), tx.object(CLOCK_ID)] });
  return execTx(tx, "heartbeat");
}

export async function callSettleEpoch() {
  const tx = new Transaction();
  tx.moveCall({ target: `${M}::settle_poa_epoch`, arguments: [tx.object(REGISTRY_ID), tx.object(CLOCK_ID)] });
  return execTx(tx, "settle_poa_epoch");
}

export async function callSubmitPorx({ passId, packetCount, totalPackets, merkleBytes, avgRssi, avgSnr, walrusBlobId }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${M}::submit_porx`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.pure.vector("u8", hexToBytes(passId)),
      tx.pure.u16(packetCount),
      tx.pure.u16(totalPackets),
      tx.pure.vector("u8", Array.from(merkleBytes)),
      tx.pure.u16(clampU16(avgRssi + SIGNED_OFFSET)),
      tx.pure.u16(clampU16(avgSnr + SIGNED_OFFSET)),
      tx.pure.string(walrusBlobId),
      tx.object(CLOCK_ID),
    ],
  });
  return execTx(tx, "submit_porx");
}

export async function callVerifyPorx(proofId) {
  const tx = new Transaction();
  tx.moveCall({ target: `${M}::verify_porx`, arguments: [tx.object(REGISTRY_ID), tx.object(proofId)] });
  return execTx(tx, "verify_porx");
}

export async function callRecordImage({ passId, walrusBlobId, blobObjectId, certifiedEpoch, recovered, total, highValue }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${M}::record_image`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.pure.vector("u8", hexToBytes(passId)),
      tx.pure.string(walrusBlobId),
      tx.pure.string(blobObjectId || ""),
      tx.pure.u64(BigInt(certifiedEpoch || 0)),
      tx.pure.u16(recovered),
      tx.pure.u16(total),
      tx.pure.bool(!!highValue),
    ],
  });
  return execTx(tx, "record_image");
}

function clampU16(n) {
  return Math.max(0, Math.min(65535, Math.round(n)));
}

// ── Reads ───────────────────────────────────────────────────────────────────────

/** Fetch the shared StationRegistry object fields. */
export async function getRegistry() {
  const obj = await suiClient.getObject({ id: REGISTRY_ID, options: { showContent: true } });
  return obj.data?.content?.fields ?? null;
}

/**
 * Read one station's record from the registry's `stations` Table (dynamic field).
 * Field paths follow Sui's Table layout; returns null if not registered.
 */
export async function getStation(addr = address) {
  const reg = await getRegistry();
  if (!reg) return null;
  const tableId = reg.stations?.fields?.id?.id;
  if (!tableId) return null;
  try {
    const df = await suiClient.getDynamicFieldObject({
      parentId: tableId,
      name: { type: "address", value: addr },
    });
    const f = df.data?.content?.fields?.value?.fields;
    if (!f) return null;
    return {
      address: addr,
      registered: true,
      active: f.active,
      location: f.location,
      lastHeartbeat: Number(f.last_heartbeat_ms) / 1000,
      heartbeatCount: Number(f.heartbeat_count),
      totalPoaRewards: Number(f.total_poa_rewards),
      totalPorxRewards: Number(f.total_porx_rewards),
      unstakeRequestedAt: Number(f.unstake_requested_at_ms) / 1000,
    };
  } catch {
    return { address: addr, registered: false };
  }
}

/** Build the PoA epoch view the dashboard expects. */
export async function getPoaState() {
  const reg = await getRegistry();
  if (!reg) return null;
  const start = Number(reg.poa_epoch_start_ms) / 1000;
  const interval = Number(reg.poa_epoch_interval_ms) / 1000;
  return {
    epoch: Number(reg.poa_epoch_count),
    epochStart: start,
    interval,
    nextSettlement: start + interval,
    rewardPool: Number(reg.reward_pool),
    stationCount: Array.isArray(reg.station_list) ? reg.station_list.length : 0,
  };
}

/** Query recent events of a given struct type, e.g. "PoRxSubmitted". */
export async function queryEvents(structName, cursor = null, limit = 50) {
  const res = await suiClient.queryEvents({
    query: { MoveEventType: `${M}::${structName}` },
    cursor,
    limit,
    order: "ascending",
  });
  return res; // { data, nextCursor, hasNextPage }
}
