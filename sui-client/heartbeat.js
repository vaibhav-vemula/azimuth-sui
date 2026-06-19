/**
 * heartbeat.js — Periodic heartbeats to prove station availability (PoA).
 *
 * Calls `orbital_vault::heartbeat`. The HCS publish step is gone — the Move
 * function emits a `HeartbeatEmitted` event on-chain.
 */

import { callHeartbeat } from "./sui.js";
import { HEARTBEAT_INTERVAL } from "./config.js";
import { acquireLock, releaseLock } from "./lock.js";

let heartbeatCount = 0;
let lastDigest = null;
let timer = null;

export async function sendHeartbeat() {
  try {
    await acquireLock();
    console.log(`[HEARTBEAT] Sending heartbeat #${heartbeatCount + 1}...`);
    const res = await callHeartbeat();
    heartbeatCount++;
    lastDigest = res.digest;
    console.log(`[HEARTBEAT] #${heartbeatCount} confirmed — ${res.digest}`);
    return { success: true, digest: res.digest, count: heartbeatCount };
  } catch (err) {
    console.error(`[HEARTBEAT] Failed: ${err.message}`);
    return { success: false, error: err.message, count: heartbeatCount };
  } finally {
    releaseLock();
  }
}

export function startHeartbeatLoop() {
  console.log(`[HEARTBEAT] Starting loop — interval: ${HEARTBEAT_INTERVAL / 1000}s`);
  sendHeartbeat();
  timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

export function stopHeartbeatLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getStatus() {
  return { count: heartbeatCount, lastDigest, intervalMs: HEARTBEAT_INTERVAL };
}
