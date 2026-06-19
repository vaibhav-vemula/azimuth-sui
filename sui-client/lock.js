/**
 * lock.js — Serialize all transaction signing from this station's keypair.
 *
 * Concurrent txs can collide on the same gas coin / object versions. A single
 * in-process mutex (same role the Hedera client used to avoid nonce collisions)
 * keeps signing sequential.
 */

let locked = false;

export async function acquireLock() {
  while (locked) await new Promise((r) => setTimeout(r, 250));
  locked = true;
}

export function releaseLock() {
  locked = false;
}
