/**
 * @azimuth/memwal-depin
 *
 * A tiny, reusable adapter that turns **DePIN sensor observations** into **verifiable,
 * shareable agent memory on Walrus** (via MemWal). Any physical-sensor / DePIN project —
 * not just Azimuth — can use it to give its agents long-term, tamper-evident memory.
 *
 * Two layers:
 *   - `createSensorRecorder(memory, opts)` — backend-agnostic; wraps any store exposing
 *     `remember(text, metadata)` + `recall(query, k)` (e.g. MemWal, or your own).
 *   - `memwalBackend(config)` — a ready-made MemWal-backed store, so you can go end-to-end
 *     with just MemWal Playground credentials.
 *
 * Why a canonical text form: MemWal indexes text for semantic recall, so we render each
 * observation to a stable sentence AND round-trip the structured fields as metadata.
 */

/** The observation shape this adapter standardizes for DePIN sensors. */
export const OBSERVATION_SCHEMA = {
  sensorId: "string  — stable id of the physical sensor/node",
  type: "string      — observation kind (e.g. 'satellite-reception', 'air-quality')",
  value: "number|string — the reading",
  unit: "string?     — unit of the reading",
  geo: "{lat,lon}?   — sensor location",
  ts: "string?       — ISO timestamp (defaults to now)",
  note: "string?     — human-readable context",
  // any extra keys are preserved as metadata
};

const META_SEP = "\n::meta::";

function normalize(o) {
  return {
    sensorId: o.sensorId ?? "unknown",
    type: o.type ?? "observation",
    value: o.value,
    unit: o.unit ?? "",
    geo: o.geo ?? null,
    ts: o.ts ?? new Date().toISOString(),
    note: o.note ?? "",
    ...o,
  };
}

/** Stable, recall-friendly sentence for an observation. */
export function observationText(o) {
  const obs = normalize(o);
  const where = obs.geo ? `@ ${obs.geo.lat},${obs.geo.lon}` : "";
  const val = `${obs.value}${obs.unit ? " " + obs.unit : ""}`;
  return `[${obs.type}] sensor ${obs.sensorId} = ${val} ${where} (${obs.ts})${obs.note ? " — " + obs.note : ""}`.replace(/\s+/g, " ").trim();
}

/**
 * Wrap any memory backend ({ remember(text, metadata), recall(query, k) }) with
 * DePIN-sensor semantics.
 */
export function createSensorRecorder(memory, { source = "depin-sensor" } = {}) {
  if (!memory || typeof memory.remember !== "function" || typeof memory.recall !== "function") {
    throw new Error("createSensorRecorder: memory must implement remember(text, metadata) and recall(query, k)");
  }
  return {
    /** Store a sensor observation as verifiable memory. Returns the backend result. */
    async record(observation) {
      const obs = normalize(observation);
      return memory.remember(observationText(obs), { schema: "depin-observation", source, ...obs });
    },
    /** Reference a Walrus artifact (image, report, dataset) produced from sensor data. */
    async recordArtifact({ sensorId, artifactType, blobId, summary = "", ...rest }) {
      const text = `[artifact:${artifactType}] sensor ${sensorId}: ${summary} (walrus ${blobId})`;
      return memory.remember(text, { schema: "depin-artifact", source, sensorId, artifactType, blobId, summary, ...rest });
    },
    /** Recall past observations, optionally filtered to one sensor. */
    async recall(query, { k = 5, sensorId } = {}) {
      const hits = await memory.recall(query, k);
      return sensorId ? hits.filter((h) => h.metadata?.sensorId === sensorId) : hits;
    },
    backend: memory.backend ?? "custom",
  };
}

/**
 * A ready-made MemWal-backed store. Returns { remember, recall, backend }.
 * `@mysten-incubation/memwal` is a peer dep (install with --legacy-peer-deps).
 */
export async function memwalBackend({ key, accountId, serverUrl, namespace = "depin" }) {
  const { MemWal } = await import("@mysten-incubation/memwal");
  const mem = MemWal.create({ key, accountId, serverUrl, namespace });

  const pack = (text, metadata) =>
    metadata && Object.keys(metadata).length ? `${text}${META_SEP}${JSON.stringify(metadata)}` : text;
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
      const payload = pack(typeof text === "string" ? text : JSON.stringify(text), metadata);
      if (typeof mem.rememberAndWait === "function") return mem.rememberAndWait(payload);
      const job = await mem.remember(payload);
      const jobId = job?.job_id ?? job?.jobId;
      if (jobId && typeof mem.waitForRememberJob === "function") {
        try { await mem.waitForRememberJob(jobId); } catch { /* eventual consistency */ }
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
  };
}

/** Convenience: MemWal-backed sensor recorder in one call. */
export async function createMemwalSensorRecorder(memwalConfig, opts = {}) {
  const memory = await memwalBackend(memwalConfig);
  return createSensorRecorder(memory, opts);
}
