/**
 * stateWriter.js — Write aggregated Sui state to JSON for the Pygame dashboard.
 *
 * Unchanged in spirit from the Hedera client: atomic write (.tmp then rename)
 * so the Python UI never reads a partial file. Only the data source changed.
 */

import fs from "node:fs";
import { STATE_FILE } from "./config.js";

let currentState = {
  station: null,
  poa: null,
  porx: null,
  heartbeat: null,
  lastUpdated: null,
};

export function updateState(section, data) {
  currentState[section] = data;
  currentState.lastUpdated = new Date().toISOString();
}

export function flush() {
  const tmpFile = STATE_FILE + ".tmp";
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(currentState, null, 2));
    fs.renameSync(tmpFile, STATE_FILE);
  } catch (err) {
    console.error(`[STATE] Write failed: ${err.message}`);
  }
}

let flushTimer = null;

export function startFlushing(intervalMs = 2000) {
  flushTimer = setInterval(flush, intervalMs);
}

export function stopFlushing() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function getState() {
  return currentState;
}
