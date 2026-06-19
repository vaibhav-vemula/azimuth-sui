/**
 * eventTracker.js — Read on-chain state for the dashboard and run the PoA crank.
 *
 * Replaces scheduleTracker.js (Hedera Mirror Node). Reads the StationRegistry +
 * Station objects and PoRx events, and — since Sui has no Hedera-style scheduler —
 * cranks `settle_poa_epoch` itself once an epoch is due.
 */

import { getStation, getPoaState, queryEvents, getProofFlags, callSettleEpoch, bytesToHex } from "./sui.js";
import { address, POLL_INTERVAL, RUN_CRANK } from "./config.js";
import { acquireLock, releaseLock } from "./lock.js";

let pollTimer = null;

/** Crank the epoch if it's due. EEpochNotReady aborts are expected and ignored. */
export async function crankEpoch(poa) {
  if (!RUN_CRANK) return;
  const state = poa || (await getPoaState());
  if (!state) return;
  const now = Math.floor(Date.now() / 1000);
  if (now < state.nextSettlement) return;
  try {
    await acquireLock();
    console.log(`[CRANK] Epoch due — settling…`);
    const res = await callSettleEpoch();
    console.log(`[CRANK] Settled — ${res.digest}`);
  } catch (err) {
    if (!/EEpochNotReady|MoveAbort/.test(err.message)) {
      console.warn(`[CRANK] ${err.message}`);
    }
  } finally {
    releaseLock();
  }
}

async function recentPorx() {
  try {
    const { data } = await queryEvents("PoRxSubmitted", null, 50);
    const mine = data.filter((e) => e.parsedJson?.station === address).slice(-10);
    const out = [];
    for (const ev of mine) {
      const j = ev.parsedJson;
      const flags = await getProofFlags(j.proof_id);
      out.push({
        passId: bytesToHex(j.pass_id),
        packetCount: Number(j.packet_count),
        walrusBlobId: j.walrus_blob_id,
        verified: flags?.verified ?? false,
        paid: flags?.paid ?? false,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function pollState() {
  const [station, poa, recent] = await Promise.all([getStation(address), getPoaState(), recentPorx()]);
  return {
    station,
    poa,
    stationCount: poa?.stationCount ?? 0,
    porx: {
      recent,
      pending: recent.filter((p) => !p.paid),
      completed: recent.filter((p) => p.paid),
    },
  };
}

export function startTracking(interval, onUpdate) {
  console.log(`[TRACKER] Starting — poll every ${(interval || POLL_INTERVAL) / 1000}s`);
  const run = async () => {
    try {
      const state = await pollState();
      await crankEpoch(state.poa);
      if (state && onUpdate) onUpdate(state);
    } catch (err) {
      console.error(`[TRACKER] poll failed: ${err.message}`);
    }
  };
  run();
  pollTimer = setInterval(run, interval || POLL_INTERVAL);
}

export function stopTracking() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
