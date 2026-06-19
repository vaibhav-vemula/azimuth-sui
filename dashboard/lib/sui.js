/**
 * sui.js — Read-only Sui data layer for the station dashboard.
 *
 * Replaces contract.js (ethers + Hedera Mirror Node). All reads go through a
 * fullnode SuiClient: the StationRegistry shared object, per-station records in
 * its `stations` Table, AZM balance, and PoRx/PoA events.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { isValidSuiAddress } from "@mysten/sui/utils";

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID;
export const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID;
const AZM_TYPE = `${PACKAGE_ID}::azm::AZM`;
const MOD = `${PACKAGE_ID}::orbital_vault`;
const SIGNED_OFFSET = 32768;

let _client = null;
export function getClient() {
  if (!_client) _client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  return _client;
}

export function isAddress(a) {
  try { return isValidSuiAddress(a); } catch { return false; }
}

function bytesToHex(bytes) {
  if (typeof bytes === "string") return bytes.startsWith("0x") ? bytes : "0x" + bytes;
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const decodeSigned = (n) => Number(n) - SIGNED_OFFSET;

export async function getRegistry() {
  const obj = await getClient().getObject({ id: REGISTRY_ID, options: { showContent: true } });
  return obj.data?.content?.fields ?? null;
}

async function getStationRecord(reg, addr) {
  const tableId = reg?.stations?.fields?.id?.id;
  if (!tableId) return null;
  try {
    const df = await getClient().getDynamicFieldObject({
      parentId: tableId,
      name: { type: "address", value: addr },
    });
    const f = df.data?.content?.fields?.value?.fields;
    if (!f) return null;
    return {
      registered: true,
      active: f.active,
      location: f.location,
      lastHeartbeat: Math.floor(Number(f.last_heartbeat_ms) / 1000),
      heartbeatCount: Number(f.heartbeat_count),
      totalPoaRewards: Number(f.total_poa_rewards),
      totalPorxRewards: Number(f.total_porx_rewards),
    };
  } catch {
    return null;
  }
}

async function getAzmBalance(addr) {
  try {
    const b = await getClient().getBalance({ owner: addr, coinType: AZM_TYPE });
    return Number(b.totalBalance);
  } catch {
    return null;
  }
}

async function getProofFields(proofId) {
  try {
    const o = await getClient().getObject({ id: proofId, options: { showContent: true } });
    return o.data?.content?.fields ?? null;
  } catch {
    return null;
  }
}

/** Recent PoRx passes for one station, built from PoRxSubmitted events + proof objects. */
async function getPorxPasses(addr) {
  const res = await getClient().queryEvents({
    query: { MoveEventType: `${MOD}::PoRxSubmitted` },
    order: "descending",
    limit: 50,
  });
  const mine = res.data.filter((e) => e.parsedJson?.station === addr).slice(0, 10);
  const passes = [];
  for (const ev of mine) {
    const j = ev.parsedJson;
    const f = await getProofFields(j.proof_id);
    passes.push({
      passId: bytesToHex(j.pass_id),
      packetCount: Number(j.packet_count),
      totalPackets: f ? Number(f.total_packets) : Number(j.packet_count),
      avgRssi: f ? decodeSigned(f.avg_rssi) : 0,
      avgSnr: f ? decodeSigned(f.avg_snr) : 0,
      timestamp: f ? Math.floor(Number(f.submitted_at_ms) / 1000) : Math.floor(Number(ev.timestampMs) / 1000),
      reward: f ? Number(f.reward_amount) : 0,
      claimed: false,
      verified: f ? f.verified : false,
      paid: f ? f.paid : false,
    });
  }
  return passes;
}

/** Recent on-chain activity (epoch settlements + PoRx payouts) for the activity table. */
async function getActivity() {
  const out = [];
  try {
    const settled = await getClient().queryEvents({
      query: { MoveEventType: `${MOD}::PoAEpochSettled` }, order: "descending", limit: 10,
    });
    for (const e of settled.data) {
      out.push({ type: "PoA Settlement", digest: e.id.txDigest, epoch: Number(e.parsedJson?.epoch), executed: true, timestamp: Math.floor(Number(e.timestampMs) / 1000) });
    }
    const paid = await getClient().queryEvents({
      query: { MoveEventType: `${MOD}::PoRxVerified` }, order: "descending", limit: 10,
    });
    for (const e of paid.data) {
      out.push({ type: "PoRx Payout", digest: e.id.txDigest, executed: true, timestamp: Math.floor(Number(e.timestampMs) / 1000) });
    }
  } catch {
    // best effort
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

/** Build the full bundle useStationData returns (same shape as the old Hedera version). */
export async function getStationData(addr) {
  const reg = await getRegistry();
  if (!reg) throw new Error("Registry not found — check NEXT_PUBLIC_REGISTRY_ID");

  const [station, azmBalance, porxPasses, schedules] = await Promise.all([
    getStationRecord(reg, addr),
    getAzmBalance(addr),
    getPorxPasses(addr),
    getActivity(),
  ]);

  const epochStart = Math.floor(Number(reg.poa_epoch_start_ms) / 1000);
  const epochInterval = Math.floor(Number(reg.poa_epoch_interval_ms) / 1000);

  return {
    station: station || { registered: false, active: false, location: "", lastHeartbeat: 0, heartbeatCount: 0, totalPoaRewards: 0, totalPorxRewards: 0 },
    epochCount: Number(reg.poa_epoch_count),
    epochStart,
    epochInterval,
    nextSettlement: epochStart + epochInterval,
    nextScheduleAddress: null,
    poaScheduleStatus: null,
    heartbeatThreshold: Number(reg.heartbeat_threshold),
    poaRewardAmount: Number(reg.poa_reward_amount),
    porxBaseReward: Number(reg.porx_base_reward),
    porxPassCount: porxPasses.length,
    porxPasses,
    azmBalance,
    stationCount: Array.isArray(reg.station_list) ? reg.station_list.length : 0,
    schedules,
  };
}

/** All stations (for the /stations page). */
export async function getAllStations() {
  const reg = await getRegistry();
  if (!reg || !Array.isArray(reg.station_list)) return [];
  const out = [];
  for (const addr of reg.station_list) {
    const s = await getStationRecord(reg, addr);
    if (s) out.push({ address: addr, ...s });
  }
  return out;
}
