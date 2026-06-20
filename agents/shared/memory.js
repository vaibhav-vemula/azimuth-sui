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

const MEMWAL_READY =
  !!process.env.MEMWAL_KEY && !!process.env.MEMWAL_ACCOUNT_ID && !!process.env.MEMWAL_SERVER_URL;

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
async function memwalMemory(namespace) {
  // Imported lazily so the package isn't required for local-only runs.
  const { MemWal } = await import("@mysten-incubation/memwal");
  const mem = MemWal.create({
    key: process.env.MEMWAL_KEY,
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: process.env.MEMWAL_SERVER_URL,
    namespace,
  });

  return {
    backend: "memwal",
    async remember(text, metadata = {}) {
      // MemWal `remember` persists to Walrus (encrypted) + indexes for semantic recall.
      return mem.remember(typeof text === "string" ? text : JSON.stringify(text), { metadata });
    },
    async recall(query, k = 5) {
      const res = await mem.recall(query, { limit: k });
      const items = Array.isArray(res) ? res : res?.results || res?.memories || [];
      return items.map((r) => ({
        text: r.text ?? r.content ?? (typeof r === "string" ? r : JSON.stringify(r)),
        metadata: r.metadata ?? {},
        score: r.score,
      }));
    },
    async list() {
      try {
        const res = await mem.restore?.();
        const items = Array.isArray(res) ? res : res?.memories || [];
        return items.map((r) => ({ text: r.text ?? r.content, metadata: r.metadata ?? {} }));
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
