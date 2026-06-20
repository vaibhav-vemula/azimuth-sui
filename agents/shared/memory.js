/**
 * memory.js — Verifiable agent memory on Walrus via MemWal, with a local-JSON fallback.
 *
 * This is the ONLY file that talks to MemWal, so when the (beta) SDK changes you adjust
 * one place. If MemWal env vars are absent, we use a local store with the same interface,
 * so the whole agent system runs before MemWal is wired.
 *
 * Unified interface returned by createMemory(namespace):
 *   await mem.remember(text, metadata?)        → store a memory
 *   await mem.recall(query, k=5)               → [{ text, metadata, score? }] (semantic-ish)
 *   await mem.list()                           → all memories (newest first)
 *   mem.backend                                → "memwal" | "local"
 */

import "./env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MEMWAL_KEY = process.env.MEMWAL_KEY || process.env.MEMWAL_PRIVATE_KEY;
const MEMWAL_READY =
  !!MEMWAL_KEY && !!process.env.MEMWAL_ACCOUNT_ID && !!process.env.MEMWAL_SERVER_URL;

const META_SEP = "\n::meta::"; // round-trips metadata through MemWal's text-only store

export async function createMemory(namespace) {
  const ns = namespace || process.env.MEMWAL_NAMESPACE || "azimuth-net";
  if (MEMWAL_READY) {
    try {
      return await memwalMemory(ns);
    } catch (err) {
      console.warn(`[memory] MemWal init failed (${err.message}) → using local store`);
    }
  }
  return localMemory(ns);
}

// ── MemWal-backed (Walrus Memory) ───────────────────────────────────────────────
// Matches the documented SDK: `remember(text)` returns a job → `waitForRememberJob`,
// and `recall({ query })`. Metadata is appended to the stored text (and parsed back on
// recall) so it round-trips through MemWal's text-oriented store.
async function memwalMemory(namespace) {
  // Imported lazily so the package isn't required for local-only runs.
  const { MemWal } = await import("@mysten-incubation/memwal");
  const mem = MemWal.create({
    key: MEMWAL_KEY,
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: process.env.MEMWAL_SERVER_URL,
    namespace,
  });

  const pack = (text, metadata) => {
    const t = typeof text === "string" ? text : JSON.stringify(text);
    return metadata && Object.keys(metadata).length ? `${t}${META_SEP}${JSON.stringify(metadata)}` : t;
  };
  const unpack = (raw) => {
    const s = typeof raw === "string" ? raw : raw?.text ?? raw?.content ?? JSON.stringify(raw);
    const i = s.indexOf(META_SEP);
    if (i === -1) return { text: s, metadata: {} };
    let metadata = {};
    try { metadata = JSON.parse(s.slice(i + META_SEP.length)); } catch {}
    return { text: s.slice(0, i), metadata };
  };

  return {
    backend: "memwal",
    async remember(text, metadata = {}) {
      const payload = pack(text, metadata);
      // Prefer the one-shot store+wait; fall back to remember → waitForRememberJob.
      if (typeof mem.rememberAndWait === "function") {
        return mem.rememberAndWait(payload);
      }
      const job = await mem.remember(payload);
      const jobId = job?.job_id ?? job?.jobId;
      if (jobId && typeof mem.waitForRememberJob === "function") {
        try { await mem.waitForRememberJob(jobId); } catch { /* eventual consistency is fine */ }
      }
      return job;
    },
    async recall(query, k = 5) {
      const res = await mem.recall({ query });
      const items = Array.isArray(res) ? res : res?.results ?? res?.memories ?? [];
      return items.slice(0, k).map((r) => {
        const { text, metadata } = unpack(r);
        return { text, metadata, score: r?.score };
      });
    },
    async list() {
      try {
        const res = await mem.recall({ query: "" });
        const items = Array.isArray(res) ? res : res?.results ?? res?.memories ?? [];
        return items.map((r) => unpack(r));
      } catch {
        return [];
      }
    },
  };
}

// ── Local JSON fallback (same interface) ────────────────────────────────────────
function localMemory(namespace) {
  const dir = path.resolve(__dirname, "../.memory");
  const file = path.join(dir, `${namespace}.json`);

  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      return [];
    }
  };
  const save = (arr) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(arr, null, 2));
  };

  return {
    backend: "local",
    async remember(text, metadata = {}) {
      const arr = load();
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: typeof text === "string" ? text : JSON.stringify(text),
        metadata,
        ts: Date.now(),
      };
      arr.push(entry);
      save(arr);
      return entry;
    },
    async recall(query, k = 5) {
      const arr = load();
      const terms = String(query).toLowerCase().split(/\W+/).filter(Boolean);
      const scored = arr.map((e) => {
        const hay = (e.text + " " + JSON.stringify(e.metadata)).toLowerCase();
        const score = terms.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
        return { ...e, score };
      });
      return scored
        .sort((a, b) => b.score - a.score || b.ts - a.ts)
        .slice(0, k)
        .map(({ text, metadata, score }) => ({ text, metadata, score }));
    },
    async list() {
      return load().sort((a, b) => b.ts - a.ts).map(({ text, metadata }) => ({ text, metadata }));
    },
  };
}
